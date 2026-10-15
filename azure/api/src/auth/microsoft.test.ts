// @vitest-environment node
import { createHash } from 'node:crypto'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { AzureConfig } from '../config'
import type { AzureStore, OAuthFlowDoc, SessionDoc, UserDoc } from '../model'
import { MICROSOFT_SCOPE, UNRANKED_TIME_SECONDS } from '../model'
import { finishMicrosoftLogin, startMicrosoftLogin, verifyMicrosoftIdToken } from './microsoft'

const tid = '11111111-2222-3333-4444-555555555555'
const issuer = `https://login.microsoftonline.com/${tid}/v2.0`
const config: AzureConfig = {
  cosmosEndpoint: 'https://cosmos.example/', cosmosKey: 'unused', cosmosDatabase: 'maze-rescue',
  publicOrigin: 'https://game.example', microsoftClientId: 'client-id', microsoftClientSecret: 'server-secret',
}
const now = Date.now()
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey']
let publicJwk: Awaited<ReturnType<typeof exportJWK>>

beforeAll(async () => {
  const keys = await generateKeyPair('RS256', { extractable: true })
  privateKey = keys.privateKey
  publicJwk = { ...await exportJWK(keys.publicKey), kid: 'test-key', use: 'sig', alg: 'RS256' }
})

function storeFixture() {
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
      if (user) return user = { ...user, displayName: name }
      user = {
        id: 'u_microsoft', scope: MICROSOFT_SCOPE, type: 'user', tid: tenant, sub,
        displayName: name, unlockedStage: 1, highestStage: 0, bestTimeSeconds: null,
        rankTimeSeconds: UNRANKED_TIME_SECONDS, stageRecords: {}, createdAtMs: now, updatedAtMs: now,
      }
      return user
    },
    putSession: async (doc: SessionDoc) => { sessions.set(doc.id, doc) },
  } as AzureStore
  return { store, flows, sessions, user: () => user }
}

async function signedToken(nonce: string, claims: Record<string, unknown> = {}): Promise<string> {
  return new SignJWT({ tid, nonce, name: '  Alice\u0000 Smith  ', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject('microsoft-subject')
    .setIssuer(issuer)
    .setAudience(config.microsoftClientId)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey)
}

function keyFetcher(keyIssuer = `https://login.microsoftonline.com/{tenantid}/v2.0`): typeof fetch {
  return vi.fn(async () => Response.json({ keys: [{ ...publicJwk, issuer: keyIssuer }] })) as typeof fetch
}

function callback(state: string, code = 'auth-code'): Request {
  return new Request(`https://game.example/api/auth/microsoft/callback?state=${state}&code=${code}`, {
    headers: { Cookie: `__Host-maze_azure_oauth=${state}` },
  })
}

describe('Azure Microsoft OIDC', () => {
  it('starts with random state, nonce and PKCE, storing only a state hash', async () => {
    const { store, flows } = storeFixture()
    const response = await startMicrosoftLogin(new Request('https://game.example/api/auth/microsoft/start'), store, config, now)
    const authorize = new URL(response.headers.get('Location')!)
    const state = authorize.searchParams.get('state')!
    const flow = [...flows.values()][0]
    expect(response.status).toBe(302)
    expect(authorize.origin).toBe('https://login.microsoftonline.com')
    expect(authorize.pathname).toBe('/common/oauth2/v2.0/authorize')
    expect(authorize.searchParams.get('redirect_uri')).toBe('https://game.example/api/auth/microsoft/callback')
    expect(authorize.searchParams.get('scope')).toBe('openid profile')
    expect(authorize.searchParams.get('code_challenge_method')).toBe('S256')
    expect(authorize.searchParams.get('code_challenge')).toBe(createHash('sha256').update(flow.codeVerifier).digest('base64url'))
    expect(flow).toMatchObject({ id: `f_${createHash('sha256').update(state).digest('hex')}`, scope: MICROSOFT_SCOPE, ttl: 600, expiresAtMs: now + 600000 })
    expect(flow.nonce).toBe(authorize.searchParams.get('nonce'))
    expect(response.headers.get('Set-Cookie')).toContain(`__Host-maze_azure_oauth=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`)
    expect(JSON.stringify(flow)).not.toContain(state)
  })

  it('rejects unavailable configuration and an unexpected origin', async () => {
    const { store } = storeFixture()
    await expect(startMicrosoftLogin(new Request('https://game.example/start'), store,
      { ...config, microsoftClientSecret: '' }, now)).rejects.toMatchObject({ status: 503, code: 'microsoft_unavailable' })
    await expect(startMicrosoftLogin(new Request('https://other.example/start'), store, config, now))
      .rejects.toMatchObject({ status: 403, code: 'invalid_origin' })
  })

  it('validates signature, audience, issuer, nonce and key issuer', async () => {
    const token = await signedToken('expected')
    expect(await verifyMicrosoftIdToken(token, 'expected', config.microsoftClientId, keyFetcher()))
      .toEqual({ tid, sub: 'microsoft-subject', displayName: 'Alice Smith' })
    await expect(verifyMicrosoftIdToken(token, 'wrong', config.microsoftClientId, keyFetcher())).rejects.toThrow()
    await expect(verifyMicrosoftIdToken(token, 'expected', 'other-client', keyFetcher())).rejects.toThrow()
    await expect(verifyMicrosoftIdToken(token, 'expected', config.microsoftClientId,
      keyFetcher('https://other.example/issuer'))).rejects.toThrow()
    await expect(verifyMicrosoftIdToken(`${token}x`, 'expected', config.microsoftClientId, keyFetcher())).rejects.toThrow()
    const badIssuer = await new SignJWT({ tid, nonce: 'expected' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setSubject('sub')
      .setIssuer('https://other.example/issuer').setAudience(config.microsoftClientId)
      .setExpirationTime('1h').sign(privateKey)
    await expect(verifyMicrosoftIdToken(badIssuer, 'expected', config.microsoftClientId, keyFetcher())).rejects.toThrow()
    const expired = await new SignJWT({ tid, nonce: 'expected' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setSubject('sub')
      .setIssuer(issuer).setAudience(config.microsoftClientId)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1).sign(privateKey)
    await expect(verifyMicrosoftIdToken(expired, 'expected', config.microsoftClientId, keyFetcher())).rejects.toThrow()
    const noName = await signedToken('expected', { name: '' })
    expect((await verifyMicrosoftIdToken(noName, 'expected', config.microsoftClientId, keyFetcher())).displayName)
      .toBe('Microsoft 사용자')
  })

  it('exchanges an authorization code once and sets an independent session', async () => {
    const { store, flows, sessions, user } = storeFixture()
    const started = await startMicrosoftLogin(new Request('https://game.example/start'), store, config, now)
    const state = new URL(started.headers.get('Location')!).searchParams.get('state')!
    const nonce = [...flows.values()][0].nonce
    const idToken = await signedToken(nonce)
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).endsWith('/token')) {
        const body = init?.body as URLSearchParams
        expect(body.get('code')).toBe('auth-code')
        expect(body.get('client_secret')).toBe(config.microsoftClientSecret)
        expect(body.get('code_verifier')).toBeTruthy()
        return Response.json({ id_token: idToken })
      }
      return Response.json({ keys: [{ ...publicJwk, issuer: `https://login.microsoftonline.com/{tenantid}/v2.0` }] })
    }) as typeof fetch
    const response = await finishMicrosoftLogin(callback(state), store, config, now, fetcher)
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('https://game.example/')
    expect(response.headers.getSetCookie()).toHaveLength(2)
    expect(response.headers.getSetCookie()[0]).toContain('Max-Age=0')
    expect(response.headers.getSetCookie()[1]).toContain('__Host-maze_azure_session=')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(user()).toMatchObject({ tid, sub: 'microsoft-subject', displayName: 'Alice Smith' })
    expect(sessions.size).toBe(1)
    expect(flows.size).toBe(0)
    const replay = await finishMicrosoftLogin(callback(state), store, config, now, fetcher)
    expect(replay.headers.get('Location')).toContain('error=login_failed')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('rejects mismatched state and expired flows without token exchange', async () => {
    const { store, flows } = storeFixture()
    const started = await startMicrosoftLogin(new Request('https://game.example/start'), store, config, now)
    const state = new URL(started.headers.get('Location')!).searchParams.get('state')!
    const fetcher = vi.fn() as typeof fetch
    const mismatch = new Request(`https://game.example/api/auth/microsoft/callback?state=${state}&code=auth-code`, {
      headers: { Cookie: '__Host-maze_azure_oauth=wrong' },
    })
    expect((await finishMicrosoftLogin(mismatch, store, config, now, fetcher)).headers.get('Location'))
      .toContain('error=login_failed')
    expect((await finishMicrosoftLogin(callback(state), store, config, now + 600000, fetcher)).headers.get('Location'))
      .toContain('error=login_failed')
    expect(flows.size).toBe(1)
    expect(fetcher).not.toHaveBeenCalled()
  })
})
