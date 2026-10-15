import { createGameState } from '../game/gameState'
import { generateMaze } from '../game/mazeGenerator'
import type { ProgressDto } from '../api/contracts'
import { makeSavedSession } from './saveStore'
import { SAVE_KEY } from './saveSchema'
import {
  accountSaveKey,
  clearAccountSession,
  loadAccountSave,
  saveAccountSave,
} from './accountSaveStore'

const progress: ProgressDto = { unlockedStage: 1, stageRecords: {} }
const attemptId = '01234567-89ab-4cde-8fab-0123456789ab'

beforeEach(() => window.localStorage.clear())
afterEach(() => window.localStorage.clear())

describe('account-scoped local save', () => {
  it('restores Azure-prefixed attempt IDs without accepting another account save', () => {
    const azureAttemptId = `a_${attemptId}`
    const currentSession = makeSavedSession(createGameState(1, generateMaze(15)))!
    const pendingResult = { attemptId: azureAttemptId, stage: 1, clearTimeSeconds: 30 }
    saveAccountSave({ version: 1, userId: 'azure-user', currentSession, attemptId: azureAttemptId, pendingResult })
    expect(loadAccountSave('azure-user', progress)).toMatchObject({ attemptId: azureAttemptId, pendingResult })
    expect(loadAccountSave('cloudflare-user', progress).attemptId).toBeNull()
  })

  it('stores only a paused maze and attempt under the matching user key', () => {
    const currentSession = makeSavedSession(createGameState(1, generateMaze(15)))!
    saveAccountSave({ version: 1, userId: 'first/user', currentSession, attemptId, pendingResult: null })
    expect(accountSaveKey('first/user')).toBe('maze-rescue-game.account.first%2Fuser.session.v1')
    expect(loadAccountSave('first/user', progress)).toEqual({
      version: 1, userId: 'first/user', currentSession, attemptId, pendingResult: null,
    })
    expect(loadAccountSave('second', progress)).toEqual({
      version: 1, userId: 'second', currentSession: null, attemptId: null, pendingResult: null,
    })
    const raw = window.localStorage.getItem(accountSaveKey('first/user'))!
    expect(raw).not.toContain('stageRecords')
    expect(raw).not.toContain('unlockedStage')
  })

  it('ignores old global saves, mismatched identities and locked or malformed mazes', () => {
    const currentSession = makeSavedSession(createGameState(1, generateMaze(15)))!
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      version: 6, unlockedStage: 20, stageRecords: { 20: { bestTimeSeconds: 2 } },
      currentSession,
    }))
    expect(loadAccountSave('new-user', progress).currentSession).toBeNull()
    expect(window.localStorage.getItem(SAVE_KEY)).not.toBeNull()

    const key = accountSaveKey('new-user')
    window.localStorage.setItem(key, JSON.stringify({
      version: 1, userId: 'other-user', currentSession, attemptId, pendingResult: null,
    }))
    expect(loadAccountSave('new-user', progress).currentSession).toBeNull()

    const stageTwo = makeSavedSession(createGameState(2, generateMaze(19)))!
    window.localStorage.setItem(key, JSON.stringify({
      version: 1, userId: 'new-user', currentSession: stageTwo, attemptId, pendingResult: null,
    }))
    expect(loadAccountSave('new-user', progress).currentSession).toBeNull()

    window.localStorage.setItem(key, JSON.stringify({
      version: 1, userId: 'new-user',
      currentSession: { ...currentSession, state: { ...currentSession.state, maze: { size: 15 } } },
      attemptId, pendingResult: null,
    }))
    expect(loadAccountSave('new-user', progress).currentSession).toBeNull()
  })

  it('keeps an unsubmitted result when the paused session is cleared', () => {
    const currentSession = makeSavedSession(createGameState(1, generateMaze(15)))!
    const pendingResult = { attemptId, stage: 1, clearTimeSeconds: 30 }
    saveAccountSave({ version: 1, userId: 'player', currentSession, attemptId, pendingResult })
    clearAccountSession('player', progress)
    expect(loadAccountSave('player', progress)).toEqual({
      version: 1, userId: 'player', currentSession: null, attemptId: null, pendingResult,
    })
  })
})
