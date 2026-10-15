import { ApiFailure, type AzurePrincipal } from '../auth/session.js'
import type { AzureStore, UserDoc } from '../model.js'

interface LeaderboardEntry {
  rank: number
  userId: string
  displayName: string
  highestStage: number
  bestTimeSeconds: number | null
}

interface LeaderboardDto {
  top: LeaderboardEntry[]
  current: LeaderboardEntry | null
}

function entry(user: UserDoc, rank: number): LeaderboardEntry {
  return {
    rank,
    userId: user.id,
    displayName: user.displayName,
    highestStage: user.highestStage,
    bestTimeSeconds: user.bestTimeSeconds,
  }
}

export function rankEntries(users: UserDoc[], precedingBetterCount = 0): LeaderboardEntry[] {
  const sorted = [...users].sort((a, b) =>
    b.highestStage - a.highestStage || a.rankTimeSeconds - b.rankTimeSeconds || a.id.localeCompare(b.id))
  let rank = precedingBetterCount + 1
  return sorted.map((user, index) => {
    if (index > 0 && (user.highestStage !== sorted[index - 1].highestStage ||
      user.rankTimeSeconds !== sorted[index - 1].rankTimeSeconds)) {
      rank = precedingBetterCount + index + 1
    }
    return entry(user, rank)
  })
}

export async function getLeaderboard(store: AzureStore, principal: AzurePrincipal): Promise<LeaderboardDto> {
  const user = await store.getUser(principal.userId)
  if (!user) throw new ApiFailure(401, 'unauthorized', 'Sign in to continue.')
  const [topUsers, betterCount] = await Promise.all([
    store.topUsers(100),
    store.countBetterUsers(user.highestStage, user.bestTimeSeconds),
  ])
  return {
    top: rankEntries(topUsers),
    current: entry(user, betterCount + 1),
  }
}
