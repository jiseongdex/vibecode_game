import { createGameState, gameReducer } from '../game/gameState'
import { createSeededRandom, generateMaze } from '../game/mazeGenerator'
import { SAVE_KEY, SAVE_VERSION } from './saveSchema'
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
    stageRecords: { 1: { bestTimeSeconds: 90, bestMoveCount: 70 } },
    currentSession: makeSavedSession(moved, updatedAt),
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

    clearSave()
    expect(loadSave()).toEqual(createEmptySave())
  })

  it('ignores malformed, old-version, and structurally invalid saves', () => {
    window.localStorage.setItem(SAVE_KEY, '{broken json')
    expect(loadSave()).toEqual(createEmptySave())

    const valid = sampleSave()
    const invalidSaves = [
      { ...valid, version: 2 },
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
