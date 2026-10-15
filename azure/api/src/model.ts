export const MICROSOFT_SCOPE = 'microsoft' as const
export const UNRANKED_TIME_SECONDS = 2_147_483_647

export type StageRecordMap = Record<string, { bestTimeSeconds: number }>

export interface UserDoc {
  id: string
  scope: typeof MICROSOFT_SCOPE
  type: 'user'
  tid: string
  sub: string
  displayName: string
  unlockedStage: number
  highestStage: number
  bestTimeSeconds: number | null
  rankTimeSeconds: number
  stageRecords: StageRecordMap
  createdAtMs: number
  updatedAtMs: number
  _etag?: string
}

export interface AttemptDoc {
  id: string
  scope: typeof MICROSOFT_SCOPE
  type: 'attempt'
  userId: string
  stage: number
  startedAtMs: number
  finishedAtMs?: number
  status: 'active' | 'finished'
  ttl: number
  _etag?: string
}

export interface SessionDoc {
  id: string
  scope: typeof MICROSOFT_SCOPE
  type: 'session'
  userId: string
  createdAtMs: number
  expiresAtMs: number
  ttl: number
}

export interface OAuthFlowDoc {
  id: string
  scope: typeof MICROSOFT_SCOPE
  type: 'oauthFlow'
  nonce: string
  codeVerifier: string
  createdAtMs: number
  expiresAtMs: number
  ttl: number
  _etag?: string
}

export interface AzureStore {
  getUser(id: string): Promise<UserDoc | null>
  getOrCreateMicrosoftUser(tid: string, sub: string, displayName: string, nowMs: number): Promise<UserDoc>
  replaceUser(user: UserDoc, etag: string): Promise<UserDoc>
  getAttempt(id: string): Promise<AttemptDoc | null>
  createAttempt(doc: AttemptDoc): Promise<void>
  finishAttemptAndUser(attempt: AttemptDoc, user: UserDoc): Promise<'ok' | 'conflict'>
  topUsers(limit: 100): Promise<UserDoc[]>
  countBetterUsers(highestStage: number, bestTimeSeconds: number | null): Promise<number>
  putFlow(doc: OAuthFlowDoc): Promise<void>
  takeFlow(id: string, nowMs: number): Promise<OAuthFlowDoc | null>
  putSession(doc: SessionDoc): Promise<void>
  getSession(id: string): Promise<SessionDoc | null>
  deleteSession(id: string): Promise<void>
}
