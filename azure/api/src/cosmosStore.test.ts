import type { Container } from '@azure/cosmos'
import { describe, expect, it } from 'vitest'
import { CosmosStore, microsoftUserId, normalizeDisplayName } from './cosmosStore'
import { MICROSOFT_SCOPE, UNRANKED_TIME_SECONDS, type AttemptDoc, type OAuthFlowDoc, type SessionDoc, type UserDoc } from './model'

type Stored = UserDoc | AttemptDoc | OAuthFlowDoc | SessionDoc

function copy<T>(value: T): T {
  return structuredClone(value)
}

class MemoryContainer {
  readonly docs = new Map<string, Stored>()
  private version = 0
  failNextBatch = false

  private tagged<T extends Stored>(doc: T): T {
    return { ...copy(doc), _etag: `etag-${++this.version}` }
  }

  item(id: string, scope: string) {
    if (scope !== MICROSOFT_SCOPE) throw new Error('Wrong partition key')
    return {
      read: async () => {
        const doc = this.docs.get(id)
        if (!doc) throw { code: 404 }
        return { resource: copy(doc), etag: doc._etag }
      },
      replace: async (body: Stored, options: { accessCondition: { condition: string } }) => {
        const current = this.docs.get(id)
        if (!current || current._etag !== options.accessCondition.condition) throw { code: 412 }
        const stored = this.tagged(body)
        this.docs.set(id, stored)
        return { resource: copy(stored), etag: stored._etag }
      },
      delete: async (options?: { accessCondition: { condition: string } }) => {
        const current = this.docs.get(id)
        if (!current) throw { code: 404 }
        if (options && options.accessCondition.condition !== current._etag) throw { code: 412 }
        this.docs.delete(id)
      },
    }
  }

  readonly items = {
    create: async (body: Stored) => {
      if (body.scope !== MICROSOFT_SCOPE) throw new Error('Wrong partition key')
      if (this.docs.has(body.id)) throw { code: 409 }
      const stored = this.tagged(body)
      this.docs.set(body.id, stored)
      return { resource: copy(stored) }
    },
    batch: async (
      operations: Array<{ id: string; ifMatch?: string; resourceBody: Stored }>,
      scope: string,
    ) => {
      if (scope !== MICROSOFT_SCOPE) throw new Error('Wrong partition key')
      if (this.failNextBatch) {
        this.failNextBatch = false
        return { code: 412, result: [{ statusCode: 412 }, { statusCode: 424 }] }
      }
      if (operations.some((operation) => this.docs.get(operation.id)?._etag !== operation.ifMatch)) {
        return { code: 412, result: [{ statusCode: 412 }, { statusCode: 424 }] }
      }
      for (const operation of operations) {
        this.docs.set(operation.id, this.tagged(operation.resourceBody))
      }
      return { code: 200, result: [{ statusCode: 200 }, { statusCode: 200 }] }
    },
    query: <T>(spec: { query: string; parameters: Array<{ name: string; value: number }> }, options: { partitionKey: string }) => {
      if (options.partitionKey !== MICROSOFT_SCOPE) throw new Error('Wrong partition key')
      const users = [...this.docs.values()].filter((doc): doc is UserDoc => doc.type === 'user')
      if (spec.query.includes('SELECT TOP')) {
        const sorted = users.sort((a, b) =>
          b.highestStage - a.highestStage || a.rankTimeSeconds - b.rankTimeSeconds || a.id.localeCompare(b.id))
        const limit = spec.parameters.find((parameter) => parameter.name === '@limit')?.value ?? 100
        return { fetchAll: async () => ({ resources: copy(sorted.slice(0, limit)) as T[] }) }
      }
      const stage = spec.parameters.find((parameter) => parameter.name === '@stage')?.value ?? 0
      const time = spec.parameters.find((parameter) => parameter.name === '@rankTime')?.value ?? UNRANKED_TIME_SECONDS
      const count = users.filter((user) => user.highestStage > stage ||
        (user.highestStage === stage && user.rankTimeSeconds < time)).length
      return { fetchAll: async () => ({ resources: [count] as T[] }) }
    },
  }
}

function fixture() {
  const game = new MemoryContainer()
  const auth = new MemoryContainer()
  return { game, auth, store: new CosmosStore(game as unknown as Container, auth as unknown as Container) }
}

describe('CosmosStore', () => {
  it('uses a deterministic Microsoft ID and updates only the verified display name on later sign-in', async () => {
    const { store } = fixture()
    const first = await store.getOrCreateMicrosoftUser('tenant-1', 'subject-1', '  Alice\u0000  ', 100)
    expect(first.id).toBe(microsoftUserId('tenant-1', 'subject-1'))
    expect(first).toMatchObject({ displayName: 'Alice', unlockedStage: 1, highestStage: 0, rankTimeSeconds: UNRANKED_TIME_SECONDS })
    expect(normalizeDisplayName('   ')).toBe('Microsoft 사용자')
    const saved = await store.replaceUser({ ...first, unlockedStage: 5, stageRecords: { '4': { bestTimeSeconds: 39 } } }, first._etag!)
    const signedInAgain = await store.getOrCreateMicrosoftUser('tenant-1', 'subject-1', 'Alice B', 200)
    expect(signedInAgain.id).toBe(first.id)
    expect(signedInAgain).toMatchObject({ displayName: 'Alice B', unlockedStage: 5, stageRecords: saved.stageRecords, createdAtMs: 100 })
  })

  it('keeps the user and attempt unchanged if either ETag conflicts during completion', async () => {
    const { store, game } = fixture()
    const user = await store.getOrCreateMicrosoftUser('tenant', 'subject', 'Player', 100)
    const attempt: AttemptDoc = { id: 'a_123', scope: MICROSOFT_SCOPE, type: 'attempt', userId: user.id,
      stage: 1, startedAtMs: 200, status: 'active', ttl: 86_400 }
    await store.createAttempt(attempt)
    const storedAttempt = await store.getAttempt(attempt.id)
    expect(storedAttempt?._etag).toBeTruthy()
    game.failNextBatch = true
    const completed = { ...storedAttempt!, status: 'finished' as const, finishedAtMs: 4_000, ttl: 2_592_000 }
    const improved = { ...user, unlockedStage: 2, highestStage: 1, bestTimeSeconds: 8, rankTimeSeconds: 8 }
    expect(await store.finishAttemptAndUser(completed, improved)).toBe('conflict')
    expect((await store.getUser(user.id))?.unlockedStage).toBe(1)
    expect((await store.getAttempt(attempt.id))?.status).toBe('active')
    expect(await store.finishAttemptAndUser(completed, improved)).toBe('ok')
    expect((await store.getUser(user.id))?.unlockedStage).toBe(2)
    expect((await store.getAttempt(attempt.id))?.status).toBe('finished')
    expect(await store.finishAttemptAndUser(completed, improved)).toBe('conflict')
  })

  it('sorts only user documents, limits the top to 100, and counts better records without breaking ties', async () => {
    const { store, game } = fixture()
    for (let index = 0; index < 102; index += 1) {
      const user = await store.getOrCreateMicrosoftUser('tenant', `subject-${index}`, `Player ${index}`, index)
      await store.replaceUser({ ...user, highestStage: index % 3, bestTimeSeconds: 30,
        rankTimeSeconds: 30 }, user._etag!)
    }
    const fasterId = microsoftUserId('tenant', 'subject-1')
    const faster = await store.getUser(fasterId)
    await store.replaceUser({ ...faster!, bestTimeSeconds: 20, rankTimeSeconds: 20 }, faster!._etag!)
    game.docs.set('a_fake', { id: 'a_fake', scope: MICROSOFT_SCOPE, type: 'attempt', userId: 'u_fake',
      stage: 1, startedAtMs: 0, status: 'active', ttl: 86_400 })
    const top = await store.topUsers(100)
    expect(top).toHaveLength(100)
    expect(top.every((doc) => doc.type === 'user')).toBe(true)
    expect(top[0].highestStage).toBe(2)
    expect(await store.countBetterUsers(2, 30)).toBe(0)
    expect(await store.countBetterUsers(1, 30)).toBe(35)
    expect(await store.countBetterUsers(1, 20)).toBe(34)
  })

  it('consumes OAuth flow once, rejects expired flow, and removes only the requested session', async () => {
    const { store } = fixture()
    const flow: OAuthFlowDoc = { id: 'f_one', scope: MICROSOFT_SCOPE, type: 'oauthFlow', nonce: 'n',
      codeVerifier: 'v', createdAtMs: 100, expiresAtMs: 700, ttl: 600 }
    await store.putFlow(flow)
    expect(await store.takeFlow(flow.id, 699)).toMatchObject({ nonce: 'n' })
    expect(await store.takeFlow(flow.id, 699)).toBeNull()
    await store.putFlow({ ...flow, id: 'f_race' })
    const raced = await Promise.all([store.takeFlow('f_race', 699), store.takeFlow('f_race', 699)])
    expect(raced.filter(Boolean)).toHaveLength(1)
    await store.putFlow({ ...flow, id: 'f_expired' })
    expect(await store.takeFlow('f_expired', 700)).toBeNull()
    const session: SessionDoc = { id: 's_hash', scope: MICROSOFT_SCOPE, type: 'session', userId: 'u_1',
      createdAtMs: 100, expiresAtMs: 200, ttl: 604_800 }
    await store.putSession(session)
    expect(await store.getSession('s_hash')).toMatchObject({ userId: 'u_1' })
    await store.deleteSession('s_hash')
    await store.deleteSession('s_hash')
    expect(await store.getSession('s_hash')).toBeNull()
  })
})
