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

export interface SessionDto {
  user: PublicUser
  progress: ProgressDto
}

export interface StartRunRequest {
  stage: number
}

export interface StartRunDto {
  attemptId: string
  stage: number
  startedAtMs: number
}

export interface FinishRunRequest {
  attemptId: string
  clearTimeSeconds: number
}

export interface FinishRunDto {
  progress: ProgressDto
}

export interface LeaderboardEntry {
  rank: number
  userId: string
  displayName: string
  highestStage: number
  bestTimeSeconds: number | null
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
