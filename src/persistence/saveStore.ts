import { createCampaignProgress } from '../game/campaignProgress'
import type { GameState } from '../game/gameState'
import { gameReducer } from '../game/gameState'
import {
  isSaveData,
  isSaveDataV1,
  LEGACY_SAVE_KEY,
  SAVE_KEY,
  SAVE_VERSION,
} from './saveSchema'
import type { SaveData, SaveDataV1, SavedSession } from './saveSchema'

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

export function migrateV1Save(save: SaveDataV1): SaveData {
  return {
    version: SAVE_VERSION,
    unlockedStage: save.unlockedStage,
    stageRecords: save.stageRecords,
    currentSession: save.currentSession === null
      ? null
      : {
          ...save.currentSession,
          state: {
            ...save.currentSession.state,
            playerFacing: 'down',
            followerFacings: save.currentSession.state.followers.map(() => 'down'),
          },
        },
  }
}

function parseStoredSave(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function loadSave(): SaveData {
  try {
    if (typeof window === 'undefined') return createEmptySave()
    const current = parseStoredSave(window.localStorage.getItem(SAVE_KEY))
    if (isSaveData(current)) return current

    const legacy = parseStoredSave(window.localStorage.getItem(LEGACY_SAVE_KEY))
    if (!isSaveDataV1(legacy)) return createEmptySave()

    const migrated = migrateV1Save(legacy)
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(migrated))
      window.localStorage.removeItem(LEGACY_SAVE_KEY)
    } catch {
      // Preserve the v1 save when storage cannot complete migration.
    }
    return migrated
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
  if (typeof window === 'undefined') return
  for (const key of [SAVE_KEY, LEGACY_SAVE_KEY]) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // Storage can be disabled; do not interrupt gameplay.
    }
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
