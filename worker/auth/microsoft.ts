import { createLocalJWKSet, decodeJwt, jwtVerify, type JWK } from 'jose'
import type { Env } from '../types'
import { ApiFailure, issueSession } from './session'

const AUTHORITY = 'https://login.microsoftonline.com'
const AUTHORIZE_URL = `${AUTHORITY}/common/oauth2/v2.0/authorize`
const TOKEN_URL = `${AUTHORITY}/common/oauth2/v2.0/token`
const OAUTH_COOKIE = '__Host-maze_oauth'
const FLOW_SECONDS = 600
const FLOW_MS = FLOW_SECONDS * 1000
const TENANT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/
const encoder = new TextEncoder()

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function randomValue(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)))
}

async function sha256(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', encoder.encode(value))
}

async function stateHash(state: string): Promise<string> {
  return Array.from(new Uint8Array(await sha256(state)), (byte) =>
    byte.toString(16).padStart(2, '0')).join('')
}

function config(env: Env): {
  clientId: string
  clientSecret: string
  origin: string
  callbackUrl: string
} {
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET || !env.PUBLIC_ORIGIN) {
    throw new ApiFailure(503, 'microsoft_unavailable', 'Microsoft sign-in is unavailable.')
  }
  let publicUrl: URL
  try {
    publicUrl = new URL(env.PUBLIC_ORIGIN)
  } catch {
    throw new ApiFailure(503, 'microsoft_unavailable', 'Microsoft sign-in is unavailable.')
  }
  if (
    (publicUrl.protocol !== 'https:' &&
      !(publicUrl.protocol === 'http:' && publicUrl.hostname === 'localhost')) ||
    publicUrl.pathname !== '/' || publicUrl.search || publicUrl.hash ||
    publicUrl.username || publicUrl.password
  ) {
    throw new ApiFailure(503, 'microsoft_unavailable', 'Microsoft sign-in is unavailable.')
  }
  return {
    clientId: env.MICROSOFT_CLIENT_ID,
    clientSecret: env.MICROSOFT_CLIENT_SECRET,
    origin: publicUrl.origin,
    callbackUrl: new URL('/api/auth/microsoft/callback', publicUrl.origin).href,
  }
}

function oauthCookie(state: string): string {
  return `${OAUTH_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${FLOW_SECONDS}`
}

function clearedOauthCookie(): string {
  return `${OAUTH_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

function readOauthCookie(request: Request): string | null {
  const cookies = request.headers.get('Cookie')?.split(';') ?? []
  const value = cookies.map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${OAUTH_COOKIE}=`))
    ?.slice(OAUTH_COOKIE.length + 1)
  return value && STATE_PATTERN.test(value) ? value : null
}

function redirect(location: string, cookies: string[]): Response {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' })
  for (const cookie of cookies) headers.append('Set-Cookie', cookie)
  return new Response(null, { status: 302, headers })
}

function failureRedirect(origin: string): Response {
  return redirect(`${origin}/microsoft?error=login_failed`, [clearedOauthCookie()])
}

export async function startMicrosoftLogin(
  request: Request,
  env: Env,
  nowMs: number,
): Promise<Response> {
  const { clientId, origin, callbackUrl } = config(env)
  if (new URL(request.url).origin !== origin) {
    throw new ApiFailure(403, 'invalid_origin', 'Request origin is not allowed.')
  }

  const state = randomValue()
  const nonce = randomValue()
  const codeVerifier = randomValue()
  const codeChallenge = base64url(new Uint8Array(await sha256(codeVerifier)))
  await env.DB.prepare('DELETE FROM oauth_flows WHERE expires_at_ms <= ?').bind(nowMs).run()
  await env.DB.prepare(
    `INSERT INTO oauth_flows (state_hash, nonce, code_verifier, created_at_ms, expires_at_ms)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(await stateHash(state), nonce, codeVerifier, nowMs, nowMs + FLOW_MS).run()

  const authorize = new URL(AUTHORIZE_URL)
  authorize.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: callbackUrl,
    response_mode: 'query',
    scope: 'openid profile',
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  }).toString()
  return redirect(authorize.href, [oauthCookie(state)])
}

export async function verifyMicrosoftIdToken(
  idToken: string,
  expectedNonce: string,
  clientId: string,
  fetcher: typeof fetch = fetch,
): Promise<{ tid: string; sub: string; displayName: string }> {
  const unverified = decodeJwt(idToken)
  const tid = unverified.tid
  if (typeof tid !== 'string' || !TENANT_ID_PATTERN.test(tid)) {
    throw new Error('Invalid Microsoft tenant.')
  }

  const issuer = `${AUTHORITY}/${tid}/v2.0`
  const keysResponse = await fetcher(`${AUTHORITY}/${tid}/discovery/v2.0/keys`, {
    headers: { Accept: 'application/json' },
    redirect: 'error',
  })
  if (!keysResponse.ok) throw new Error('Microsoft signing keys are unavailable.')
  const document: unknown = await keysResponse.json()
  if (!document || typeof document !== 'object' || !('keys' in document) ||
    !Array.isArray(document.keys)) {
    throw new Error('Invalid Microsoft signing keys.')
  }

  // Microsoft scopes some keys to one tenant, and others to a tenant template.
  const keys = document.keys.filter((candidate: unknown): candidate is JWK => {
    if (!candidate || typeof candidate !== 'object') return false
    const key = candidate as Record<string, unknown>
    const keyIssuer = key.issuer
    const scopedIssuer = typeof keyIssuer === 'string'
      ? keyIssuer.replace('{tenantid}', tid)
      : null
    return key.kty === 'RSA' && typeof key.kid === 'string' &&
      typeof key.n === 'string' && typeof key.e === 'string' &&
      scopedIssuer === issuer &&
      (key.use === undefined || key.use === 'sig') &&
      (key.alg === undefined || key.alg === 'RS256')
  })
  if (keys.length === 0) throw new Error('No trusted Microsoft signing key.')

  const { payload } = await jwtVerify(idToken, createLocalJWKSet({ keys }), {
    audience: clientId,
    issuer,
    algorithms: ['RS256'],
  })
  if (
    payload.tid !== tid || payload.aud !== clientId ||
    typeof payload.exp !== 'number' ||
    payload.nonce !== expectedNonce ||
    typeof payload.sub !== 'string' || !payload.sub.trim()
  ) {
    throw new Error('Invalid Microsoft ID token claims.')
  }
  const displayName = typeof payload.name === 'string' && payload.name.trim()
    ? payload.name.trim()
    : 'Microsoft 사용자'
  return { tid, sub: payload.sub, displayName }
}

export async function finishMicrosoftLogin(
  request: Request,
  env: Env,
  nowMs: number,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const { clientId, clientSecret, origin, callbackUrl } = config(env)
  if (new URL(request.url).origin !== origin) return failureRedirect(origin)

  try {
    const query = new URL(request.url).searchParams
    const state = query.get('state')
    const cookieState = readOauthCookie(request)
    if (!state || !STATE_PATTERN.test(state) || state !== cookieState) {
      throw new Error('Invalid OAuth state.')
    }

    const flow = await env.DB.prepare(
      'DELETE FROM oauth_flows WHERE state_hash = ? AND expires_at_ms > ? RETURNING nonce, code_verifier',
    ).bind(await stateHash(state), nowMs).first<{ nonce: string; code_verifier: string }>()
    if (!flow || query.has('error')) throw new Error('OAuth flow failed.')
    const code = query.get('code')
    if (!code) throw new Error('Missing authorization code.')

    const tokenResponse = await fetcher(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        code_verifier: flow.code_verifier,
      }),
      redirect: 'error',
    })
    if (!tokenResponse.ok) throw new Error('Microsoft token exchange failed.')
    const tokenBody: unknown = await tokenResponse.json()
    if (!tokenBody || typeof tokenBody !== 'object' || !('id_token' in tokenBody) ||
      typeof tokenBody.id_token !== 'string') {
      throw new Error('Missing Microsoft ID token.')
    }

    const account = await verifyMicrosoftIdToken(tokenBody.id_token, flow.nonce, clientId, fetcher)
    const newId = crypto.randomUUID()
    const user = await env.DB.prepare(
      `INSERT INTO users (
        id, auth_type, display_name, microsoft_tid, microsoft_sub, created_at_ms, updated_at_ms
      ) VALUES (?, 'microsoft', ?, ?, ?, ?, ?)
      ON CONFLICT(microsoft_tid, microsoft_sub) DO UPDATE SET
        display_name = excluded.display_name,
        updated_at_ms = excluded.updated_at_ms
      RETURNING id`,
    ).bind(newId, account.displayName, account.tid, account.sub, nowMs, nowMs)
      .first<{ id: string }>()
    if (!user) throw new Error('Microsoft account could not be saved.')

    const { cookie } = await issueSession(env, user.id, nowMs)
    return redirect(`${origin}/microsoft`, [clearedOauthCookie(), cookie])
  } catch {
    return failureRedirect(origin)
  }
}
