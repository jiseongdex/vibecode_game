import type { ProgressDto } from '../api/contracts'
import { getTimeLimitSeconds, MAX_STAGE, MIN_STAGE } from '../game/stageConfig'
import { isSaveData, SAVE_VERSION, type SavedSession } from './saveSchema'

export interface PendingResult {
  attemptId: string
  stage: number
  clearTimeSeconds: number
}

export interface AccountLocalSave {
  version: 1
  userId: string
  currentSession: SavedSession | null
  attemptId: string | null
  pendingResult: PendingResult | null
}

const ATTEMPT_ID = /^(?:a_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function accountSaveKey(userId: string): string {
  return `maze-rescue-game.account.${encodeURIComponent(userId)}.session.v1`
}

function emptySave(userId: string): AccountLocalSave {
  return { version: 1, userId, currentSession: null, attemptId: null, pendingResult: null }
}

function validPending(value: unknown, unlockedStage: number): value is PendingResult | null {
  if (value === null) return true
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const pending = value as Record<string, unknown>
  return typeof pending.attemptId === 'string' && ATTEMPT_ID.test(pending.attemptId) &&
    typeof pending.stage === 'number' && Number.isInteger(pending.stage) &&
    pending.stage >= MIN_STAGE && pending.stage <= Math.min(MAX_STAGE, unlockedStage) &&
    typeof pending.clearTimeSeconds === 'number' && Number.isInteger(pending.clearTimeSeconds) &&
    pending.clearTimeSeconds >= 2 &&
    pending.clearTimeSeconds <= getTimeLimitSeconds(pending.stage)
}

export function loadAccountSave(userId: string, progress: ProgressDto): AccountLocalSave {
  try {
    if (typeof window === 'undefined') return emptySave(userId)
    const raw = window.localStorage.getItem(accountSaveKey(userId))
    if (!raw) return emptySave(userId)
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return emptySave(userId)
    const save = value as Record<string, unknown>
    if (save.version !== 1 || save.userId !== userId) return emptySave(userId)
    if (save.attemptId !== null &&
      (typeof save.attemptId !== 'string' || !ATTEMPT_ID.test(save.attemptId))) {
      return emptySave(userId)
    }
    if ((save.currentSession === null) !== (save.attemptId === null)) return emptySave(userId)
    if (!validPending(save.pendingResult, progress.unlockedStage)) return emptySave(userId)
    if (!isSaveData({
      version: SAVE_VERSION,
      unlockedStage: progress.unlockedStage,
      stageRecords: progress.stageRecords,
      currentSession: save.currentSession,
    })) return emptySave(userId)
    return save as unknown as AccountLocalSave
  } catch {
    return emptySave(userId)
  }
}

export function saveAccountSave(value: AccountLocalSave): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(accountSaveKey(value.userId), JSON.stringify(value))
    }
  } catch {
    // Private browsing or a full device store must not crash the active game.
  }
}

export function clearAccountSession(userId: string, progress: ProgressDto): void {
  const save = loadAccountSave(userId, progress)
  saveAccountSave({ ...save, currentSession: null, attemptId: null })
}
