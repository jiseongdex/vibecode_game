import { createGameState, gameReducer } from '../game/gameState'
import { createSeededRandom, generateMaze } from '../game/mazeGenerator'
import { isSaveData, LEGACY_SAVE_KEY, SAVE_KEY, SAVE_VERSION } from './saveSchema'
import type { SaveData, SaveDataV1 } from './saveSchema'
import {
  clearSave,
  createEmptySave,
  loadSave,
  makeSavedSession,
  mergeSaveData,
  saveSave,
} from './saveStore'

function sampleSave(updatedAt = 100): SaveData {
  const maze = generateMaze(15, createSeededRandom(17))
  const ready = createGameState(1, maze)
  const playing = gameReducer(ready, { type: 'START', now: 10 })
  const direction = maze.cells[0][0].walls.right ? 'down' : 'right'
  const moved = gameReducer(playing, { type: 'MOVE', direction })

  return {
    version: SAVE_VERSION,
    unlockedStage: 2,
    stageRecords: { 1: { bestTimeSeconds: 90, bestMoveCount: 70 } },
    currentSession: makeSavedSession(moved, updatedAt),
  }
}

function legacySaveFrom(save: SaveData): SaveDataV1 {
  if (!save.currentSession) throw new Error('Expected an active sample session.')
  const state = { ...save.currentSession.state }
  Reflect.deleteProperty(state, 'playerFacing')
  Reflect.deleteProperty(state, 'followerFacings')
  return {
    version: 1,
    unlockedStage: save.unlockedStage,
    stageRecords: save.stageRecords,
    currentSession: {
      updatedAt: save.currentSession.updatedAt,
      state,
    },
  }
}

describe('saveStore', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => window.localStorage.clear())

  it('round trips the exact maze, player position, rescue state, and paused timer', () => {
    const save = sampleSave()
    if (!save.currentSession) throw new Error('Expected an active sample session.')
    save.currentSession.state.rescues[0].rescued = true
    save.currentSession.state.followers = [{ row: 0, col: 0 }]
    save.currentSession.state.followerFacings = ['down']
    saveSave(save)
    const restored = loadSave()

    expect(restored).toEqual(save)
    expect(restored.currentSession?.state.status).toBe('paused')
    expect(restored.currentSession?.state.maze).toEqual(save.currentSession?.state.maze)
    expect(restored.currentSession?.state.player).toEqual(save.currentSession?.state.player)
    expect(restored.currentSession?.state.remainingSeconds).toBe(
      save.currentSession?.state.remainingSeconds,
    )
    expect(restored.currentSession?.state.moveCount).toBe(1)
    expect(restored.currentSession?.state.rescues[0].rescued).toBe(true)
    expect(restored.currentSession?.state.followers).toEqual([{ row: 0, col: 0 }])
    expect(restored.currentSession?.state.followerFacings).toEqual(['down'])

    clearSave()
    expect(loadSave()).toEqual(createEmptySave())
  })

  it('ignores malformed, old-version, and structurally invalid saves', () => {
    window.localStorage.setItem(SAVE_KEY, '{broken json')
    expect(loadSave()).toEqual(createEmptySave())

    const valid = sampleSave()
    const invalidSaves = [
      { ...valid, version: 3 },
      { ...valid, currentSession: { ...valid.currentSession, state: {
        ...valid.currentSession?.state,
        playerFacing: 'diagonal',
      } } },
      { ...valid, currentSession: { ...valid.currentSession, state: {
        ...valid.currentSession?.state,
        followerFacings: ['left'],
      } } },
      { ...valid, stageRecords: undefined },
      { ...valid, currentSession: { ...valid.currentSession, state: {
        ...valid.currentSession?.state,
        stageConfig: { ...valid.currentSession?.state.stageConfig, size: 33 },
      } } },
      { ...valid, currentSession: { ...valid.currentSession, state: {
        ...valid.currentSession?.state,
        player: { row: 99, col: 0 },
      } } },
      { ...valid, currentSession: { ...valid.currentSession, state: {
        ...valid.currentSession?.state,
        maze: { ...valid.currentSession?.state.maze, cells: [] },
      } } },
    ]

    for (const invalid of invalidSaves) {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(invalid))
      expect(loadSave()).toEqual(createEmptySave())
    }
  })

  it('migrates a valid v1 session without losing progress, time, or rescue order', () => {
    const source = sampleSave(250)
    if (!source.currentSession) throw new Error('Expected an active sample session.')
    source.currentSession.state.rescues[0].rescued = true
    source.currentSession.state.followers = [{ row: 0, col: 0 }]
    source.currentSession.state.followerFacings = ['left']
    const legacy = legacySaveFrom(source)
    window.localStorage.setItem(LEGACY_SAVE_KEY, JSON.stringify(legacy))

    const migrated = loadSave()
    expect(migrated).toMatchObject({
      version: 2,
      unlockedStage: source.unlockedStage,
      stageRecords: source.stageRecords,
      currentSession: {
        updatedAt: 250,
        state: {
          maze: source.currentSession.state.maze,
          player: source.currentSession.state.player,
          rescues: source.currentSession.state.rescues,
          followers: source.currentSession.state.followers,
          remainingSeconds: source.currentSession.state.remainingSeconds,
          moveCount: source.currentSession.state.moveCount,
          playerFacing: 'down',
          followerFacings: ['down'],
        },
      },
    })
    expect(window.localStorage.getItem(SAVE_KEY)).not.toBeNull()
    expect(window.localStorage.getItem(LEGACY_SAVE_KEY)).toBeNull()
  })

  it('migrates v1 unlocks and records when there is no active session', () => {
    const legacy = { ...legacySaveFrom(sampleSave()), currentSession: null }
    window.localStorage.setItem(LEGACY_SAVE_KEY, JSON.stringify(legacy))

    expect(loadSave()).toEqual({
      version: SAVE_VERSION,
      unlockedStage: legacy.unlockedStage,
      stageRecords: legacy.stageRecords,
      currentSession: null,
    })
    expect(window.localStorage.getItem(LEGACY_SAVE_KEY)).toBeNull()
  })

  it('prefers valid v2 data and recovers from a corrupt v2 using valid v1', () => {
    const legacy = legacySaveFrom(sampleSave(150))
    window.localStorage.setItem(LEGACY_SAVE_KEY, JSON.stringify(legacy))
    const current = sampleSave(300)
    saveSave(current)
    expect(loadSave()).toEqual(current)
    expect(window.localStorage.getItem(LEGACY_SAVE_KEY)).not.toBeNull()

    window.localStorage.setItem(SAVE_KEY, '{broken json')
    const recovered = loadSave()
    expect(recovered.currentSession?.updatedAt).toBe(150)
    expect(recovered.currentSession?.state.playerFacing).toBe('down')
    expect(window.localStorage.getItem(LEGACY_SAVE_KEY)).toBeNull()
  })

  it('keeps v1 data when migration cannot write v2 and clears both keys', () => {
    const legacy = legacySaveFrom(sampleSave())
    window.localStorage.setItem(LEGACY_SAVE_KEY, JSON.stringify(legacy))
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage is full')
    })
    try {
      expect(loadSave().currentSession?.state.playerFacing).toBe('down')
      expect(window.localStorage.getItem(LEGACY_SAVE_KEY)).not.toBeNull()
      expect(window.localStorage.getItem(SAVE_KEY)).toBeNull()
    } finally {
      setItem.mockRestore()
    }

    clearSave()
    expect(window.localStorage.getItem(LEGACY_SAVE_KEY)).toBeNull()
    expect(window.localStorage.getItem(SAVE_KEY)).toBeNull()
  })

  it('rejects invalid v1 data instead of migrating it and only writes valid v2', () => {
    const legacy = legacySaveFrom(sampleSave())
    window.localStorage.setItem(LEGACY_SAVE_KEY, JSON.stringify({
      ...legacy,
      currentSession: { ...legacy.currentSession, state: {
        ...legacy.currentSession?.state,
        maze: { ...legacy.currentSession?.state.maze, cells: [] },
      } },
    }))
    expect(loadSave()).toEqual(createEmptySave())
    expect(window.localStorage.getItem(SAVE_KEY)).toBeNull()

    const invalid = sampleSave()
    if (!invalid.currentSession) throw new Error('Expected an active sample session.')
    invalid.currentSession.state.followerFacings = ['up']
    expect(isSaveData(invalid)).toBe(false)
    saveSave(invalid)
    expect(window.localStorage.getItem(SAVE_KEY)).toBeNull()
  })

  it('keeps further unlocks, better records, and the newest valid session', () => {
    const local = sampleSave(100)
    const remote = sampleSave(300)
    remote.unlockedStage = 4
    remote.stageRecords = {
      1: { bestTimeSeconds: 110, bestMoveCount: 40 },
      2: { bestTimeSeconds: 140, bestMoveCount: 90 },
    }

    const merged = mergeSaveData(local, remote)
    expect(merged.unlockedStage).toBe(4)
    expect(merged.stageRecords[1]).toEqual({ bestTimeSeconds: 90, bestMoveCount: 40 })
    expect(merged.stageRecords[2]).toEqual({ bestTimeSeconds: 140, bestMoveCount: 90 })
    expect(merged.currentSession?.updatedAt).toBe(300)
  })
})
