// @vitest-environment node
import { createHash } from 'node:crypto'
import { HttpRequest, type InvocationContext } from '@azure/functions'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { AzureConfigError, type AzureConfig } from './config'
import type { AzureStore, OAuthFlowDoc, SessionDoc, UserDoc } from './model'
import { MICROSOFT_SCOPE, UNRANKED_TIME_SECONDS } from './model'
import { createApiHandler, registerRoutes } from './index'
import { toFunctionResponse, toWebRequest } from './http'

const origin = 'https://azure.example'
const internalOrigin = 'http://localhost:7071'
const now = Date.now()
const tid = '11111111-2222-3333-4444-555555555555'
const config: AzureConfig = {
  cosmosEndpoint: 'https://cosmos.example', cosmosKey: 'secret', cosmosDatabase: 'maze-rescue',
  publicOrigin: origin, microsoftClientId: 'app-id', microsoftClientSecret: 'app-secret',
}
const context = {} as InvocationContext
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey']
let publicJwk: Awaited<ReturnType<typeof exportJWK>>

beforeAll(async () => {
  const keys = await generateKeyPair('RS256', { extractable: true })
  privateKey = keys.privateKey
  publicJwk = { ...await exportJWK(keys.publicKey), kid: 'test-key', use: 'sig', alg: 'RS256' }
})

function fixture() {
  const flows = new Map<string, OAuthFlowDoc>()
  const sessions = new Map<string, SessionDoc>()
  let user: UserDoc | null = null
  const store = {
    putFlow: async (doc: OAuthFlowDoc) => { flows.set(doc.id, doc) },
    takeFlow: async (id: string, time: number) => {
      const flow = flows.get(id)
      if (!flow || flow.expiresAtMs <= time) return null
      flows.delete(id)
      return flow
    },
    getOrCreateMicrosoftUser: async (tenant: string, sub: string, name: string) => {
      user = user ? { ...user, displayName: name } : {
        id: 'u_test', scope: MICROSOFT_SCOPE, type: 'user', tid: tenant, sub, displayName: name,
        unlockedStage: 1, highestStage: 0, bestTimeSeconds: null,
        rankTimeSeconds: UNRANKED_TIME_SECONDS, stageRecords: {}, createdAtMs: now, updatedAtMs: now,
      }
      return user
    },
    putSession: async (doc: SessionDoc) => { sessions.set(doc.id, doc) },
    getSession: async (id: string) => sessions.get(id) ?? null,
    deleteSession: async (id: string) => { sessions.delete(id) },
    getUser: async (id: string) => user?.id === id ? user : null,
    topUsers: async () => user ? [user] : [],
    countBetterUsers: async () => 0,
  } as AzureStore
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    if (String(input).endsWith('/token')) {
      const flow = [...flows.values()][0]
      // The flow is consumed before exchange, so the test sets its nonce in token() below.
      if (flow) throw new Error('OAuth flow was not consumed.')
      return Response.json({ id_token: idToken })
    }
    return Response.json({ keys: [{ ...publicJwk, issuer: 'https://login.microsoftonline.com/{tenantid}/v2.0' }] })
  }) as typeof fetch
  let idToken = ''
  const handler = createApiHandler({ config: () => config, store: () => store, now: () => now, fetcher })
  return { handler, store, flows, sessions, fetcher, setToken: (token: string) => { idToken = token } }
}

function request(path: string, method = 'GET', options: { origin?: string; cookie?: string; body?: string; contentType?: string } = {}): HttpRequest {
  return new HttpRequest({
    method,
    url: `${internalOrigin}${path}`,
    headers: {
      ...(options.origin ? { Origin: options.origin } : {}),
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...(options.contentType ? { 'Content-Type': options.contentType } : {}),
    },
    ...(options.body !== undefined ? { body: { string: options.body } } : {}),
  })
}

function body(response: { body?: unknown }): unknown {
  return JSON.parse(response.body as string)
}

describe('Azure Functions HTTP adapter', () => {
  it('registers only the intended anonymous HTTP routes plus a JSON 404 fallback', () => {
    const registrations: Array<{ name: string; options: { route?: string; methods?: string[]; authLevel?: string } }> = []
    registerRoutes(((name: string, options: { route?: string; methods?: string[]; authLevel?: string }) => {
      registrations.push({ name, options })
    }) as typeof import('@azure/functions').app.http)
    expect(registrations.map(({ options }) => [options.route, options.methods])).toEqual([
      ['health', ['GET']], ['auth/microsoft/start', ['GET']], ['auth/microsoft/callback', ['GET']],
      ['auth/logout', ['POST']], ['me', ['GET']], ['leaderboard', ['GET']],
      ['runs/start', ['POST']], ['runs/finish', ['POST']],
      ['{*path}', ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']],
    ])
    expect(registrations.every(({ options }) => options.authLevel === 'anonymous')).toBe(true)
    expect(registrations.some(({ options }) => options.route?.includes('simple'))).toBe(false)
  })

  it('rebuilds the public URL without trusting the internal host and preserves request headers', async () => {
    const web = await toWebRequest(request('/api/runs/start?stage=2', 'POST', {
      origin, cookie: 'session=abc', contentType: 'application/json', body: '{"stage":2}',
    }), origin)
    expect(web.url).toBe(`${origin}/api/runs/start?stage=2`)
    expect(web.headers.get('Origin')).toBe(origin)
    expect(web.headers.get('Cookie')).toBe('session=abc')
    expect(await web.json()).toEqual({ stage: 2 })
  })

  it('routes health, rejects unauthenticated routes, and does not expose simple login', async () => {
    const { handler } = fixture()
    const health = await handler(request('/api/health'), context)
    expect(health.status).toBe(200)
    expect(body(health)).toEqual({ status: 'ok' })
    for (const path of ['/api/me', '/api/leaderboard']) {
      const result = await handler(request(path), context)
      expect(result.status).toBe(401)
      expect(body(result)).toMatchObject({ error: { code: 'unauthorized' } })
    }
    for (const path of ['/api/runs/start', '/api/runs/finish']) {
      const result = await handler(request(path, 'POST', { origin, contentType: 'application/json', body: '{}' }), context)
      expect(result.status).toBe(401)
    }
    const simple = await handler(request('/api/auth/simple/login', 'POST'), context)
    expect(simple.status).toBe(404)
    expect(body(simple)).toMatchObject({ error: { code: 'not_found' } })
    expect((await handler(request('/api/me', 'POST'), context)).status).toBe(404)
  })

  it('enforces origin, JSON media type, and a 4KB body limit', async () => {
    const { handler } = fixture()
    const wrongOrigin = await handler(request('/api/auth/logout', 'POST', { origin: 'https://other.example', contentType: 'application/json', body: '{}' }), context)
    expect(wrongOrigin.status).toBe(403)
    const wrongType = await handler(request('/api/auth/logout', 'POST', { origin, contentType: 'text/plain', body: '{}' }), context)
    expect(wrongType.status).toBe(415)
    const tooLarge = await handler(request('/api/auth/logout', 'POST', { origin, contentType: 'application/json', body: 'x'.repeat(4097) }), context)
    expect(tooLarge.status).toBe(413)
    expect(body(tooLarge)).toMatchObject({ error: { code: 'payload_too_large' } })
    expect((tooLarge.headers as Headers).get('Cache-Control')).toBe('no-store')
  })

  it('preserves two callback cookies and clears the session cookie on logout', async () => {
    const { handler, flows, sessions, setToken } = fixture()
    const start = await handler(request('/api/auth/microsoft/start'), context)
    expect(start.status).toBe(302)
    const authorize = new URL((start.headers as Headers).get('Location')!)
    const state = authorize.searchParams.get('state')!
    const flow = flows.get(`f_${createHash('sha256').update(state).digest('hex')}`)!
    expect(start.cookies).toMatchObject([{ name: '__Host-maze_azure_oauth', value: state, httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 600 }])
    setToken(await new SignJWT({ tid, nonce: flow.nonce, name: 'Azure Player' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setSubject('sub')
      .setIssuer(`https://login.microsoftonline.com/${tid}/v2.0`).setAudience(config.microsoftClientId)
      .setIssuedAt().setExpirationTime('1h').sign(privateKey))
    const callback = await handler(request(`/api/auth/microsoft/callback?state=${state}&code=abc`, 'GET', {
      cookie: `__Host-maze_azure_oauth=${state}`,
    }), context)
    expect(callback.status).toBe(302)
    expect((callback.headers as Headers).get('Location')).toBe(`${origin}/microsoft`)
    expect(callback.cookies).toHaveLength(2)
    expect(callback.cookies?.[0]).toMatchObject({ name: '__Host-maze_azure_oauth', maxAge: 0 })
    expect(callback.cookies?.[1]).toMatchObject({ name: '__Host-maze_azure_session', httpOnly: true, secure: true, sameSite: 'Lax' })
    expect(sessions.size).toBe(1)
    const sessionCookie = `${callback.cookies![1].name}=${callback.cookies![1].value}`
    const me = await handler(request('/api/me', 'GET', { cookie: sessionCookie }), context)
    expect(me.status).toBe(200)
    expect(body(me)).toMatchObject({ user: { displayName: 'Azure Player', authType: 'microsoft' } })
    const logout = await handler(request('/api/auth/logout', 'POST', {
      origin, contentType: 'application/json', cookie: sessionCookie, body: '{}',
    }), context)
    expect(logout.status).toBe(204)
    expect(logout.cookies).toMatchObject([{ name: '__Host-maze_azure_session', maxAge: 0 }])
    expect(sessions.size).toBe(0)
  })

  it('separates configuration failures from unknown errors without leaking secrets', async () => {
    const { store } = fixture()
    const unavailable = createApiHandler({ config: () => { throw new Error('wrong') }, store: () => store })
    const internal = await unavailable(request('/api/me'), context)
    expect(internal.status).toBe(500)
    expect(JSON.stringify(body(internal))).not.toContain('wrong')
    const noConfig = createApiHandler({ config: () => { throw new AzureConfigError() }, store: () => store })
    const unavailableResponse = await noConfig(request('/api/me'), context)
    expect(unavailableResponse.status).toBe(503)
    expect(body(unavailableResponse)).toMatchObject({ error: { code: 'service_unavailable' } })
  })

  it('maps each Set-Cookie separately to Functions cookies', async () => {
    const headers = new Headers({ Location: `${origin}/microsoft`, 'Cache-Control': 'no-store' })
    headers.append('Set-Cookie', '__Host-maze_azure_oauth=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0')
    headers.append('Set-Cookie', '__Host-maze_azure_session=token; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800')
    const result = await toFunctionResponse(new Response(null, { status: 302, headers }))
    expect(result.cookies).toHaveLength(2)
    expect((result.headers as Headers).has('Set-Cookie')).toBe(false)
  })
})
