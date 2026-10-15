import { createHash } from 'node:crypto'
import { CosmosClient, type Container, type JSONObject, type OperationInput } from '@azure/cosmos'
import type { AzureConfig } from './config.js'
import {
  MICROSOFT_SCOPE,
  UNRANKED_TIME_SECONDS,
  type AttemptDoc,
  type AzureStore,
  type OAuthFlowDoc,
  type SessionDoc,
  type UserDoc,
} from './model.js'

function status(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const candidate = error as { code?: unknown; statusCode?: unknown }
  const value = candidate.statusCode ?? candidate.code
  return typeof value === 'number' ? value : undefined
}

function isConflict(error: unknown): boolean {
  return status(error) === 409 || status(error) === 412
}

function assertScope(doc: { scope: string }): void {
  if (doc.scope !== MICROSOFT_SCOPE) throw new Error('Invalid Azure document scope.')
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function microsoftUserId(tid: string, sub: string): string {
  if (!tid || !sub) throw new Error('Microsoft identity is incomplete.')
  return `u_${sha256(`${tid}:${sub}`)}`
}

export function normalizeDisplayName(value: string): string {
  const clean = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim().slice(0, 80).trim()
  return clean || 'Microsoft 사용자'
}

function withoutEtag<T extends { _etag?: string }>(doc: T): Omit<T, '_etag'> {
  const { _etag: _ignored, ...body } = doc
  return body
}

async function pointRead<T extends { id: string; scope: string; _etag?: string }>(
  container: Container,
  id: string,
): Promise<T | null> {
  try {
    const result = await container.item(id, MICROSOFT_SCOPE).read<T>()
    if (!result.resource) return null
    const doc = result.resource
    if (doc.scope !== MICROSOFT_SCOPE || doc.id !== id) return null
    return { ...doc, _etag: doc._etag ?? result.etag }
  } catch (error) {
    if (status(error) === 404) return null
    throw error
  }
}

export class CosmosStore implements AzureStore {
  constructor(
    private readonly game: Container,
    private readonly auth: Container,
  ) {}

  async getUser(id: string): Promise<UserDoc | null> {
    const doc = await pointRead<UserDoc>(this.game, id)
    return doc?.type === 'user' ? doc : null
  }

  async getOrCreateMicrosoftUser(
    tid: string,
    sub: string,
    displayName: string,
    nowMs: number,
  ): Promise<UserDoc> {
    const id = microsoftUserId(tid, sub)
    const name = normalizeDisplayName(displayName)
    const fresh: UserDoc = {
      id,
      scope: MICROSOFT_SCOPE,
      type: 'user',
      tid,
      sub,
      displayName: name,
      unlockedStage: 1,
      highestStage: 0,
      bestTimeSeconds: null,
      rankTimeSeconds: UNRANKED_TIME_SECONDS,
      stageRecords: {},
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    }

    try {
      const result = await this.game.items.create<UserDoc>(fresh)
      if (result.resource?._etag) return result.resource
      const created = await this.getUser(id)
      if (!created?._etag) throw new Error('Microsoft account has no ETag.')
      return created
    } catch (error) {
      if (status(error) !== 409) throw error
    }

    for (let retry = 0; retry < 3; retry += 1) {
      const existing = await this.getUser(id)
      if (!existing || existing.tid !== tid || existing.sub !== sub) {
        throw new Error('Microsoft account could not be loaded.')
      }
      if (existing.displayName === name) return existing
      if (!existing._etag) throw new Error('Microsoft account has no ETag.')
      try {
        return await this.replaceUser({ ...existing, displayName: name, updatedAtMs: nowMs }, existing._etag)
      } catch (error) {
        if (!isConflict(error) || retry === 2) throw error
      }
    }
    throw new Error('Microsoft account update failed.')
  }

  async replaceUser(user: UserDoc, etag: string): Promise<UserDoc> {
    assertScope(user)
    if (!etag) throw new Error('User ETag is required.')
    const result = await this.game.item(user.id, MICROSOFT_SCOPE).replace<UserDoc>(withoutEtag(user), {
      accessCondition: { type: 'IfMatch', condition: etag },
    })
    if (result.resource?._etag) return result.resource
    if (result.resource && result.etag) return { ...result.resource, _etag: result.etag }
    const replaced = await this.getUser(user.id)
    if (!replaced?._etag) throw new Error('Microsoft account has no ETag.')
    return replaced
  }

  async getAttempt(id: string): Promise<AttemptDoc | null> {
    const doc = await pointRead<AttemptDoc>(this.game, id)
    return doc?.type === 'attempt' ? doc : null
  }

  async createAttempt(doc: AttemptDoc): Promise<void> {
    assertScope(doc)
    if (doc.type !== 'attempt' || doc.status !== 'active' || doc.ttl !== 86_400) {
      throw new Error('Invalid new attempt.')
    }
    await this.game.items.create(withoutEtag(doc))
  }

  async finishAttemptAndUser(attempt: AttemptDoc, user: UserDoc): Promise<'ok' | 'conflict'> {
    assertScope(attempt)
    assertScope(user)
    if (
      !attempt._etag || !user._etag || attempt.userId !== user.id ||
      attempt.status !== 'finished' || attempt.ttl !== 2_592_000
    ) {
      throw new Error('Invalid attempt completion.')
    }
    const operations: OperationInput[] = [
      {
        operationType: 'Replace',
        id: user.id,
        resourceBody: withoutEtag(user) as unknown as JSONObject,
        ifMatch: user._etag,
      },
      {
        operationType: 'Replace',
        id: attempt.id,
        resourceBody: withoutEtag(attempt) as unknown as JSONObject,
        ifMatch: attempt._etag,
      },
    ]
    try {
      const result = await this.game.items.batch(operations, MICROSOFT_SCOPE)
      const codes = [result.code, ...(result.result ?? []).map((item) => item.statusCode)]
      if (codes.some((code) => code === 409 || code === 412)) return 'conflict'
      if (codes.some((code) => code !== undefined && (code < 200 || code >= 300))) {
        throw new Error('Cosmos transactional batch failed.')
      }
      if (!result.result || result.result.length !== 2) {
        throw new Error('Cosmos transactional batch returned no operations.')
      }
      return 'ok'
    } catch (error) {
      if (isConflict(error)) return 'conflict'
      throw error
    }
  }

  async topUsers(limit: 100): Promise<UserDoc[]> {
    const { resources } = await this.game.items.query<UserDoc>({
      query: `SELECT TOP @limit * FROM c WHERE c.type = 'user'
        ORDER BY c.highestStage DESC, c.rankTimeSeconds ASC, c.id ASC`,
      parameters: [{ name: '@limit', value: limit }],
    }, { partitionKey: MICROSOFT_SCOPE }).fetchAll()
    return resources
  }

  async countBetterUsers(highestStage: number, bestTimeSeconds: number | null): Promise<number> {
    const rankTime = bestTimeSeconds ?? UNRANKED_TIME_SECONDS
    const { resources } = await this.game.items.query<number>({
      query: `SELECT VALUE COUNT(1) FROM c WHERE c.type = 'user'
        AND (c.highestStage > @stage OR
          (c.highestStage = @stage AND c.rankTimeSeconds < @rankTime))`,
      parameters: [
        { name: '@stage', value: highestStage },
        { name: '@rankTime', value: rankTime },
      ],
    }, { partitionKey: MICROSOFT_SCOPE }).fetchAll()
    return resources[0] ?? 0
  }

  async putFlow(doc: OAuthFlowDoc): Promise<void> {
    assertScope(doc)
    if (doc.type !== 'oauthFlow' || doc.ttl !== 600) throw new Error('Invalid OAuth flow.')
    await this.auth.items.create(withoutEtag(doc))
  }

  async takeFlow(id: string, nowMs: number): Promise<OAuthFlowDoc | null> {
    const doc = await pointRead<OAuthFlowDoc>(this.auth, id)
    if (!doc || doc.type !== 'oauthFlow' || doc.expiresAtMs <= nowMs) return null
    if (!doc._etag) throw new Error('OAuth flow has no ETag.')
    try {
      await this.auth.item(id, MICROSOFT_SCOPE).delete({
        accessCondition: { type: 'IfMatch', condition: doc._etag },
      })
      return doc
    } catch (error) {
      if (status(error) === 404 || status(error) === 412) return null
      throw error
    }
  }

  async putSession(doc: SessionDoc): Promise<void> {
    assertScope(doc)
    if (doc.type !== 'session' || doc.ttl !== 604_800) throw new Error('Invalid session.')
    await this.auth.items.create(doc)
  }

  async getSession(id: string): Promise<SessionDoc | null> {
    const doc = await pointRead<SessionDoc>(this.auth, id)
    return doc?.type === 'session' ? doc : null
  }

  async deleteSession(id: string): Promise<void> {
    try {
      await this.auth.item(id, MICROSOFT_SCOPE).delete()
    } catch (error) {
      if (status(error) !== 404) throw error
    }
  }
}

let cached: {
  endpoint: string
  key: string
  database: string
  store: AzureStore
} | undefined

export function createCosmosStore(
  config: Pick<AzureConfig, 'cosmosEndpoint' | 'cosmosKey' | 'cosmosDatabase'>,
  client?: CosmosClient,
): AzureStore {
  if (
    !client && cached?.endpoint === config.cosmosEndpoint && cached.key === config.cosmosKey &&
    cached.database === config.cosmosDatabase
  ) return cached.store
  const cosmos = client ?? new CosmosClient({ endpoint: config.cosmosEndpoint, key: config.cosmosKey })
  const database = cosmos.database(config.cosmosDatabase)
  const store = new CosmosStore(database.container('game'), database.container('auth'))
  if (!client) cached = {
    endpoint: config.cosmosEndpoint,
    key: config.cosmosKey,
    database: config.cosmosDatabase,
    store,
  }
  return store
}
