import { act, renderHook } from '@testing-library/react'

import { ApiClientError, finishRun, getSession } from '../api/client'
import type { ProgressDto, SessionDto } from '../api/contracts'
import { createGameState } from '../game/gameState'
import { generateMaze } from '../game/mazeGenerator'
import { loadAccountSave } from '../persistence/accountSaveStore'
import { SAVE_VERSION } from '../persistence/saveSchema'
import { saveSave } from '../persistence/saveStore'
import { usePersistedGame } from './usePersistedGame'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, finishRun: vi.fn(), getSession: vi.fn() }
})

const progress: ProgressDto = { unlockedStage: 1, stageRecords: {} }
const attemptId = '11111111-1111-4111-8111-111111111111'
const serverSession: SessionDto = {
  user: { id: 'user-a', authType: 'simple', displayName: 'Otter' },
  progress: { unlockedStage: 2, stageRecords: { 1: { bestTimeSeconds: 30 } } },
}

describe('usePersistedGame', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    window.localStorage.clear()
  })
  afterEach(() => window.localStorage.clear())

  it('starts from server progress and ignores the old global save', () => {
    saveSave({
      version: SAVE_VERSION, unlockedStage: 20,
      stageRecords: { 20: { bestTimeSeconds: 2 } }, currentSession: null,
    })
    const { result } = renderHook(() => usePersistedGame({ userId: 'user-a', initialProgress: progress }))
    expect(result.current.progress).toEqual(progress)
    expect(result.current.session).toBeNull()
  })

  it('persists only a paused run for the same account', () => {
    const first = renderHook(() => usePersistedGame({ userId: 'user-a', initialProgress: progress }))
    act(() => first.result.current.startSession(createGameState(1, generateMaze(15)), attemptId))
    act(() => first.result.current.persistNow())
    expect(loadAccountSave('user-a', progress).currentSession?.state.status).toBe('paused')
    expect(loadAccountSave('user-a', progress).attemptId).toBe(attemptId)
    first.unmount()

    const restored = renderHook(() => usePersistedGame({ userId: 'user-a', initialProgress: progress }))
    expect(restored.result.current.session?.state.status).toBe('paused')
    expect(restored.result.current.session?.attemptId).toBe(attemptId)
    restored.unmount()

    const other = renderHook(() => usePersistedGame({ userId: 'user-b', initialProgress: progress }))
    expect(other.result.current.session).toBeNull()
    other.unmount()
  })

  it('keeps failed results and recovers a lost response after a 409', async () => {
    vi.mocked(finishRun).mockRejectedValueOnce(new ApiClientError(0, 'network_error', 'offline'))
      .mockRejectedValueOnce(new ApiClientError(409, 'attempt_finished', 'already saved'))
    vi.mocked(getSession).mockResolvedValue(serverSession)
    const { result } = renderHook(() => usePersistedGame({ userId: 'user-a', initialProgress: progress }))
    act(() => result.current.startSession(createGameState(1, generateMaze(15)), attemptId))
    await act(async () => {
      await expect(result.current.recordStageResult(1, 30, attemptId)).rejects.toMatchObject({ status: 0 })
    })
    expect(result.current.pendingResult).toEqual({ attemptId, stage: 1, clearTimeSeconds: 30 })
    expect(loadAccountSave('user-a', progress).pendingResult).toEqual(result.current.pendingResult)
    expect(result.current.progress).toEqual(progress)

    await act(async () => result.current.retryPendingResult())
    expect(result.current.pendingResult).toBeNull()
    expect(result.current.progress).toEqual(serverSession.progress)
    expect(loadAccountSave('user-a', serverSession.progress).pendingResult).toBeNull()
  })

  it('rejects an unrelated 409 and refreshes only the same account progress', async () => {
    vi.mocked(finishRun).mockRejectedValue(new ApiClientError(409, 'attempt_finished', 'already saved'))
    vi.mocked(getSession).mockResolvedValueOnce({
      ...serverSession,
      progress: { unlockedStage: 1, stageRecords: {} },
    }).mockResolvedValueOnce(serverSession)
    const { result } = renderHook(() => usePersistedGame({ userId: 'user-a', initialProgress: progress }))
    act(() => result.current.startSession(createGameState(1, generateMaze(15)), attemptId))
    await act(async () => {
      await expect(result.current.recordStageResult(1, 30, attemptId)).rejects.toMatchObject({ status: 409 })
    })
    expect(result.current.pendingResult).not.toBeNull()
    await act(async () => result.current.refreshProgress())
    expect(result.current.progress).toEqual(serverSession.progress)
    expect(result.current.pendingResult).not.toBeNull()
  })
})
