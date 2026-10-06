// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { createTestEnv, type TestEnv } from '../test/createTestEnv'

const activeEnvironments: TestEnv[] = []
const ORIGIN = 'http://localhost'

async function setup(options?: { pinPepper?: string | null }): Promise<TestEnv> {
  const testEnv = await createTestEnv(options)
  activeEnvironments.push(testEnv)
  return testEnv
}

function post(path: string, nickname: unknown, pin: unknown, ip = '192.0.2.1'): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      'CF-Connecting-IP': ip,
    },
    body: JSON.stringify({ nickname, pin }),
  })
}

afterEach(async () => {
  await Promise.all(activeEnvironments.splice(0).map(({ dispose }) => dispose()))
})

describe('simple accounts', () => {
  it('registers a normalized nickname and stores only derived PIN data', async () => {
    const testEnv = await setup()
    const response = await testEnv.fetch(post('/api/auth/simple/register', '  Ａlpha  ', '0042'))

    expect(response.status).toBe(200)
    const dto = await response.json() as {
      user: { id: string; authType: string; displayName: string }
      progress: { unlockedStage: number; stageRecords: object }
    }
    expect(dto.user).toMatchObject({ authType: 'simple', displayName: 'Alpha' })
    expect(dto.progress).toEqual({ unlockedStage: 1, stageRecords: {} })

    const user = await testEnv.env.DB.prepare(
      'SELECT nickname_key, pin_salt, pin_hash FROM users WHERE id = ?',
    ).bind(dto.user.id).first<{ nickname_key: string; pin_salt: string; pin_hash: string }>()
    expect(user).toMatchObject({ nickname_key: 'alpha' })
    expect(atob(user!.pin_salt)).toHaveLength(16)
    expect(atob(user!.pin_hash)).toHaveLength(32)
    expect(user!.pin_hash).not.toContain('0042')
    expect(response.headers.get('Set-Cookie')).toContain('HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('rejects a duplicate nickname after case folding, and invalid input', async () => {
    const testEnv = await setup()
    expect((await testEnv.fetch(post('/api/auth/simple/register', 'Mouse_1', '0042'))).status).toBe(200)

    const duplicate = await testEnv.fetch(post('/api/auth/simple/register', 'mouse_1', '9876'))
    expect(duplicate.status).toBe(409)
    expect((await duplicate.json() as { error: { code: string } }).error.code).toBe('nickname_taken')
    expect((await testEnv.fetch(post('/api/auth/simple/register', 'Valid', 1234))).status).toBe(400)
    expect((await testEnv.fetch(post('/api/auth/simple/register', 'a space', '1234'))).status).toBe(400)
  })

  it('uses one login error for unknown names and wrong PINs, then throttles retries', async () => {
    const testEnv = await setup()
    await testEnv.fetch(post('/api/auth/simple/register', 'Rabbit', '0007'))

    const unknown = await testEnv.fetch(post('/api/auth/simple/login', 'Missing', '0007'))
    const wrong = await testEnv.fetch(post('/api/auth/simple/login', 'Rabbit', '9999'))
    expect(unknown.status).toBe(401)
    expect(wrong.status).toBe(401)
    expect(await unknown.json()).toEqual(await wrong.json())

    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect((await testEnv.fetch(post('/api/auth/simple/login', 'Rabbit', '9999'))).status).toBe(401)
    }
    expect((await testEnv.fetch(post('/api/auth/simple/login', 'Rabbit', '0007'))).status).toBe(429)

    const buckets = await testEnv.env.DB.prepare('SELECT bucket_key FROM auth_throttle').all<{ bucket_key: string }>()
    expect(buckets.results.some(({ bucket_key }) => bucket_key.includes('192.0.2.1'))).toBe(false)
  })

  it('allows re-login after a wrong PIN and clears the nickname failure bucket', async () => {
    const testEnv = await setup()
    await testEnv.fetch(post('/api/auth/simple/register', 'Hedgehog', '0100'))
    expect((await testEnv.fetch(post('/api/auth/simple/login', 'Hedgehog', '9999'))).status).toBe(401)

    const login = await testEnv.fetch(post('/api/auth/simple/login', 'hedgehog', '0100'))
    expect(login.status).toBe(200)
    expect((await login.json() as { user: { displayName: string } }).user.displayName).toBe('Hedgehog')
    const bucket = await testEnv.env.DB.prepare(
      "SELECT bucket_key FROM auth_throttle WHERE bucket_key = 'login-name:hedgehog'",
    ).first()
    expect(bucket).toBeNull()
  })

  it('blocks an IP after 30 failed logins while another IP can still sign in', async () => {
    const testEnv = await setup()
    await testEnv.fetch(post('/api/auth/simple/register', 'Fox', '0123'))
    expect((await testEnv.fetch(post('/api/auth/simple/login', 'Fox', '9999'))).status).toBe(401)
    const ipRow = await testEnv.env.DB.prepare(
      "SELECT bucket_key FROM auth_throttle WHERE bucket_key LIKE 'login-ip:%'",
    ).first<{ bucket_key: string }>()
    await testEnv.env.DB.prepare(
      'UPDATE auth_throttle SET failures = 29 WHERE bucket_key = ?',
    ).bind(ipRow!.bucket_key).run()

    expect((await testEnv.fetch(post('/api/auth/simple/login', 'Fox', '9999'))).status).toBe(401)
    expect((await testEnv.fetch(post('/api/auth/simple/login', 'Fox', '0123'))).status).toBe(429)
    expect((await testEnv.fetch(post('/api/auth/simple/login', 'Fox', '0123', '192.0.2.2'))).status).toBe(200)
  })

  it('admits at most five concurrent PIN guesses for one nickname', async () => {
    const testEnv = await setup()
    await testEnv.fetch(post('/api/auth/simple/register', 'Badger', '0123'))

    const responses = await Promise.all(Array.from({ length: 12 }, () =>
      testEnv.fetch(post('/api/auth/simple/login', 'Badger', '9999')),
    ))
    expect(responses.filter((response) => response.status === 401)).toHaveLength(5)
    expect(responses.filter((response) => response.status === 429)).toHaveLength(7)
  })

  it('limits signup attempts per IP and requires a configured pepper', async () => {
    const testEnv = await setup()
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect((await testEnv.fetch(post('/api/auth/simple/register', `Player${attempt}`, '1234'))).status).toBe(200)
    }
    expect((await testEnv.fetch(post('/api/auth/simple/register', 'Player6', '1234'))).status).toBe(429)

    const withoutPepper = await setup({ pinPepper: null })
    expect((await withoutPepper.fetch(post('/api/auth/simple/register', 'Another', '1234'))).status).toBe(503)
    expect((await withoutPepper.fetch(post('/api/auth/simple/login', 'Another', '1234'))).status).toBe(503)
  })

  it('admits at most five concurrent signups from one IP', async () => {
    const testEnv = await setup()
    const responses = await Promise.all(Array.from({ length: 8 }, (_, index) =>
      testEnv.fetch(post('/api/auth/simple/register', `Sprout${index}`, '1234')),
    ))
    expect(responses.filter((response) => response.status === 200)).toHaveLength(5)
    expect(responses.filter((response) => response.status === 429)).toHaveLength(3)
  })
})
