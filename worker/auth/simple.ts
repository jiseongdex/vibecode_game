import type { SessionPrincipal } from '../types'
import type { Env } from '../types'
import { getSessionDto, issueSession, ApiFailure } from './session'
import {
  checkThrottle,
  clearThrottle,
  ipBucket,
  IP_LOGIN_POLICY,
  NICKNAME_LOGIN_POLICY,
  recordFailure,
  recordSignup,
  releaseReservation,
  SIGNUP_POLICY,
} from './throttle'

const encoder = new TextEncoder()
const DUMMY_SALT = new Uint8Array(16)
const PIN_PATTERN = /^[0-9]{4}$/
const NICKNAME_PATTERN = /^[\p{L}\p{N}_-]+$/u

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

function equalBase64(left: string, right: string): boolean {
  const a = fromBase64(left)
  const b = fromBase64(right)
  let mismatch = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0)
  }
  return mismatch === 0
}

export function normalizeNickname(input: unknown): { displayName: string; nicknameKey: string } {
  if (typeof input !== 'string') {
    throw new ApiFailure(400, 'invalid_nickname', 'Nickname must contain 2 to 20 letters, numbers, _ or -.')
  }
  const displayName = input.normalize('NFKC').trim()
  const length = Array.from(displayName).length
  if (length < 2 || length > 20 || !NICKNAME_PATTERN.test(displayName)) {
    throw new ApiFailure(400, 'invalid_nickname', 'Nickname must contain 2 to 20 letters, numbers, _ or -.')
  }
  return { displayName, nicknameKey: displayName.toLowerCase() }
}

function validatePin(input: unknown): string {
  if (typeof input !== 'string' || !PIN_PATTERN.test(input)) {
    throw new ApiFailure(400, 'invalid_pin', 'PIN must be exactly four digits.')
  }
  return input
}

function requirePepper(env: Env): string {
  if (!env.PIN_PEPPER) {
    throw new ApiFailure(503, 'auth_unavailable', 'Authentication is temporarily unavailable.')
  }
  return env.PIN_PEPPER
}

async function readCredentials(request: Request): Promise<{
  displayName: string
  nicknameKey: string
  pin: string
}> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new ApiFailure(400, 'invalid_json', 'Request body must be JSON.')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiFailure(400, 'invalid_json', 'Request body must be a JSON object.')
  }
  const object = body as Record<string, unknown>
  return { ...normalizeNickname(object.nickname), pin: validatePin(object.pin) }
}

export async function hashPin(pin: string, salt: Uint8Array, pepper: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(`${pin}\0${pepper}`), 'PBKDF2', false, ['deriveBits'],
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations: 100_000, hash: 'SHA-256' },
    key,
    256,
  )
  return toBase64(new Uint8Array(derived))
}

export async function verifyPin(
  pin: string,
  saltBase64: string,
  storedHash: string,
  pepper: string,
): Promise<boolean> {
  const candidate = await hashPin(pin, fromBase64(saltBase64), pepper)
  return equalBase64(candidate, storedHash)
}

async function sessionResponse(env: Env, principal: SessionPrincipal, nowMs: number): Promise<Response> {
  const { cookie } = await issueSession(env, principal.userId, nowMs)
  const dto = await getSessionDto(env, principal)
  return Response.json(dto, {
    headers: { 'Cache-Control': 'no-store', 'Set-Cookie': cookie },
  })
}

export async function registerSimple(request: Request, env: Env): Promise<Response> {
  const pepper = requirePepper(env)
  const nowMs = Date.now()
  const signupBucket = await ipBucket(request, pepper, 'signup-ip')
  if (await checkThrottle(env, signupBucket, SIGNUP_POLICY, nowMs)) {
    throw new ApiFailure(429, 'rate_limited', 'Too many signup attempts. Try again later.')
  }

  const { displayName, nicknameKey, pin } = await readCredentials(request)
  if (!await recordSignup(env, signupBucket, nowMs)) {
    throw new ApiFailure(429, 'rate_limited', 'Too many signup attempts. Try again later.')
  }

  const existing = await env.DB.prepare('SELECT id FROM users WHERE nickname_key = ?')
    .bind(nicknameKey).first<{ id: string }>()
  if (existing) throw new ApiFailure(409, 'nickname_taken', 'Nickname is already in use.')

  const id = crypto.randomUUID()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  try {
    await env.DB.prepare(
      `INSERT INTO users (
        id, auth_type, display_name, nickname_key, pin_salt, pin_hash, created_at_ms, updated_at_ms
      ) VALUES (?, 'simple', ?, ?, ?, ?, ?, ?)`,
    ).bind(id, displayName, nicknameKey, toBase64(salt), await hashPin(pin, salt, pepper), nowMs, nowMs).run()
  } catch (error) {
    if (String(error).includes('UNIQUE constraint failed: users.nickname_key')) {
      throw new ApiFailure(409, 'nickname_taken', 'Nickname is already in use.')
    }
    throw error
  }

  return sessionResponse(env, { userId: id, authType: 'simple', displayName }, nowMs)
}

export async function loginSimple(request: Request, env: Env): Promise<Response> {
  const pepper = requirePepper(env)
  const nowMs = Date.now()
  const { nicknameKey, pin } = await readCredentials(request)
  const nicknameBucket = `login-name:${nicknameKey}`
  const addressBucket = await ipBucket(request, pepper, 'login-ip')

  if (await checkThrottle(env, nicknameBucket, NICKNAME_LOGIN_POLICY, nowMs)) {
    throw new ApiFailure(429, 'rate_limited', 'Too many login attempts. Try again later.')
  }
  if (!await recordFailure(env, nicknameBucket, NICKNAME_LOGIN_POLICY, nowMs)) {
    throw new ApiFailure(429, 'rate_limited', 'Too many login attempts. Try again later.')
  }
  if (
    await checkThrottle(env, addressBucket, IP_LOGIN_POLICY, nowMs) ||
    !await recordFailure(env, addressBucket, IP_LOGIN_POLICY, nowMs)
  ) {
    await releaseReservation(env, nicknameBucket, NICKNAME_LOGIN_POLICY)
    throw new ApiFailure(429, 'rate_limited', 'Too many login attempts. Try again later.')
  }

  const user = await env.DB.prepare(
    "SELECT id, display_name, pin_salt, pin_hash FROM users WHERE auth_type = 'simple' AND nickname_key = ?",
  ).bind(nicknameKey).first<{
    id: string
    display_name: string
    pin_salt: string
    pin_hash: string
  }>()

  const valid = user
    ? await verifyPin(pin, user.pin_salt, user.pin_hash, pepper)
    : await verifyPin(pin, toBase64(DUMMY_SALT), toBase64(new Uint8Array(32)), pepper)

  if (!valid || !user) {
    throw new ApiFailure(401, 'invalid_credentials', 'Invalid nickname or PIN.')
  }

  await clearThrottle(env, nicknameBucket)
  await releaseReservation(env, addressBucket, IP_LOGIN_POLICY)
  return sessionResponse(env, {
    userId: user.id,
    authType: 'simple',
    displayName: user.display_name,
  }, nowMs)
}
