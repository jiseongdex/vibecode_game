// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { createTestEnv, type TestEnv } from '../test/createTestEnv'
import { issueSession } from './session'

const activeEnvironments: TestEnv[] = []
const ORIGIN = 'http://localhost'

async function setup(): Promise<TestEnv> {
  const testEnv = await createTestEnv()
  activeEnvironments.push(testEnv)
  return testEnv
}

function registerRequest(origin = ORIGIN, contentType = 'application/json'): Request {
  return new Request(`${ORIGIN}/api/auth/simple/register`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': contentType },
    body: JSON.stringify({ nickname: 'Otter', pin: '0012' }),
  })
}

function sessionCookie(response: Response): string {
  return response.headers.get('Set-Cookie')!.split(';', 1)[0]
}

afterEach(async () => {
  await Promise.all(activeEnvironments.splice(0).map(({ dispose }) => dispose()))
})

describe('server sessions', () => {
  it('serves current progress using the session cookie and never stores its raw token', async () => {
    const testEnv = await setup()
    const registration = await testEnv.fetch(registerRequest())
    const cookie = sessionCookie(registration)
    const token = cookie.split('=')[1]
    const userId = (await registration.json() as { user: { id: string } }).user.id

    const stored = await testEnv.env.DB.prepare('SELECT token_hash FROM sessions WHERE user_id = ?')
      .bind(userId).first<{ token_hash: string }>()
    expect(stored!.token_hash).not.toBe(token)
    expect(stored!.token_hash).toMatch(/^[a-f0-9]{64}$/)

    await testEnv.env.DB.prepare('UPDATE users SET unlocked_stage = 2 WHERE id = ?').bind(userId).run()
    await testEnv.env.DB.prepare(
      'INSERT INTO stage_records (user_id, stage, best_time_seconds, updated_at_ms) VALUES (?, 1, 94, ?)',
    ).bind(userId, Date.now()).run()
    const me = await testEnv.fetch(new Request(`${ORIGIN}/api/me`, { headers: { Cookie: cookie } }))
    expect(me.status).toBe(200)
    expect(me.headers.get('Cache-Control')).toBe('no-store')
    expect((await me.json() as { progress: unknown }).progress).toEqual({
      unlockedStage: 2,
      stageRecords: { 1: { bestTimeSeconds: 94 } },
    })
  })

  it('expires sessions and revokes them on logout', async () => {
    const testEnv = await setup()
    const registration = await testEnv.fetch(registerRequest())
    const cookie = sessionCookie(registration)
    const meRequest = () => new Request(`${ORIGIN}/api/me`, { headers: { Cookie: cookie } })

    expect((await testEnv.fetch(new Request(`${ORIGIN}/api/me`))).status).toBe(401)
    expect((await testEnv.fetch(meRequest())).status).toBe(200)
    const logout = await testEnv.fetch(new Request(`${ORIGIN}/api/auth/logout`, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json', Cookie: cookie },
      body: '{}',
    }))
    expect(logout.status).toBe(204)
    expect(logout.headers.get('Set-Cookie')).toContain('Max-Age=0')
    expect(logout.headers.get('Cache-Control')).toBe('no-store')
    expect((await testEnv.fetch(meRequest())).status).toBe(401)

    const login = await testEnv.fetch(new Request(`${ORIGIN}/api/auth/simple/login`, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Otter', pin: '0012' }),
    }))
    expect(login.status).toBe(200)
    await testEnv.env.DB.prepare('UPDATE sessions SET expires_at_ms = ?')
      .bind(Date.now() - 1).run()
    const expired = await testEnv.fetch(new Request(`${ORIGIN}/api/me`, {
      headers: { Cookie: sessionCookie(login) },
    }))
    expect(expired.status).toBe(401)
    const remaining = await testEnv.env.DB.prepare('SELECT count(*) AS total FROM sessions')
      .first<{ total: number }>()
    expect(remaining!.total).toBe(0)
  })

  it('rejects cross-origin POST and non-JSON writes before creating accounts', async () => {
    const testEnv = await setup()
    const crossOrigin = await testEnv.fetch(registerRequest('https://other.example'))
    expect(crossOrigin.status).toBe(403)
    expect((await crossOrigin.json() as { error: { code: string } }).error.code).toBe('invalid_origin')

    const wrongType = await testEnv.fetch(registerRequest(ORIGIN, 'text/plain'))
    expect(wrongType.status).toBe(415)
    const count = await testEnv.env.DB.prepare('SELECT count(*) AS total FROM users').first<{ total: number }>()
    expect(count!.total).toBe(0)
  })

  it('uses the same session store for a Microsoft account', async () => {
    const testEnv = await setup()
    const userId = crypto.randomUUID()
    const nowMs = Date.now()
    await testEnv.env.DB.prepare(
      `INSERT INTO users (
        id, auth_type, display_name, microsoft_tid, microsoft_sub, created_at_ms, updated_at_ms
      ) VALUES (?, 'microsoft', ?, ?, ?, ?, ?)`,
    ).bind(userId, 'Microsoft Player', 'tenant-id', 'subject-id', nowMs, nowMs).run()

    const { cookie } = await issueSession(testEnv.env, userId, nowMs)
    const response = await testEnv.fetch(new Request(`${ORIGIN}/api/me`, {
      headers: { Cookie: cookie.split(';', 1)[0] },
    }))
    expect(response.status).toBe(200)
    expect((await response.json() as { user: unknown }).user).toEqual({
      id: userId,
      authType: 'microsoft',
      displayName: 'Microsoft Player',
    })
  })

  it('purges all expired sessions on the daily scheduled event', async () => {
    const testEnv = await setup()
    const registration = await testEnv.fetch(registerRequest())
    const userId = (await registration.json() as { user: { id: string } }).user.id
    const nowMs = Date.now()
    for (const [tokenHash, expiresAt] of [
      ['expired', nowMs - 1],
      ['boundary', nowMs],
      ['future', nowMs + 10_000],
    ] as const) {
      await testEnv.env.DB.prepare(
        'INSERT INTO sessions (token_hash, user_id, created_at_ms, expires_at_ms) VALUES (?, ?, ?, ?)',
      ).bind(tokenHash, userId, nowMs - 20_000, expiresAt).run()
    }

    const scheduled = await testEnv.scheduled(nowMs)
    expect(scheduled.outcome).toBe('ok')

    const { results } = await testEnv.env.DB.prepare(
      "SELECT token_hash FROM sessions WHERE token_hash IN ('expired', 'boundary', 'future')",
    ).all<{ token_hash: string }>()
    expect(results.map(({ token_hash }) => token_hash)).toEqual(['future'])
    const indexes = await testEnv.env.DB.prepare("PRAGMA index_list('sessions')")
      .all<{ name: string }>()
    expect(indexes.results.map(({ name }) => name)).toContain('sessions_expiry_idx')
  })
})
