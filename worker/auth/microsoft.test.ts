// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose'
import { createTestEnv, type TestEnv } from '../test/createTestEnv'
import { finishMicrosoftLogin, verifyMicrosoftIdToken } from './microsoft'

const ORIGIN = 'http://localhost'
const CLIENT_ID = '00000000-0000-4000-8000-000000000001'
const PERSONAL_TID = '9188040d-6c67-4c5b-b112-36a304b66dad'
const ORG_TID = '12345678-1234-4234-8234-123456789abc'
const activeEnvironments: TestEnv[] = []

async function setup(options?: Parameters<typeof createTestEnv>[0]): Promise<TestEnv> {
  const testEnv = await createTestEnv(options)
  activeEnvironments.push(testEnv)
  return testEnv
}

async function signingKey(): Promise<{ privateKey: CryptoKey; publicJwk: JWK }> {
  const keys = await generateKeyPair('RS256', { extractable: true })
  return { privateKey: keys.privateKey, publicJwk: await exportJWK(keys.publicKey) }
}

async function signedIdToken(
  privateKey: CryptoKey,
  nonce: string,
  tid: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000)
  return new SignJWT({
    iss: `https://login.microsoftonline.com/${tid}/v2.0`,
    aud: CLIENT_ID,
    sub: 'same-subject',
    tid,
    nonce,
    name: 'Shared_Name',
    iat: issuedAt,
    exp: issuedAt + 600,
    ...overrides,
  }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).sign(privateKey)
}

function fakeMicrosoftFetch(
  idToken: string,
  publicJwk: JWK,
  keyIssuer = 'https://login.microsoftonline.com/{tenantid}/v2.0',
  tokenStatus = 200,
): { fetcher: typeof fetch; requests: Array<{ url: string; body: string | null }> } {
  const requests: Array<{ url: string; body: string | null }> = []
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input)
    const body = init?.body instanceof URLSearchParams ? init.body.toString() : null
    requests.push({ url, body })
    if (url === 'https://login.microsoftonline.com/common/oauth2/v2.0/token') {
      return Response.json(tokenStatus === 200 ? { id_token: idToken, access_token: 'never-store-me' } : {}, {
        status: tokenStatus,
      })
    }
    if (/^https:\/\/login\.microsoftonline\.com\/[0-9a-f-]+\/discovery\/v2\.0\/keys$/.test(url)) {
      return Response.json({ keys: [{ ...publicJwk, kid: 'test-key', use: 'sig', alg: 'RS256', issuer: keyIssuer }] })
    }
    throw new Error(`Unexpected Microsoft URL: ${url}`)
  }) as typeof fetch
  return { fetcher, requests }
}

async function begin(testEnv: TestEnv): Promise<{
  state: string
  nonce: string
  cookie: string
  authorize: URL
}> {
  const start = await testEnv.fetch(new Request(`${ORIGIN}/api/auth/microsoft/start`))
  expect(start.status).toBe(302)
  expect(start.headers.get('Cache-Control')).toBe('no-store')
  const authorize = new URL(start.headers.get('Location')!)
  const state = authorize.searchParams.get('state')!
  const nonce = authorize.searchParams.get('nonce')!
  const cookie = start.headers.get('Set-Cookie')!.split(';', 1)[0]
  return { state, nonce, cookie, authorize }
}

function callback(state: string, cookie: string, params = ''): Request {
  return new Request(
    `${ORIGIN}/api/auth/microsoft/callback?state=${encodeURIComponent(state)}&code=test-code${params}`,
    { headers: { Cookie: cookie } },
  )
}

afterEach(async () => {
  await Promise.all(activeEnvironments.splice(0).map(({ dispose }) => dispose()))
})

describe('Microsoft login', () => {
  it('starts a one-time code flow with PKCE, nonce, fixed callback and state cookie', async () => {
    const testEnv = await setup()
    const { state, nonce, cookie, authorize } = await begin(testEnv)

    expect(authorize.origin).toBe('https://login.microsoftonline.com')
    expect(authorize.pathname).toBe('/common/oauth2/v2.0/authorize')
    expect(Object.fromEntries(authorize.searchParams)).toMatchObject({
      client_id: CLIENT_ID,
      response_type: 'code',
      response_mode: 'query',
      scope: 'openid profile',
      redirect_uri: `${ORIGIN}/api/auth/microsoft/callback`,
      code_challenge_method: 'S256',
      state,
      nonce,
    })
    expect(authorize.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(cookie).toBe(`__Host-maze_oauth=${state}`)
    const flow = await testEnv.env.DB.prepare('SELECT state_hash, code_verifier, expires_at_ms, created_at_ms FROM oauth_flows')
      .first<{ state_hash: string; code_verifier: string; expires_at_ms: number; created_at_ms: number }>()
    expect(flow!.state_hash).not.toBe(state)
    expect(flow!.code_verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(flow!.expires_at_ms - flow!.created_at_ms).toBe(600_000)

    const missing = await setup({ microsoft: null })
    expect((await missing.fetch(new Request(`${ORIGIN}/api/auth/microsoft/start`))).status).toBe(503)
  })

  it('keeps personal and organization subjects distinct and separate from simple accounts', async () => {
    const testEnv = await setup()
    const { privateKey, publicJwk } = await signingKey()

    async function signIn(tid: string): Promise<string> {
      const { state, nonce, cookie } = await begin(testEnv)
      const token = await signedIdToken(privateKey, nonce, tid)
      const fake = fakeMicrosoftFetch(token, publicJwk)
      const response = await finishMicrosoftLogin(callback(state, cookie), testEnv.env, Date.now(), fake.fetcher)
      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toBe(`${ORIGIN}/microsoft`)
      expect(response.headers.get('Set-Cookie')).toContain('__Host-maze_session=')
      expect(response.headers.get('Set-Cookie')).toContain('__Host-maze_oauth=;')
      const tokenRequest = fake.requests.find(({ url }) => url.endsWith('/token'))!
      const form = new URLSearchParams(tokenRequest.body!)
      expect(form.get('client_secret')).toBe('test-only-microsoft-secret')
      expect(form.get('redirect_uri')).toBe(`${ORIGIN}/api/auth/microsoft/callback`)
      expect(form.get('code_verifier')).toMatch(/^[A-Za-z0-9_-]{43}$/)
      const row = await testEnv.env.DB.prepare(
        'SELECT id FROM users WHERE microsoft_tid = ? AND microsoft_sub = ?',
      ).bind(tid, 'same-subject').first<{ id: string }>()
      return row!.id
    }

    const personalId = await signIn(PERSONAL_TID)
    const organizationId = await signIn(ORG_TID)
    expect(organizationId).not.toBe(personalId)
    const simpleMatch = await testEnv.fetch(new Request(`${ORIGIN}/api/auth/simple/register`, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Shared_Name', pin: '0042' }),
    }))
    expect(simpleMatch.status).toBe(200)
    const accountTypes = await testEnv.env.DB.prepare(
      'SELECT auth_type FROM users ORDER BY auth_type',
    ).all<{ auth_type: string }>()
    expect(accountTypes.results.map(({ auth_type }) => auth_type)).toEqual(['microsoft', 'microsoft', 'simple'])
  })

  it('reuses an existing Microsoft user while updating the display name and preserving progress', async () => {
    const testEnv = await setup()
    const { privateKey, publicJwk } = await signingKey()
    const first = await begin(testEnv)
    const firstToken = await signedIdToken(privateKey, first.nonce, PERSONAL_TID, { name: 'First Name' })
    expect((await finishMicrosoftLogin(callback(first.state, first.cookie), testEnv.env, Date.now(),
      fakeMicrosoftFetch(firstToken, publicJwk).fetcher)).status).toBe(302)
    const original = await testEnv.env.DB.prepare(
      'SELECT id FROM users WHERE microsoft_tid = ? AND microsoft_sub = ?',
    ).bind(PERSONAL_TID, 'same-subject').first<{ id: string }>()
    await testEnv.env.DB.prepare('UPDATE users SET unlocked_stage = 3 WHERE id = ?').bind(original!.id).run()

    const second = await begin(testEnv)
    const secondToken = await signedIdToken(privateKey, second.nonce, PERSONAL_TID, { name: 'New Name' })
    expect((await finishMicrosoftLogin(callback(second.state, second.cookie), testEnv.env, Date.now(),
      fakeMicrosoftFetch(secondToken, publicJwk).fetcher)).status).toBe(302)
    const updated = await testEnv.env.DB.prepare(
      'SELECT id, display_name, unlocked_stage FROM users WHERE microsoft_tid = ? AND microsoft_sub = ?',
    ).bind(PERSONAL_TID, 'same-subject').first<{
      id: string; display_name: string; unlocked_stage: number
    }>()
    expect(updated).toMatchObject({ id: original!.id, display_name: 'New Name', unlocked_stage: 3 })
  })

  it('rejects mismatched, expired and reused OAuth state before token exchange', async () => {
    const testEnv = await setup()
    const { privateKey, publicJwk } = await signingKey()
    const flow = await begin(testEnv)
    const fake = fakeMicrosoftFetch(await signedIdToken(privateKey, flow.nonce, ORG_TID), publicJwk)
    const mismatch = await finishMicrosoftLogin(
      callback(flow.state, '__Host-maze_oauth=wrong'), testEnv.env, Date.now(), fake.fetcher,
    )
    expect(mismatch.headers.get('Location')).toBe(`${ORIGIN}/microsoft?error=login_failed`)
    expect(fake.requests).toHaveLength(0)

    const success = await finishMicrosoftLogin(callback(flow.state, flow.cookie), testEnv.env, Date.now(), fake.fetcher)
    expect(success.headers.get('Location')).toBe(`${ORIGIN}/microsoft`)
    const replay = await finishMicrosoftLogin(callback(flow.state, flow.cookie), testEnv.env, Date.now(), fake.fetcher)
    expect(replay.headers.get('Location')).toBe(`${ORIGIN}/microsoft?error=login_failed`)
    expect(fake.requests.filter(({ url }) => url.endsWith('/token'))).toHaveLength(1)

    const expired = await begin(testEnv)
    await testEnv.env.DB.prepare('UPDATE oauth_flows SET expires_at_ms = ?').bind(Date.now() - 1).run()
    const expiredResponse = await finishMicrosoftLogin(callback(expired.state, expired.cookie), testEnv.env,
      Date.now(), fake.fetcher)
    expect(expiredResponse.headers.get('Location')).toBe(`${ORIGIN}/microsoft?error=login_failed`)
    expect(fake.requests.filter(({ url }) => url.endsWith('/token'))).toHaveLength(1)
  })

  it('rejects token exchange and ID-token claim or signing-key failures without a session', async () => {
    const { privateKey, publicJwk } = await signingKey()
    const nonce = 'expected-nonce'
    const cases: Array<{ name: string; token: string; keyIssuer?: string }> = [
      { name: 'wrong audience', token: await signedIdToken(privateKey, nonce, ORG_TID, { aud: 'another-app' }) },
      { name: 'wrong issuer', token: await signedIdToken(privateKey, nonce, ORG_TID, { iss: 'https://evil.example' }) },
      { name: 'wrong nonce', token: await signedIdToken(privateKey, nonce, ORG_TID, { nonce: 'other' }) },
      { name: 'expired', token: await signedIdToken(privateKey, nonce, ORG_TID, { exp: 1 }) },
      { name: 'future nbf', token: await signedIdToken(privateKey, nonce, ORG_TID, { nbf: 4_102_444_800 }) },
      { name: 'wrong key issuer', token: await signedIdToken(privateKey, nonce, ORG_TID),
        keyIssuer: `https://login.microsoftonline.com/${PERSONAL_TID}/v2.0` },
      { name: 'bad tenant', token: await signedIdToken(privateKey, nonce, 'invalid-tenant') },
    ]
    const otherKey = await signingKey()
    cases.push({ name: 'bad signature', token: await signedIdToken(otherKey.privateKey, nonce, ORG_TID) })
    for (const testCase of cases) {
      await expect(verifyMicrosoftIdToken(testCase.token, nonce, CLIENT_ID,
        fakeMicrosoftFetch(testCase.token, publicJwk, testCase.keyIssuer).fetcher), testCase.name)
        .rejects.toThrow()
    }

    const testEnv = await setup()
    const flow = await begin(testEnv)
    const token = await signedIdToken(privateKey, flow.nonce, PERSONAL_TID)
    const failure = await finishMicrosoftLogin(callback(flow.state, flow.cookie), testEnv.env, Date.now(),
      fakeMicrosoftFetch(token, publicJwk, undefined, 400).fetcher)
    expect(failure.headers.get('Location')).toBe(`${ORIGIN}/microsoft?error=login_failed`)
    expect(failure.headers.get('Set-Cookie')).toContain('__Host-maze_oauth=;')
    expect(failure.headers.get('Set-Cookie')).not.toContain('__Host-maze_session=')
    const sessions = await testEnv.env.DB.prepare('SELECT count(*) AS total FROM sessions')
      .first<{ total: number }>()
    expect(sessions!.total).toBe(0)
  })
})
