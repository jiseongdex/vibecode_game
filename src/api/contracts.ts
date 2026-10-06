export type AuthType = 'microsoft' | 'simple'

export interface PublicUser {
  id: string
  authType: AuthType
  displayName: string
}

export interface ProgressDto {
  unlockedStage: number
  stageRecords: Record<number, { bestTimeSeconds: number }>
}

export interface LeaderboardEntry {
  rank: number
  userId: string
  displayName: string
  highestStage: number
  bestTimeSeconds: number
}

export interface LeaderboardDto {
  top: LeaderboardEntry[]
  current: LeaderboardEntry | null
}

export interface ApiError {
  error: {
    code: string
    message: string
  }
}
