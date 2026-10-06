import type { SessionDto } from '../../src/api/contracts'
import type { Env, SessionPrincipal } from '../types'
import { readProgress } from '../game/runs'

const COOKIE_NAME = '__Host-maze_session'
const SESSION_SECONDS = 7 * 24 * 60 * 60
const SESSION_MS = SESSION_SECONDS * 1000

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function hashToken(token: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))
}

function readToken(request: Request): string | null {
  const cookies = request.headers.get('Cookie')?.split(';') ?? []
  const value = cookies.map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1)
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null
}

export function assertSameOriginJson(request: Request): void {
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    throw new ApiFailure(403, 'invalid_origin', 'Request origin is not allowed.')
  }
  const mediaType = request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase()
  if (mediaType !== 'application/json') {
    throw new ApiFailure(415, 'unsupported_media_type', 'Content-Type must be application/json.')
  }
}

export async function issueSession(
  env: Env,
  userId: string,
  nowMs: number,
): Promise<{ cookie: string }> {
  const random = crypto.getRandomValues(new Uint8Array(32))
  const token = btoa(String.fromCharCode(...random)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  await env.DB.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at_ms, expires_at_ms) VALUES (?, ?, ?, ?)',
  ).bind(await hashToken(token), userId, nowMs, nowMs + SESSION_MS).run()
  return {
    cookie: `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`,
  }
}

export async function purgeExpiredSessions(env: Env, nowMs: number): Promise<number> {
  const result = await env.DB.prepare('DELETE FROM sessions WHERE expires_at_ms <= ?')
    .bind(nowMs).run()
  return result.meta.changes
}

export async function readSession(
  request: Request,
  env: Env,
  nowMs: number,
): Promise<SessionPrincipal | null> {
  const token = readToken(request)
  if (!token) return null

  const tokenHash = await hashToken(token)
  const row = await env.DB.prepare(
    `SELECT u.id AS user_id, u.auth_type, u.display_name, s.expires_at_ms
     FROM sessions AS s JOIN users AS u ON u.id = s.user_id
     WHERE s.token_hash = ?`,
  ).bind(tokenHash).first<{
    user_id: string
    auth_type: SessionPrincipal['authType']
    display_name: string
    expires_at_ms: number
  }>()

  if (!row) return null
  if (row.expires_at_ms <= nowMs) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ? AND expires_at_ms <= ?')
      .bind(tokenHash, nowMs).run()
    return null
  }
  return { userId: row.user_id, authType: row.auth_type, displayName: row.display_name }
}

export async function requireSession(
  request: Request,
  env: Env,
  nowMs: number,
): Promise<SessionPrincipal> {
  const principal = await readSession(request, env, nowMs)
  if (!principal) throw new ApiFailure(401, 'unauthorized', 'Sign in to continue.')
  return principal
}

export async function getSessionDto(env: Env, principal: SessionPrincipal): Promise<SessionDto> {
  return {
    user: {
      id: principal.userId,
      authType: principal.authType,
      displayName: principal.displayName,
    },
    progress: await readProgress(env.DB, principal.userId),
  }
}

export async function clearSession(request: Request, env: Env): Promise<Response> {
  const token = readToken(request)
  if (token) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(await hashToken(token)).run()
  }
  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store',
      'Set-Cookie': `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
    },
  })
}
