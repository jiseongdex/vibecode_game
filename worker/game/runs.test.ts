// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { getTimeLimitSeconds } from '../../src/game/stageConfig'
import { issueSession } from '../auth/session'
import { createTestEnv, type TestEnv } from '../test/createTestEnv'
import type { SessionPrincipal } from '../types'
import { finishRun, startRun } from './runs'

const ORIGIN = 'http://localhost'
const environments: TestEnv[] = []

async function setup(): Promise<TestEnv> {
  const testEnv = await createTestEnv()
  environments.push(testEnv)
  return testEnv
}

function post(path: string, body: unknown, cookie?: string, origin = ORIGIN): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

async function register(testEnv: TestEnv, nickname: string): Promise<{
  principal: SessionPrincipal
  cookie: string
}> {
  const response = await testEnv.fetch(post('/api/auth/simple/register', { nickname, pin: '0042' }))
  expect(response.status).toBe(200)
  const body = await response.json() as { user: { id: string; displayName: string } }
  return {
    principal: { userId: body.user.id, displayName: body.user.displayName, authType: 'simple' },
    cookie: response.headers.get('Set-Cookie')!.split(';', 1)[0],
  }
}

async function begin(testEnv: TestEnv, principal: SessionPrincipal, stage: number, atMs: number): Promise<string> {
  const response = await startRun(post('/api/runs/start', { stage }), testEnv.env, principal, atMs)
  expect(response.status).toBe(201)
  return (await response.json() as { attemptId: string }).attemptId
}

async function complete(
  testEnv: TestEnv,
  principal: SessionPrincipal,
  attemptId: string,
  seconds: number,
  atMs: number,
): Promise<Response> {
  return finishRun(post('/api/runs/finish', { attemptId, clearTimeSeconds: seconds }),
    testEnv.env, principal, atMs)
}

afterEach(async () => {
  await Promise.all(environments.splice(0).map(({ dispose }) => dispose()))
})

describe('run lifecycle', () => {
  it('issues server attempts and shares account progress across sessions', async () => {
    const testEnv = await setup()
    const { principal, cookie } = await register(testEnv, 'Otter')
    const newAccount = await testEnv.fetch(new Request(`${ORIGIN}/api/me`, { headers: { Cookie: cookie } }))
    expect((await newAccount.json() as { progress: unknown }).progress)
      .toEqual({ unlockedStage: 1, stageRecords: {} })

    const atMs = Date.now()
    const attemptId = await begin(testEnv, principal, 1, atMs)
    const otherAttemptId = await begin(testEnv, principal, 1, atMs + 1)
    const stored = await testEnv.env.DB.prepare('SELECT user_id, stage, started_at_ms, status FROM attempts WHERE id = ?')
      .bind(attemptId).first()
    expect(stored).toMatchObject({ user_id: principal.userId, stage: 1, started_at_ms: atMs, status: 'active' })

    const result = await complete(testEnv, principal, attemptId, 50, atMs + 50_000)
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ progress: {
      unlockedStage: 2,
      stageRecords: { 1: { bestTimeSeconds: 50 } },
    } })
    const summary = await testEnv.env.DB.prepare(
      'SELECT unlocked_stage, highest_completed_stage, highest_stage_best_time_seconds FROM users WHERE id = ?',
    ).bind(principal.userId).first()
    expect(summary).toMatchObject({ unlocked_stage: 2, highest_completed_stage: 1,
      highest_stage_best_time_seconds: 50 })
    const otherAttempt = await testEnv.env.DB.prepare('SELECT status FROM attempts WHERE id = ?')
      .bind(otherAttemptId).first<{ status: string }>()
    expect(otherAttempt?.status).toBe('active')

    const secondSession = await issueSession(testEnv.env, principal.userId, Date.now())
    const me = await testEnv.fetch(new Request(`${ORIGIN}/api/me`, {
      headers: { Cookie: secondSession.cookie.split(';', 1)[0] },
    }))
    expect((await me.json() as { progress: unknown }).progress).toEqual({
      unlockedStage: 2, stageRecords: { 1: { bestTimeSeconds: 50 } },
    })
  })

  it('rejects locked or invalid stages and caps unlocks at stage 20', async () => {
    const testEnv = await setup()
    const { principal } = await register(testEnv, 'Rabbit')
    for (const stage of [0, 1.5, 21, '1', null]) {
      await expect(startRun(post('/api/runs/start', { stage }), testEnv.env, principal, Date.now()))
        .rejects.toMatchObject({ status: 400 })
    }
    await expect(startRun(post('/api/runs/start', { stage: 2 }), testEnv.env, principal, Date.now()))
      .rejects.toMatchObject({ status: 403 })

    await testEnv.env.DB.prepare('UPDATE users SET unlocked_stage = 20 WHERE id = ?')
      .bind(principal.userId).run()
    const atMs = Date.now()
    const attemptId = await begin(testEnv, principal, 20, atMs)
    expect((await complete(testEnv, principal, attemptId, 300, atMs + 300_000)).status).toBe(200)
    const row = await testEnv.env.DB.prepare(
      'SELECT unlocked_stage, highest_completed_stage, highest_stage_best_time_seconds FROM users WHERE id = ?',
    ).bind(principal.userId).first()
    expect(row).toMatchObject({ unlocked_stage: 20, highest_completed_stage: 20,
      highest_stage_best_time_seconds: 300 })
  })

  it('rejects impossible times without consuming the attempt and includes pauses in wall time', async () => {
    const testEnv = await setup()
    const { principal } = await register(testEnv, 'Fox')
    const atMs = Date.now()
    const attemptId = await begin(testEnv, principal, 1, atMs)
    for (const [seconds, finishedAt] of [
      [0, atMs + 10_000],
      [2.5, atMs + 10_000],
      [getTimeLimitSeconds(1) + 1, atMs + 200_000],
      [10, atMs + 5_000],
      [2, atMs + 1_999],
    ]) {
      await expect(complete(testEnv, principal, attemptId, seconds, finishedAt))
        .rejects.toMatchObject({ status: 422 })
    }
    const active = await testEnv.env.DB.prepare('SELECT status FROM attempts WHERE id = ?')
      .bind(attemptId).first<{ status: string }>()
    expect(active?.status).toBe('active')
    expect((await complete(testEnv, principal, attemptId, 30, atMs + 60_000)).status).toBe(200)
  })

  it('isolates attempts by owner and rejects duplicate and concurrent finishes', async () => {
    const testEnv = await setup()
    const first = await register(testEnv, 'Badger')
    const second = await register(testEnv, 'Mouse')
    const atMs = Date.now()
    const attemptId = await begin(testEnv, first.principal, 1, atMs)
    await expect(complete(testEnv, second.principal, attemptId, 10, atMs + 10_000))
      .rejects.toMatchObject({ status: 404 })
    const [one, two] = await Promise.allSettled([
      complete(testEnv, first.principal, attemptId, 10, atMs + 10_000),
      complete(testEnv, first.principal, attemptId, 10, atMs + 10_000),
    ])
    expect([one, two].filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect([one, two].filter((result) => result.status === 'rejected')).toHaveLength(1)
    const record = await testEnv.env.DB.prepare('SELECT best_time_seconds FROM stage_records WHERE user_id = ?')
      .bind(first.principal.userId).first<{ best_time_seconds: number }>()
    expect(record?.best_time_seconds).toBe(10)
    await expect(complete(testEnv, first.principal, attemptId, 5, atMs + 20_000))
      .rejects.toMatchObject({ status: 409 })
    const other = await testEnv.env.DB.prepare('SELECT unlocked_stage FROM users WHERE id = ?')
      .bind(second.principal.userId).first<{ unlocked_stage: number }>()
    expect(other?.unlocked_stage).toBe(1)
  })

  it('keeps the fastest time and highest-stage summary through replays', async () => {
    const testEnv = await setup()
    const { principal } = await register(testEnv, 'Hedgehog')
    const atMs = Date.now()
    for (const [stage, seconds, offset] of [
      [1, 50, 0], [1, 70, 100_000], [1, 40, 200_000],
      [2, 100, 300_000], [1, 30, 500_000], [2, 120, 600_000],
    ]) {
      const attemptId = await begin(testEnv, principal, stage, atMs + offset)
      expect((await complete(testEnv, principal, attemptId, seconds, atMs + offset + seconds * 1000)).status)
        .toBe(200)
    }
    const summary = await testEnv.env.DB.prepare(
      'SELECT unlocked_stage, highest_completed_stage, highest_stage_best_time_seconds FROM users WHERE id = ?',
    ).bind(principal.userId).first()
    expect(summary).toMatchObject({ unlocked_stage: 3, highest_completed_stage: 2,
      highest_stage_best_time_seconds: 100 })
    const me = await testEnv.env.DB.prepare(
      'SELECT stage, best_time_seconds FROM stage_records WHERE user_id = ? ORDER BY stage',
    ).bind(principal.userId).all<{ stage: number; best_time_seconds: number }>()
    expect(me.results).toEqual([
      { stage: 1, best_time_seconds: 30 }, { stage: 2, best_time_seconds: 100 },
    ])
  })

  it('requires a session and same-origin JSON on both routes', async () => {
    const testEnv = await setup()
    const { cookie } = await register(testEnv, 'Panda')
    for (const path of ['/api/runs/start', '/api/runs/finish']) {
      const body = path.endsWith('start') ? { stage: 1 } : { attemptId: crypto.randomUUID(), clearTimeSeconds: 10 }
      expect((await testEnv.fetch(post(path, body))).status).toBe(401)
      expect((await testEnv.fetch(post(path, body, cookie, 'https://other.example'))).status).toBe(403)
      const wrongType = new Request(`${ORIGIN}${path}`, {
        method: 'POST',
        headers: { Origin: ORIGIN, 'Content-Type': 'text/plain', Cookie: cookie },
        body: JSON.stringify(body),
      })
      expect((await testEnv.fetch(wrongType)).status).toBe(415)
    }
    const started = await testEnv.fetch(post('/api/runs/start', { stage: 1 }, cookie))
    expect(started.status).toBe(201)
    expect(started.headers.get('Cache-Control')).toBe('no-store')
    const { attemptId } = await started.json() as { attemptId: string }
    await testEnv.env.DB.prepare('UPDATE attempts SET started_at_ms = ? WHERE id = ?')
      .bind(Date.now() - 10_000, attemptId).run()
    const finished = await testEnv.fetch(post('/api/runs/finish', { attemptId, clearTimeSeconds: 5 }, cookie))
    expect(finished.status).toBe(200)
    expect(await finished.json()).toEqual({ progress: {
      unlockedStage: 2, stageRecords: { 1: { bestTimeSeconds: 5 } },
    } })
  })

  it('keeps an attempt active when the record transaction fails', async () => {
    const testEnv = await setup()
    const { principal } = await register(testEnv, 'Koala')
    const atMs = Date.now()
    const attemptId = await begin(testEnv, principal, 1, atMs)
    await testEnv.env.DB.prepare('DROP TABLE stage_records').run()
    await expect(complete(testEnv, principal, attemptId, 10, atMs + 10_000)).rejects.toThrow()
    const attempt = await testEnv.env.DB.prepare('SELECT status FROM attempts WHERE id = ?')
      .bind(attemptId).first<{ status: string }>()
    expect(attempt?.status).toBe('active')
  })
})
