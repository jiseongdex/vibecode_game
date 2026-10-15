// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { AzurePrincipal } from '../auth/session'
import { MICROSOFT_SCOPE, UNRANKED_TIME_SECONDS, type AzureStore, type UserDoc } from '../model'
import { getLeaderboard, rankEntries } from './leaderboard'

const principal: AzurePrincipal = { userId: 'player-101', displayName: 'Player 101', authType: 'microsoft' }

function user(id: string, stage: number, seconds: number | null): UserDoc {
  return {
    id, scope: MICROSOFT_SCOPE, type: 'user', tid: 'tenant', sub: id,
    displayName: id, unlockedStage: Math.min(20, stage + 1), highestStage: stage,
    bestTimeSeconds: seconds, rankTimeSeconds: seconds ?? UNRANKED_TIME_SECONDS,
    stageRecords: {}, createdAtMs: 1, updatedAtMs: 1,
  }
}

function storeFixture(users: UserDoc[]) {
  const documents = new Map(users.map((item) => [item.id, item]))
  const ordered = [...users].sort((a, b) =>
    b.highestStage - a.highestStage || a.rankTimeSeconds - b.rankTimeSeconds || a.id.localeCompare(b.id))
  const store = {
    getUser: async (id: string) => documents.get(id) ?? null,
    topUsers: async (limit: 100) => ordered.slice(0, limit),
    countBetterUsers: async (stage: number, seconds: number | null) => ordered.filter((item) =>
      item.highestStage > stage || (item.highestStage === stage &&
        item.rankTimeSeconds < (seconds ?? UNRANKED_TIME_SECONDS))).length,
  } as AzureStore
  return { store, documents }
}

describe('Azure Microsoft leaderboard', () => {
  it('ranks highest stage first, then fastest time, sharing exact ties', async () => {
    const users = [
      user('slow-20', 20, 300), user('tie-b', 20, 200), user('tie-a', 20, 200),
      user('fast-19', 19, 2), user('no-record-b', 0, null), user('no-record-a', 0, null),
    ]
    const { store } = storeFixture(users)
    const result = await getLeaderboard(store, { ...principal, userId: 'tie-b' })
    expect(result.top.map(({ userId, rank }) => [userId, rank])).toEqual([
      ['tie-a', 1], ['tie-b', 1], ['slow-20', 3], ['fast-19', 4], ['no-record-a', 5], ['no-record-b', 5],
    ])
    expect(result.current).toEqual({ rank: 1, userId: 'tie-b', displayName: 'tie-b', highestStage: 20, bestTimeSeconds: 200 })
    const zero = await getLeaderboard(store, { ...principal, userId: 'no-record-b' })
    expect(zero.current).toEqual({ rank: 5, userId: 'no-record-b', displayName: 'no-record-b', highestStage: 0, bestTimeSeconds: null })
    expect(rankEntries(users.slice(0, 2), 10).map((entry) => entry.rank)).toEqual([11, 12])
  })

  it('limits the list to 100 while showing the current user at rank 101', async () => {
    const users = Array.from({ length: 101 }, (_, index) => user(`player-${String(index + 1).padStart(3, '0')}`, 1, index + 2))
    const { store } = storeFixture(users)
    const result = await getLeaderboard(store, principal)
    expect(result.top).toHaveLength(100)
    expect(result.top[0]).toMatchObject({ rank: 1, userId: 'player-001' })
    expect(result.top[99]).toMatchObject({ rank: 100, userId: 'player-100' })
    expect(result.current).toEqual({ rank: 101, userId: 'player-101', displayName: 'player-101', highestStage: 1, bestTimeSeconds: 102 })
  })

  it('requires an existing user and returns only public ranking fields', async () => {
    const { store } = storeFixture([user('player-101', 0, null)])
    await expect(getLeaderboard(store, { ...principal, userId: 'deleted' })).rejects.toMatchObject({ status: 401, code: 'unauthorized' })
    const dto = await getLeaderboard(store, principal)
    expect(Object.keys(dto.top[0]).sort()).toEqual(['bestTimeSeconds', 'displayName', 'highestStage', 'rank', 'userId'])
    expect(JSON.stringify(dto)).not.toMatch(/tid|sub|session|pin/i)
  })
})
