import { act, renderHook } from '@testing-library/react'

import { loadSave } from '../persistence/saveStore'
import { usePersistedGame } from './usePersistedGame'

describe('usePersistedGame', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => window.localStorage.clear())

  it('saves a stage result and restores its unlock and best record', () => {
    const first = renderHook(() => usePersistedGame())
    act(() => first.result.current.recordStageResult(1, 80, 40))
    act(() => first.result.current.persistNow())

    expect(loadSave().unlockedStage).toBe(2)
    expect(loadSave().stageRecords[1]).toEqual({
      bestTimeSeconds: 80,
      bestMoveCount: 40,
    })
    first.unmount()

    const restored = renderHook(() => usePersistedGame())
    expect(restored.result.current.progress.unlockedStage).toBe(2)
    expect(restored.result.current.progress.stageRecords[1].bestTimeSeconds).toBe(80)
    restored.unmount()
  })
})
