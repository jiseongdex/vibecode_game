// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import type { AuthType, LeaderboardDto } from '../../src/api/contracts'
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

function userInsert(
  testEnv: TestEnv,
  id: string,
  authType: AuthType,
  displayName: string,
  stage: number | null,
  seconds: number | null,
): D1PreparedStatement {
  const nowMs = Date.now()
  return testEnv.env.DB.prepare(
    `INSERT INTO users (
       id, auth_type, display_name, nickname_key, microsoft_tid, microsoft_sub,
       pin_salt, pin_hash, unlocked_stage, highest_completed_stage,
       highest_stage_best_time_seconds, created_at_ms, updated_at_ms
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, authType, displayName,
    authType === 'simple' ? id : null,
    authType === 'microsoft' ? '12345678-1234-4234-8234-123456789abc' : null,
    authType === 'microsoft' ? id : null,
    authType === 'simple' ? 'test-salt' : null,
    authType === 'simple' ? 'test-hash' : null,
    stage ?? 1, stage, seconds, nowMs, nowMs,
  )
}

async function insertUser(
  testEnv: TestEnv,
  id: string,
  authType: AuthType,
  displayName: string,
  stage: number | null,
  seconds: number | null,
): Promise<void> {
  await userInsert(testEnv, id, authType, displayName, stage, seconds).run()
}

async function cookieFor(testEnv: TestEnv, userId: string): Promise<string> {
  const { cookie } = await issueSession(testEnv.env, userId, Date.now())
  return cookie.split(';', 1)[0]
}

async function leaderboard(testEnv: TestEnv, cookie: string, query = ''): Promise<{
  response: Response
  body: LeaderboardDto
}> {
  const response = await testEnv.fetch(new Request(`${ORIGIN}/api/leaderboard${query}`, {
    headers: { Cookie: cookie },
  }))
  return { response, body: await response.json() as LeaderboardDto }
}

function post(path: string, body: unknown): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

afterEach(async () => {
  await Promise.all(environments.splice(0).map(({ dispose }) => dispose()))
})

describe('leaderboard', () => {
  it('separates login types, ranks highest stage first and shares tied ranks', async () => {
    const testEnv = await setup()
    await testEnv.env.DB.batch([
      userInsert(testEnv, 'simple-a', 'simple', 'Shared', 20, 300),
      userInsert(testEnv, 'simple-b', 'simple', 'Second', 20, 300),
      userInsert(testEnv, 'simple-c', 'simple', 'Third', 20, 500),
      userInsert(testEnv, 'simple-d', 'simple', 'Fast at 19', 19, 2),
      userInsert(testEnv, 'microsoft-a', 'microsoft', 'Shared', 20, 300),
      userInsert(testEnv, 'microsoft-b', 'microsoft', 'Faster', 20, 200),
    ])

    const simple = await leaderboard(testEnv, await cookieFor(testEnv, 'simple-b'),
      '?authType=microsoft&userId=microsoft-b&stage=20')
    expect(simple.response.status).toBe(200)
    expect(simple.response.headers.get('Cache-Control')).toBe('no-store')
    expect(simple.body.top.map(({ userId, rank }) => [userId, rank])).toEqual([
      ['simple-a', 1], ['simple-b', 1], ['simple-c', 3], ['simple-d', 4],
    ])
    expect(simple.body.current).toEqual({
      rank: 1, userId: 'simple-b', displayName: 'Second', highestStage: 20, bestTimeSeconds: 300,
    })
    expect(JSON.stringify(simple.body)).not.toMatch(/pin|microsoft_tid|microsoft_sub|email|cookie/i)

    const microsoft = await leaderboard(testEnv, await cookieFor(testEnv, 'microsoft-a'),
      '?authType=simple&userId=simple-a')
    expect(microsoft.body.top.map(({ userId, rank }) => [userId, rank])).toEqual([
      ['microsoft-b', 1], ['microsoft-a', 2],
    ])
    expect(microsoft.body.current).toEqual({
      rank: 2, userId: 'microsoft-a', displayName: 'Shared', highestStage: 20, bestTimeSeconds: 300,
    })
  })

  it('requires a session and ranks users without completed stages as stage zero', async () => {
    const testEnv = await setup()
    await insertUser(testEnv, 'new-simple', 'simple', 'New Player', null, null)
    await insertUser(testEnv, 'ranked-simple', 'simple', 'Ranked', 1, 50)
    await insertUser(testEnv, 'another-simple', 'simple', 'Another Player', null, null)
    await insertUser(testEnv, 'new-microsoft', 'microsoft', 'New Microsoft', null, null)
    const anonymous = await testEnv.fetch(new Request(`${ORIGIN}/api/leaderboard`))
    expect(anonymous.status).toBe(401)

    const simple = await leaderboard(testEnv, await cookieFor(testEnv, 'new-simple'))
    expect(simple.body.current).toEqual({
      rank: 2, userId: 'new-simple', displayName: 'New Player', highestStage: 0,
      bestTimeSeconds: null,
    })
    expect(simple.body.top.map(({ userId, rank, highestStage, bestTimeSeconds }) =>
      [userId, rank, highestStage, bestTimeSeconds])).toEqual([
      ['ranked-simple', 1, 1, 50],
      ['another-simple', 2, 0, null],
      ['new-simple', 2, 0, null],
    ])
    const microsoft = await leaderboard(testEnv, await cookieFor(testEnv, 'new-microsoft'))
    const microsoftEntry = {
      rank: 1, userId: 'new-microsoft', displayName: 'New Microsoft', highestStage: 0,
      bestTimeSeconds: null,
    }
    expect(microsoft.body).toEqual({ top: [microsoftEntry], current: microsoftEntry })
  })

  it('returns only the top 100 while calculating the signed-in users rank of 101', async () => {
    const testEnv = await setup()
    await testEnv.env.DB.batch(Array.from({ length: 101 }, (_, index) =>
      userInsert(testEnv, `player-${String(index + 1).padStart(3, '0')}`, 'simple',
        `Player ${index + 1}`, 1, index + 2)))
    const { body } = await leaderboard(testEnv, await cookieFor(testEnv, 'player-101'))
    expect(body.top).toHaveLength(100)
    expect(body.top[0]).toMatchObject({ rank: 1, userId: 'player-001', bestTimeSeconds: 2 })
    expect(body.top[99]).toMatchObject({ rank: 100, userId: 'player-100', bestTimeSeconds: 101 })
    expect(body.current).toEqual({ rank: 101, userId: 'player-101', displayName: 'Player 101',
      highestStage: 1, bestTimeSeconds: 102 })
  })

  it('reflects a completed server-issued run in the rank summary', async () => {
    const testEnv = await setup()
    await insertUser(testEnv, 'runner', 'simple', 'Runner', null, null)
    await insertUser(testEnv, 'rival', 'simple', 'Rival', 1, 20)
    const cookie = await cookieFor(testEnv, 'runner')
    const principal: SessionPrincipal = { userId: 'runner', authType: 'simple', displayName: 'Runner' }
    const atMs = Date.now()
    const started = await startRun(post('/api/runs/start', { stage: 1 }), testEnv.env, principal, atMs)
    const { attemptId } = await started.json() as { attemptId: string }
    await finishRun(post('/api/runs/finish', { attemptId, clearTimeSeconds: 10 }),
      testEnv.env, principal, atMs + 10_000)

    const { body } = await leaderboard(testEnv, cookie)
    expect(body.top.map(({ userId, rank }) => [userId, rank])).toEqual([
      ['runner', 1], ['rival', 2],
    ])
    expect(body.current).toMatchObject({ userId: 'runner', highestStage: 1, bestTimeSeconds: 10 })
  })
})
