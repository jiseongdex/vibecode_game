import type { LeaderboardDto, LeaderboardEntry } from '../../src/api/contracts'
import type { Env, SessionPrincipal } from '../types'

export interface RankedUserRow {
  id: string
  display_name: string
  highest_completed_stage: number
  highest_stage_best_time_seconds: number | null
  rank: number
}

function entry(row: RankedUserRow): LeaderboardEntry {
  return {
    rank: row.rank,
    userId: row.id,
    displayName: row.display_name,
    highestStage: row.highest_completed_stage,
    bestTimeSeconds: row.highest_stage_best_time_seconds,
  }
}

export function rankTopEntries(rows: RankedUserRow[]): LeaderboardEntry[] {
  return rows.map(entry)
}

export async function getCurrentRank(
  db: D1Database,
  principal: SessionPrincipal,
): Promise<LeaderboardEntry | null> {
  const row = await db.prepare(
    `SELECT u.id, u.display_name, COALESCE(u.highest_completed_stage, 0) AS highest_completed_stage,
       u.highest_stage_best_time_seconds,
       1 + (
         SELECT COUNT(*) FROM users AS better
         WHERE better.auth_type = u.auth_type
           AND (COALESCE(better.highest_completed_stage, 0) > COALESCE(u.highest_completed_stage, 0)
             OR (better.highest_completed_stage = u.highest_completed_stage
               AND better.highest_stage_best_time_seconds < u.highest_stage_best_time_seconds))
       ) AS rank
     FROM users AS u
     WHERE u.id = ? AND u.auth_type = ?`,
  ).bind(principal.userId, principal.authType).first<RankedUserRow>()
  return row ? entry(row) : null
}

export async function getLeaderboard(
  env: Env,
  principal: SessionPrincipal,
): Promise<LeaderboardDto> {
  const topRows = await env.DB.prepare(
    `SELECT id, display_name, COALESCE(highest_completed_stage, 0) AS highest_completed_stage,
       highest_stage_best_time_seconds,
       RANK() OVER (
         ORDER BY highest_completed_stage DESC, highest_stage_best_time_seconds ASC
       ) AS rank
     FROM users
     WHERE auth_type = ?
     ORDER BY highest_completed_stage DESC, highest_stage_best_time_seconds ASC, id ASC
     LIMIT 100`,
  ).bind(principal.authType).all<RankedUserRow>()
  return {
    top: rankTopEntries(topRows.results),
    current: await getCurrentRank(env.DB, principal),
  }
}
