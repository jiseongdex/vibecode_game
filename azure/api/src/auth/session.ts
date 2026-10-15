import { createHash, randomBytes } from 'node:crypto'
import type { AzureStore } from '../model.js'
import { MICROSOFT_SCOPE } from '../model.js'

// Mirrors the public SessionDto contract without pulling frontend sources into the API build.
interface SessionDto {
  user: { id: string; authType: 'microsoft'; displayName: string }
  progress: {
    unlockedStage: number
    stageRecords: Record<number, { bestTimeSeconds: number }>
  }
}

const COOKIE_NAME = '__Host-maze_azure_session'
const SESSION_SECONDS = 7 * 24 * 60 * 60
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export interface AzurePrincipal {
  userId: string
  displayName: string
  authType: 'microsoft'
}

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

function readToken(request: Request): string | null {
  const values = (request.headers.get('Cookie') ?? '').split(';')
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie.startsWith(`${COOKIE_NAME}=`))
  if (values.length !== 1) return null
  const token = values[0].slice(COOKIE_NAME.length + 1)
  return TOKEN_PATTERN.test(token) ? token : null
}

export function assertSameOriginJson(request: Request, publicOrigin: string): void {
  if (request.headers.get('Origin') !== publicOrigin || new URL(request.url).origin !== publicOrigin) {
    throw new ApiFailure(403, 'invalid_origin', 'Request origin is not allowed.')
  }
  const mediaType = request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase()
  if (mediaType !== 'application/json') {
    throw new ApiFailure(415, 'unsupported_media_type', 'Content-Type must be application/json.')
  }
}

export async function issueSession(store: AzureStore, userId: string, nowMs: number): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await store.putSession({
    id: `s_${tokenHash(token)}`,
    scope: MICROSOFT_SCOPE,
    type: 'session',
    userId,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + SESSION_SECONDS * 1000,
    ttl: SESSION_SECONDS,
  })
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`
}

export async function readSession(
  request: Request,
  store: AzureStore,
  nowMs: number,
): Promise<AzurePrincipal | null> {
  const token = readToken(request)
  if (!token) return null
  const session = await store.getSession(`s_${tokenHash(token)}`)
  if (!session || session.expiresAtMs <= nowMs) return null
  const user = await store.getUser(session.userId)
  if (!user) return null
  return { userId: user.id, displayName: user.displayName, authType: 'microsoft' }
}

export async function requireSession(
  request: Request,
  store: AzureStore,
  nowMs: number,
): Promise<AzurePrincipal> {
  const principal = await readSession(request, store, nowMs)
  if (!principal) throw new ApiFailure(401, 'unauthorized', 'Sign in to continue.')
  return principal
}

export async function sessionDto(store: AzureStore, principal: AzurePrincipal): Promise<SessionDto> {
  const user = await store.getUser(principal.userId)
  if (!user) throw new ApiFailure(401, 'unauthorized', 'Sign in to continue.')
  return {
    user: { id: user.id, authType: 'microsoft', displayName: user.displayName },
    progress: {
      unlockedStage: user.unlockedStage,
      stageRecords: Object.fromEntries(Object.entries(user.stageRecords).map(([stage, record]) => [
        Number(stage), { bestTimeSeconds: record.bestTimeSeconds },
      ])),
    },
  }
}

export async function clearSession(request: Request, store: AzureStore): Promise<Response> {
  const token = readToken(request)
  if (token) await store.deleteSession(`s_${tokenHash(token)}`)
  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store',
      'Set-Cookie': `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
    },
  })
}
