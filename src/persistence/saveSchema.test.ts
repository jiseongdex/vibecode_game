import { createGameState, gameReducer } from '../game/gameState'
import { createSeededRandom, generateMaze } from '../game/mazeGenerator'
import { isSaveData, SAVE_VERSION } from './saveSchema'
import type { SaveData } from './saveSchema'
import { makeSavedSession } from './saveStore'

function validSave(): SaveData {
  const maze = generateMaze(15, createSeededRandom(17))
  const state = gameReducer(createGameState(1, maze), { type: 'START', now: 10 })
  return {
    version: SAVE_VERSION,
    unlockedStage: 1,
    stageRecords: { 1: { bestTimeSeconds: 85 } },
    currentSession: makeSavedSession(state, 20),
  }
}

describe('save schema v4', () => {
  it('accepts time-only progress and sessions without movement statistics', () => {
    const save = validSave()
    expect(isSaveData(save)).toBe(true)
    expect(save.currentSession?.state).not.toHaveProperty('moveCount')
    expect(save.stageRecords[1]).not.toHaveProperty('bestMoveCount')
  })

  it('rejects v3 saves, invalid movement tiles, and invalid clear times', () => {
    const save = validSave()
    expect(isSaveData({ ...save, version: 3 })).toBe(false)
    expect(isSaveData({
      ...save,
      currentSession: save.currentSession && {
        ...save.currentSession,
        state: { ...save.currentSession.state, player: { row: 2, col: 2 } },
      },
    })).toBe(false)
    expect(isSaveData({
      ...save,
      currentSession: save.currentSession && {
        ...save.currentSession,
        state: { ...save.currentSession.state, exit: { row: 1, col: 2 } },
      },
    })).toBe(false)
    expect(isSaveData({ ...save, stageRecords: { 1: { bestTimeSeconds: -1 } } })).toBe(false)
    expect(isSaveData({ ...save, stageRecords: { 1: { bestTimeSeconds: 2.5 } } })).toBe(false)
  })
})
