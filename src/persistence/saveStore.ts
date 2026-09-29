import { createCampaignProgress } from '../game/campaignProgress'
import type { GameState } from '../game/gameState'
import { gameReducer } from '../game/gameState'
import { isSaveData, SAVE_KEY, SAVE_VERSION } from './saveSchema'
import type { SaveData, SavedSession } from './saveSchema'

export function createEmptySave(): SaveData {
  const progress = createCampaignProgress()
  return {
    version: SAVE_VERSION,
    unlockedStage: progress.unlockedStage,
    stageRecords: progress.stageRecords,
    currentSession: null,
  }
}

export function makeSavedSession(state: GameState, now = Date.now()): SavedSession | null {
  if (state.status === 'won' || state.status === 'lost') return null

  const paused =
    state.status === 'playing'
      ? gameReducer(state, { type: 'PAUSE', now })
      : state.status === 'ready'
        ? { ...state, status: 'paused' as const, pausedAt: now }
        : state

  return { state: paused as SavedSession['state'], updatedAt: now }
}

export function loadSave(): SaveData {
  try {
    if (typeof window === 'undefined') return createEmptySave()
    const raw = window.localStorage.getItem(SAVE_KEY)
    if (!raw) return createEmptySave()
    const parsed: unknown = JSON.parse(raw)
    return isSaveData(parsed) ? parsed : createEmptySave()
  } catch {
    return createEmptySave()
  }
}

export function saveSave(data: SaveData): void {
  try {
    if (typeof window !== 'undefined' && isSaveData(data)) {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    }
  } catch {
    // Storage can be disabled or full; the current in-memory game remains playable.
  }
}

export function clearSave(): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(SAVE_KEY)
  } catch {
    // Storage can be disabled; do not interrupt gameplay.
  }
}

export function mergeSaveData(local: SaveData, remote: SaveData): SaveData {
  const safeLocal = isSaveData(local) ? local : createEmptySave()
  const safeRemote = isSaveData(remote) ? remote : createEmptySave()
  const stageRecords: SaveData['stageRecords'] = {}

  for (const stage of new Set([
    ...Object.keys(safeLocal.stageRecords),
    ...Object.keys(safeRemote.stageRecords),
  ])) {
    const numericStage = Number(stage)
    const localRecord = safeLocal.stageRecords[numericStage]
    const remoteRecord = safeRemote.stageRecords[numericStage]
    stageRecords[numericStage] = {
      bestTimeSeconds: Math.min(
        localRecord?.bestTimeSeconds ?? Infinity,
        remoteRecord?.bestTimeSeconds ?? Infinity,
      ),
      bestMoveCount: Math.min(
        localRecord?.bestMoveCount ?? Infinity,
        remoteRecord?.bestMoveCount ?? Infinity,
      ),
    }
  }

  const sessions = [safeLocal.currentSession, safeRemote.currentSession].filter(
    (session): session is SavedSession => session !== null,
  )
  const currentSession = sessions.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null

  return {
    version: SAVE_VERSION,
    unlockedStage: Math.max(safeLocal.unlockedStage, safeRemote.unlockedStage),
    stageRecords,
    currentSession,
  }
}
