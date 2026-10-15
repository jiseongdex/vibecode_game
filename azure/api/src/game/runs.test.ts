// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { getTimeLimitSeconds } from '../../../../src/game/stageConfig'
import type { AzurePrincipal } from '../auth/session'
import { MICROSOFT_SCOPE, UNRANKED_TIME_SECONDS, type AttemptDoc, type AzureStore, type UserDoc } from '../model'
import { finishRun, readProgress, startRun } from './runs'

const now = 1_800_000_000_000
const principal: AzurePrincipal = { userId: 'u_player', displayName: 'Player', authType: 'microsoft' }

function user(id = principal.userId): UserDoc {
  return {
    id, scope: MICROSOFT_SCOPE, type: 'user', tid: 'tenant', sub: id,
    displayName: id, unlockedStage: 1, highestStage: 0, bestTimeSeconds: null,
    rankTimeSeconds: UNRANKED_TIME_SECONDS, stageRecords: {}, createdAtMs: now, updatedAtMs: now,
    _etag: 'v1',
  }
}

class MemoryStore {
  readonly users = new Map<string, UserDoc>([[principal.userId, user()]])
  readonly attempts = new Map<string, AttemptDoc>()
  private version = 1
  conflictOnce = false
  alwaysConflict = false
  onConflictOnce?: () => void

  async getUser(id: string): Promise<UserDoc | null> {
    return structuredClone(this.users.get(id) ?? null)
  }

  async getAttempt(id: string): Promise<AttemptDoc | null> {
    return structuredClone(this.attempts.get(id) ?? null)
  }

  async createAttempt(doc: AttemptDoc): Promise<void> {
    this.attempts.set(doc.id, { ...structuredClone(doc), _etag: `v${++this.version}` })
  }

  async finishAttemptAndUser(attempt: AttemptDoc, updated: UserDoc): Promise<'ok' | 'conflict'> {
    await Promise.resolve()
    if (this.alwaysConflict || this.conflictOnce) {
      this.conflictOnce = false
      this.onConflictOnce?.()
      this.onConflictOnce = undefined
      return 'conflict'
    }
    const currentAttempt = this.attempts.get(attempt.id)
    const currentUser = this.users.get(updated.id)
    if (!currentAttempt || !currentUser || currentAttempt._etag !== attempt._etag ||
      currentUser._etag !== updated._etag || currentAttempt.status !== 'active') return 'conflict'
    this.users.set(updated.id, { ...structuredClone(updated), _etag: `v${++this.version}` })
    this.attempts.set(attempt.id, { ...structuredClone(attempt), _etag: `v${++this.version}` })
    return 'ok'
  }
}

function post(path: string, body: unknown): Request {
  return new Request(`https://game.example${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

async function begin(store: AzureStore, stage: number, atMs = now): Promise<string> {
  const response = await startRun(post('/api/runs/start', { stage }), store, principal, atMs)
  expect(response.status).toBe(201)
  const dto = await response.json() as { attemptId: string; stage: number; startedAtMs: number }
  expect(dto).toMatchObject({ stage, startedAtMs: atMs })
  expect(dto.attemptId).toMatch(/^a_[0-9a-f-]{36}$/)
  return dto.attemptId
}

function complete(store: AzureStore, attemptId: string, seconds: number, atMs: number): Promise<Response> {
  return finishRun(post('/api/runs/finish', { attemptId, clearTimeSeconds: seconds }), store, principal, atMs)
}

describe('Azure run lifecycle', () => {
  it('starts a server attempt, unlocks the next stage, and retains each stage best time', async () => {
    const memory = new MemoryStore()
    const store = memory as unknown as AzureStore
    expect(await readProgress(store, principal.userId)).toEqual({ unlockedStage: 1, stageRecords: {} })
    const first = await begin(store, 1)
    expect(memory.attempts.get(first)).toMatchObject({ userId: principal.userId, stage: 1, status: 'active', ttl: 86400 })
    expect((await complete(store, first, 50, now + 50_000)).status).toBe(200)
    expect(await readProgress(store, principal.userId)).toEqual({ unlockedStage: 2, stageRecords: { 1: { bestTimeSeconds: 50 } } })
    const slow = await begin(store, 1, now + 100_000)
    await complete(store, slow, 70, now + 170_000)
    const fast = await begin(store, 1, now + 200_000)
    await complete(store, fast, 40, now + 240_000)
    const next = await begin(store, 2, now + 300_000)
    await complete(store, next, 100, now + 400_000)
    const lower = await begin(store, 1, now + 500_000)
    await complete(store, lower, 30, now + 530_000)
    expect(memory.users.get(principal.userId)).toMatchObject({
      unlockedStage: 3, highestStage: 2, bestTimeSeconds: 100, rankTimeSeconds: 100,
      stageRecords: { 1: { bestTimeSeconds: 30 }, 2: { bestTimeSeconds: 100 } },
    })
    expect(memory.attempts.get(first)).toMatchObject({ status: 'finished', finishedAtMs: now + 50_000, ttl: 2592000 })
  })

  it('rejects invalid, locked, or missing-user starts', async () => {
    const memory = new MemoryStore()
    const store = memory as unknown as AzureStore
    for (const stage of [0, 1.5, 21, '1', null]) {
      await expect(startRun(post('/start', { stage }), store, principal, now)).rejects.toMatchObject({ status: 400, code: 'invalid_stage' })
    }
    await expect(startRun(post('/start', []), store, principal, now)).rejects.toMatchObject({ status: 400, code: 'invalid_request' })
    await expect(begin(store, 2)).rejects.toMatchObject({ status: 403, code: 'stage_locked' })
    memory.users.clear()
    await expect(begin(store, 1)).rejects.toMatchObject({ status: 401, code: 'unauthorized' })
  })

  it('rejects false clear times and expired attempts without consuming a valid attempt', async () => {
    const memory = new MemoryStore()
    const store = memory as unknown as AzureStore
    const id = await begin(store, 1)
    for (const [seconds, atMs] of [
      [0, now + 10_000], [2.5, now + 10_000], [getTimeLimitSeconds(1) + 1, now + 200_000],
      [10, now + 5_000], [2, now + 1_999],
    ]) {
      await expect(complete(store, id, seconds, atMs)).rejects.toMatchObject({ status: 422, code: 'invalid_clear_time' })
    }
    expect(memory.attempts.get(id)?.status).toBe('active')
    await expect(complete(store, id, 10, now + 86_400_000)).rejects.toMatchObject({ status: 404 })
    expect((await complete(store, id, 30, now + 30_000)).status).toBe(200)
  })

  it('matches the frontend time limit at every stage', async () => {
    for (let stage = 1; stage <= 20; stage += 1) {
      const memory = new MemoryStore()
      memory.users.set(principal.userId, { ...user(), unlockedStage: 20 })
      const store = memory as unknown as AzureStore
      const id = await begin(store, stage)
      const limit = getTimeLimitSeconds(stage)
      await expect(complete(store, id, limit + 1, now + (limit + 1) * 1000))
        .rejects.toMatchObject({ status: 422, code: 'invalid_clear_time' })
      expect((await complete(store, id, limit, now + limit * 1000)).status).toBe(200)
    }
  })

  it('prevents duplicate and concurrent completion, including a different owner', async () => {
    const memory = new MemoryStore()
    const store = memory as unknown as AzureStore
    const id = await begin(store, 1)
    await expect(finishRun(post('/finish', { attemptId: id, clearTimeSeconds: 10 }), store,
      { ...principal, userId: 'someone-else' }, now + 10_000))
      .rejects.toMatchObject({ status: 404, code: 'attempt_not_found' })
    const outcomes = await Promise.allSettled([complete(store, id, 10, now + 10_000), complete(store, id, 10, now + 10_000)])
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1)
    expect(memory.users.get(principal.userId)?.stageRecords).toEqual({ 1: { bestTimeSeconds: 10 } })
    await expect(complete(store, id, 5, now + 20_000)).rejects.toMatchObject({ status: 409, code: 'attempt_finished' })
  })

  it('retries a batch conflict and returns an explicit conflict after three failures', async () => {
    const memory = new MemoryStore()
    const store = memory as unknown as AzureStore
    const id = await begin(store, 1)
    memory.conflictOnce = true
    memory.onConflictOnce = () => {
      memory.users.set(principal.userId, {
        ...user(), unlockedStage: 3, highestStage: 2, bestTimeSeconds: 100,
        rankTimeSeconds: 100, stageRecords: { 2: { bestTimeSeconds: 100 } }, _etag: 'other-finish',
      })
    }
    expect((await complete(store, id, 20, now + 20_000)).status).toBe(200)
    expect(memory.users.get(principal.userId)).toMatchObject({
      unlockedStage: 3, highestStage: 2, bestTimeSeconds: 100,
      stageRecords: { 1: { bestTimeSeconds: 20 }, 2: { bestTimeSeconds: 100 } },
    })
    const another = await begin(store, 1, now + 50_000)
    memory.alwaysConflict = true
    await expect(complete(store, another, 15, now + 65_000)).rejects.toMatchObject({ status: 409, code: 'conflict' })
    expect(memory.attempts.get(another)?.status).toBe('active')
  })
})
