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
    save.currentSession.state.followers = [{ ...save.currentSession.state.player }]
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
    expect(restored.currentSession?.state.followers).toEqual([
      save.currentSession.state.player,
    ])
    expect(restored.currentSession?.state).not.toHaveProperty('moveCount')
    expect(restored.stageRecords[1]).toEqual({ bestTimeSeconds: 90 })
    expect(JSON.parse(window.localStorage.getItem(SAVE_KEY)!).currentSession.state)
      .not.toHaveProperty('moveCount')

    clearSave()
    expect(loadSave()).toEqual(createEmptySave())
  })

  it('restores randomized and legacy animal IDs without changing the save version', () => {
    const maze = generateMaze(20, createSeededRandom(51))
    const ready = createGameState(5, maze)
    const save: SaveData = {
      version: SAVE_VERSION,
      unlockedStage: 5,
      stageRecords: {},
      currentSession: makeSavedSession(ready, 100),
    }

    saveSave(save)
    expect(loadSave().currentSession?.state.rescues.map((target) => target.id))
      .toEqual(ready.rescues.map((target) => target.id))

    const legacyTargets = ready.rescues.map((target, index) => ({
      ...target,
      id: `rescue-${index + 1}`,
    }))
    saveSave({
      ...save,
      currentSession: makeSavedSession({ ...ready, rescues: legacyTargets }, 200),
    })
    expect(loadSave().currentSession?.state.rescues.map((target) => target.id))
      .toEqual(legacyTargets.map((target) => target.id))
  })

  it('keeps v4 campaign progress while dropping its incompatible active maze', () => {
    const old = sampleSave()
    window.localStorage.setItem('maze-rescue-game.save.v4', JSON.stringify({
      ...old,
      version: 4,
      currentSession: {
        ...old.currentSession,
        state: {
          ...old.currentSession?.state,
          stageConfig: { ...old.currentSession?.state.stageConfig, timeLimitSeconds: 98 },
        },
      },
    }))

    expect(loadSave()).toEqual({
      version: SAVE_VERSION,
      unlockedStage: old.unlockedStage,
      stageRecords: old.stageRecords,
      currentSession: null,
    })
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

  it('does not restore v1, v2, or v3 saves during development', () => {
    window.localStorage.setItem('maze-rescue-game.save.v1', JSON.stringify({ version: 1 }))
    window.localStorage.setItem('maze-rescue-game.save.v2', JSON.stringify({ version: 2 }))
    window.localStorage.setItem('maze-rescue-game.save.v3', JSON.stringify({ version: 3 }))

    expect(loadSave()).toEqual(createEmptySave())
    expect(window.localStorage.getItem(SAVE_KEY)).toBeNull()
    expect(window.localStorage.getItem('maze-rescue-game.save.v1')).not.toBeNull()
    expect(window.localStorage.getItem('maze-rescue-game.save.v2')).not.toBeNull()
    expect(window.localStorage.getItem('maze-rescue-game.save.v3')).not.toBeNull()
  })

  it('clears current and previous save keys', () => {
    for (const key of [
      'maze-rescue-game.save.v5',
      'maze-rescue-game.save.v4',
      'maze-rescue-game.save.v3',
      'maze-rescue-game.save.v2',
      'maze-rescue-game.save.v1',
    ]) {
      window.localStorage.setItem(key, 'saved')
    }

    clearSave()

    expect(window.localStorage.length).toBe(0)
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

  it('only writes valid v5 data', () => {
    const invalid = { ...sampleSave(), version: 2 } as unknown as SaveData
    expect(isSaveData(invalid)).toBe(false)
    saveSave(invalid)
    expect(window.localStorage.getItem(SAVE_KEY)).toBeNull()
  })
})
