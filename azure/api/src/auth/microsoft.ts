import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { createLocalJWKSet, decodeJwt, jwtVerify, type JWK } from 'jose'
import type { AzureConfig } from '../config.js'
import { normalizeDisplayName } from '../cosmosStore.js'
import type { AzureStore } from '../model.js'
import { MICROSOFT_SCOPE } from '../model.js'
import { ApiFailure, issueSession } from './session.js'

const AUTHORITY = 'https://login.microsoftonline.com'
const AUTHORIZE_URL = `${AUTHORITY}/common/oauth2/v2.0/authorize`
const TOKEN_URL = `${AUTHORITY}/common/oauth2/v2.0/token`
const OAUTH_COOKIE = '__Host-maze_azure_oauth'
const FLOW_SECONDS = 600
const TENANT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/

export interface MicrosoftIdentity {
  tid: string
  sub: string
  displayName: string
}

function randomValue(): string {
  return randomBytes(32).toString('base64url')
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function codeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier, 'utf8').digest('base64url')
}

function oauthConfig(config: AzureConfig): {
  clientId: string
  clientSecret: string
  origin: string
  callbackUrl: string
} {
  const { microsoftClientId, microsoftClientSecret, publicOrigin } = config
  if (!microsoftClientId || !microsoftClientSecret || !publicOrigin) {
    throw new ApiFailure(503, 'microsoft_unavailable', 'Microsoft sign-in is unavailable.')
  }
  let url: URL
  try {
    url = new URL(publicOrigin)
  } catch {
    throw new ApiFailure(503, 'microsoft_unavailable', 'Microsoft sign-in is unavailable.')
  }
  if (
    url.origin !== publicOrigin ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) ||
    url.pathname !== '/' || url.search || url.hash || url.username || url.password
  ) {
    throw new ApiFailure(503, 'microsoft_unavailable', 'Microsoft sign-in is unavailable.')
  }
  return {
    clientId: microsoftClientId,
    clientSecret: microsoftClientSecret,
    origin: url.origin,
    callbackUrl: `${url.origin}/api/auth/microsoft/callback`,
  }
}

function oauthCookie(state: string): string {
  return `${OAUTH_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${FLOW_SECONDS}`
}

function clearedOauthCookie(): string {
  return `${OAUTH_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

function readOauthCookie(request: Request): string | null {
  const cookies = (request.headers.get('Cookie') ?? '').split(';')
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie.startsWith(`${OAUTH_COOKIE}=`))
  if (cookies.length !== 1) return null
  const state = cookies[0].slice(OAUTH_COOKIE.length + 1)
  return STATE_PATTERN.test(state) ? state : null
}

function sameState(a: string, b: string | null): boolean {
  if (!b || !STATE_PATTERN.test(a)) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

function redirect(location: string, cookies: string[]): Response {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' })
  for (const cookie of cookies) headers.append('Set-Cookie', cookie)
  return new Response(null, { status: 302, headers })
}

function failureRedirect(origin: string): Response {
  return redirect(`${origin}/?error=login_failed`, [clearedOauthCookie()])
}

export async function startMicrosoftLogin(
  request: Request,
  store: AzureStore,
  config: AzureConfig,
  nowMs: number,
): Promise<Response> {
  const { clientId, origin, callbackUrl } = oauthConfig(config)
  if (new URL(request.url).origin !== origin) {
    throw new ApiFailure(403, 'invalid_origin', 'Request origin is not allowed.')
  }
  const state = randomValue()
  const nonce = randomValue()
  const codeVerifier = randomValue()
  await store.putFlow({
    id: `f_${sha256(state)}`,
    scope: MICROSOFT_SCOPE,
    type: 'oauthFlow',
    nonce,
    codeVerifier,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + FLOW_SECONDS * 1000,
    ttl: FLOW_SECONDS,
  })
  const authorize = new URL(AUTHORIZE_URL)
  authorize.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: callbackUrl,
    response_mode: 'query',
    scope: 'openid profile',
    state,
    nonce,
    code_challenge: codeChallenge(codeVerifier),
    code_challenge_method: 'S256',
  }).toString()
  return redirect(authorize.href, [oauthCookie(state)])
}

export async function verifyMicrosoftIdToken(
  token: string,
  nonce: string,
  clientId: string,
  fetcher: typeof fetch = fetch,
): Promise<MicrosoftIdentity> {
  const unverified = decodeJwt(token)
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
  if (!document || typeof document !== 'object' || !('keys' in document) || !Array.isArray(document.keys)) {
    throw new Error('Invalid Microsoft signing keys.')
  }
  const keys = document.keys.filter((candidate: unknown): candidate is JWK => {
    if (!candidate || typeof candidate !== 'object') return false
    const key = candidate as Record<string, unknown>
    const keyIssuer = key.issuer
    return key.kty === 'RSA' && typeof key.kid === 'string' &&
      typeof key.n === 'string' && typeof key.e === 'string' &&
      (keyIssuer === issuer || keyIssuer === `${AUTHORITY}/{tenantid}/v2.0`) &&
      (key.use === undefined || key.use === 'sig') &&
      (key.alg === undefined || key.alg === 'RS256')
  })
  if (keys.length === 0) throw new Error('No trusted Microsoft signing key.')
  const { payload } = await jwtVerify(token, createLocalJWKSet({ keys }), {
    audience: clientId,
    issuer,
    algorithms: ['RS256'],
  })
  if (
    payload.tid !== tid || payload.aud !== clientId ||
    typeof payload.exp !== 'number' || payload.nonce !== nonce ||
    typeof payload.sub !== 'string' || !payload.sub.trim()
  ) {
    throw new Error('Invalid Microsoft ID token claims.')
  }
  return {
    tid,
    sub: payload.sub,
    displayName: normalizeDisplayName(typeof payload.name === 'string' ? payload.name : ''),
  }
}

export async function finishMicrosoftLogin(
  request: Request,
  store: AzureStore,
  config: AzureConfig,
  nowMs: number,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const { clientId, clientSecret, origin, callbackUrl } = oauthConfig(config)
  if (new URL(request.url).origin !== origin) return failureRedirect(origin)
  try {
    const query = new URL(request.url).searchParams
    const state = query.get('state') ?? ''
    if (!sameState(state, readOauthCookie(request))) throw new Error('Invalid OAuth state.')
    const flow = await store.takeFlow(`f_${sha256(state)}`, nowMs)
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
        code_verifier: flow.codeVerifier,
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
    const user = await store.getOrCreateMicrosoftUser(account.tid, account.sub, account.displayName, nowMs)
    const sessionCookie = await issueSession(store, user.id, nowMs)
    return redirect(`${origin}/`, [clearedOauthCookie(), sessionCookie])
  } catch {
    return failureRedirect(origin)
  }
}
