import { createGameState, gameReducer } from '../game/gameState'
import { createSeededRandom, generateMaze } from '../game/mazeGenerator'
import { isSaveData, SAVE_KEY, SAVE_VERSION } from './saveSchema'
import type { SaveData } from './saveSchema'
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
    stageRecords: { 1: { bestTimeSeconds: 90 } },
    currentSession: makeSavedSession(moved, updatedAt),
  }
}

describe('saveStore', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => window.localStorage.clear())

  it('round trips the maze, player position, rescue state, timer, and time-only records', () => {
    const save = sampleSave()
    if (!save.currentSession) throw new Error('Expected an active sample session.')
    save.currentSession.state.rescues[0].rescued = true
    save.currentSession.state.followers = [{ row: 0, col: 0 }]
    save.currentSession.state.followerFacings = ['down']
    saveSave(save)
    const restored = loadSave()

    expect(restored).toEqual(save)
    expect(restored.currentSession?.state.status).toBe('paused')
    expect(restored.currentSession?.state.maze).toEqual(save.currentSession.state.maze)
    expect(restored.currentSession?.state.player).toEqual(save.currentSession.state.player)
    expect(restored.currentSession?.state.remainingSeconds).toBe(
      save.currentSession.state.remainingSeconds,
    )
    expect(restored.currentSession?.state.rescues[0].rescued).toBe(true)
    expect(restored.currentSession?.state.followers).toEqual([{ row: 0, col: 0 }])
    expect(restored.currentSession?.state).not.toHaveProperty('moveCount')
    expect(restored.stageRecords[1]).toEqual({ bestTimeSeconds: 90 })
    expect(JSON.parse(window.localStorage.getItem(SAVE_KEY)!).currentSession.state)
      .not.toHaveProperty('moveCount')

    clearSave()
    expect(loadSave()).toEqual(createEmptySave())
  })

  it('ignores malformed, old-version, and structurally invalid saves', () => {
    window.localStorage.setItem(SAVE_KEY, '{broken json')
    expect(loadSave()).toEqual(createEmptySave())

    const valid = sampleSave()
    const invalidSaves = [
      { ...valid, version: 2 },
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

  it('does not restore v1 or v2 saves during development', () => {
    window.localStorage.setItem('maze-rescue-game.save.v1', JSON.stringify({ version: 1 }))
    window.localStorage.setItem('maze-rescue-game.save.v2', JSON.stringify({ version: 2 }))

    expect(loadSave()).toEqual(createEmptySave())
    expect(window.localStorage.getItem(SAVE_KEY)).toBeNull()
    expect(window.localStorage.getItem('maze-rescue-game.save.v1')).not.toBeNull()
    expect(window.localStorage.getItem('maze-rescue-game.save.v2')).not.toBeNull()
  })

  it('keeps unlock progress, the best time, and the newest valid session when merging', () => {
    const local = sampleSave(100)
    const remote = sampleSave(300)
    remote.unlockedStage = 4
    remote.stageRecords = {
      1: { bestTimeSeconds: 110 },
      2: { bestTimeSeconds: 140 },
    }

    const merged = mergeSaveData(local, remote)
    expect(merged.unlockedStage).toBe(4)
    expect(merged.stageRecords[1]).toEqual({ bestTimeSeconds: 90 })
    expect(merged.stageRecords[2]).toEqual({ bestTimeSeconds: 140 })
    expect(merged.currentSession?.updatedAt).toBe(300)
  })

  it('only writes valid v3 data', () => {
    const invalid = { ...sampleSave(), version: 2 } as unknown as SaveData
    expect(isSaveData(invalid)).toBe(false)
    saveSave(invalid)
    expect(window.localStorage.getItem(SAVE_KEY)).toBeNull()
  })
})
