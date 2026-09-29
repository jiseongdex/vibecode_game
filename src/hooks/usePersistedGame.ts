import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { completeStage } from '../game/campaignProgress'
import type { CampaignProgress } from '../game/campaignProgress'
import type { GameState } from '../game/gameState'
import { SAVE_VERSION } from '../persistence/saveSchema'
import { loadSave, makeSavedSession, saveSave } from '../persistence/saveStore'

export interface ActiveSession {
  id: number
  state: GameState
}

interface CurrentGame {
  progress: CampaignProgress
  session: ActiveSession | null
}

export function usePersistedGame() {
  const [initialSave] = useState(loadSave)
  const [progress, setProgress] = useState<CampaignProgress>(() => ({
    unlockedStage: initialSave.unlockedStage,
    stageRecords: initialSave.stageRecords,
  }))
  const [session, setSession] = useState<ActiveSession | null>(() =>
    initialSave.currentSession
      ? { id: 1, state: initialSave.currentSession.state }
      : null,
  )
  const nextSessionId = useRef(initialSave.currentSession ? 1 : 0)
  const current = useRef<CurrentGame>({ progress, session })
  const saveTimer = useRef<number | null>(null)

  useLayoutEffect(() => {
    current.current = { progress, session }
  }, [progress, session])

  const persistNow = useCallback(() => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const latest = current.current
    saveSave({
      version: SAVE_VERSION,
      unlockedStage: latest.progress.unlockedStage,
      stageRecords: latest.progress.stageRecords,
      currentSession: latest.session
        ? makeSavedSession(latest.session.state)
        : null,
    })
  }, [])

  useEffect(() => {
    saveTimer.current = window.setTimeout(persistNow, 250)
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
  }, [progress, session, persistNow])

  useEffect(() => {
    window.addEventListener('pagehide', persistNow)
    window.addEventListener('beforeunload', persistNow)
    return () => {
      window.removeEventListener('pagehide', persistNow)
      window.removeEventListener('beforeunload', persistNow)
    }
  }, [persistNow])

  const startSession = useCallback((state: GameState) => {
    const next = { id: ++nextSessionId.current, state }
    current.current = { ...current.current, session: next }
    setSession(next)
  }, [])

  const captureSession = useCallback((id: number, state: GameState) => {
    if (current.current.session?.id !== id) return
    const next = { id, state }
    current.current = { ...current.current, session: next }
    setSession((previous) =>
      previous?.id === id && previous.state !== state ? next : previous,
    )
  }, [])

  const recordStageResult = useCallback(
    (stage: number, clearTimeSeconds: number, moveCount: number) => {
      const next = completeStage(
        current.current.progress,
        stage,
        clearTimeSeconds,
        moveCount,
      )
      current.current = { ...current.current, progress: next }
      setProgress(next)
    },
    [],
  )

  const discardSession = useCallback(() => {
    current.current = { ...current.current, session: null }
    setSession(null)
    persistNow()
  }, [persistNow])

  return {
    progress,
    session,
    startSession,
    captureSession,
    recordStageResult,
    discardSession,
    persistNow,
  }
}
