import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { ApiClientError, finishRun, getSession } from '../api/client'
import type { ProgressDto } from '../api/contracts'
import type { CampaignProgress } from '../game/campaignProgress'
import type { GameState } from '../game/gameState'
import {
  clearAccountSession,
  loadAccountSave,
  saveAccountSave,
  type PendingResult,
} from '../persistence/accountSaveStore'
import { makeSavedSession } from '../persistence/saveStore'

export interface ActiveSession {
  id: number
  attemptId: string
  state: GameState
  skipIntroMessage?: boolean
}

interface CurrentGame {
  progress: CampaignProgress
  session: ActiveSession | null
  pendingResult: PendingResult | null
}

export function usePersistedGame({
  userId,
  initialProgress,
}: {
  userId: string
  initialProgress: ProgressDto
}) {
  const [initialSave] = useState(() => loadAccountSave(userId, initialProgress))
  const [progress, setProgress] = useState<CampaignProgress>(initialProgress)
  const [session, setSession] = useState<ActiveSession | null>(() =>
    initialSave.currentSession && initialSave.attemptId
      ? { id: 1, attemptId: initialSave.attemptId, state: initialSave.currentSession.state }
      : null)
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(initialSave.pendingResult)
  const nextSessionId = useRef(initialSave.currentSession ? 1 : 0)
  const current = useRef<CurrentGame>({ progress, session, pendingResult })
  const saveTimer = useRef<number | null>(null)
  const pendingRequest = useRef<Promise<void> | null>(null)

  useLayoutEffect(() => {
    current.current = { progress, session, pendingResult }
  }, [progress, session, pendingResult])

  const persistNow = useCallback(() => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const latest = current.current
    const savedSession = latest.session ? makeSavedSession(latest.session.state) : null
    saveAccountSave({
      version: 1,
      userId,
      currentSession: savedSession,
      attemptId: savedSession ? latest.session?.attemptId ?? null : null,
      pendingResult: latest.pendingResult,
    })
  }, [userId])

  useEffect(() => {
    saveTimer.current = window.setTimeout(persistNow, 250)
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
  }, [session, pendingResult, persistNow])

  useEffect(() => {
    window.addEventListener('pagehide', persistNow)
    window.addEventListener('beforeunload', persistNow)
    return () => {
      window.removeEventListener('pagehide', persistNow)
      window.removeEventListener('beforeunload', persistNow)
      persistNow()
    }
  }, [persistNow])

  const startSession = useCallback((state: GameState, attemptId: string, skipIntroMessage = false) => {
    if (current.current.pendingResult) throw new Error('Finish the pending result before starting another run.')
    const next = { id: ++nextSessionId.current, attemptId, state, skipIntroMessage }
    current.current = { ...current.current, session: next }
    setSession(next)
  }, [])

  const captureSession = useCallback((id: number, state: GameState) => {
    if (current.current.session?.id !== id) return
    const next = { ...current.current.session, state }
    current.current = { ...current.current, session: next }
    setSession((previous) => previous?.id === id && previous.state !== state ? next : previous)
  }, [])

  const acceptProgress = useCallback((next: ProgressDto) => {
    current.current = { ...current.current, progress: next }
    setProgress(next)
  }, [])

  const refreshProgress = useCallback(async () => {
    const fresh = await getSession()
    if (fresh.user.id !== userId) {
      throw new ApiClientError(401, 'session_changed', 'Account session changed.')
    }
    acceptProgress(fresh.progress)
  }, [acceptProgress, userId])

  const sendResult = useCallback((pending: PendingResult): Promise<void> => {
    if (pendingRequest.current) return pendingRequest.current
    const operation = (async () => {
      let nextProgress: ProgressDto
      try {
        const completed = await finishRun(pending.attemptId, pending.clearTimeSeconds)
        nextProgress = completed.progress
      } catch (error) {
        if (!(error instanceof ApiClientError) || error.status !== 409) throw error
        const fresh = await getSession()
        if (fresh.user.id !== userId ||
          (fresh.progress.stageRecords[pending.stage]?.bestTimeSeconds ?? Infinity) > pending.clearTimeSeconds) {
          throw error
        }
        nextProgress = fresh.progress
      }
      acceptProgress(nextProgress)
      current.current = { ...current.current, pendingResult: null }
      setPendingResult(null)
      persistNow()
    })()
    pendingRequest.current = operation
    void operation.finally(() => {
      if (pendingRequest.current === operation) pendingRequest.current = null
    }).catch(() => {})
    return operation
  }, [acceptProgress, persistNow, userId])

  const recordStageResult = useCallback(async (
    stage: number,
    clearTimeSeconds: number,
    attemptId: string,
  ) => {
    const active = current.current.session
    if (!active || active.attemptId !== attemptId || active.state.stageConfig.stage !== stage) {
      throw new Error('The active run does not match this result.')
    }
    const existing = current.current.pendingResult
    if (existing && (existing.attemptId !== attemptId || existing.stage !== stage ||
      existing.clearTimeSeconds !== clearTimeSeconds)) {
      throw new Error('Another result is awaiting submission.')
    }
    const pending = existing ?? { attemptId, stage, clearTimeSeconds }
    if (!existing) {
      current.current = { ...current.current, pendingResult: pending }
      setPendingResult(pending)
      persistNow()
    }
    await sendResult(pending)
  }, [persistNow, sendResult])

  const retryPendingResult = useCallback(async () => {
    const pending = current.current.pendingResult
    if (!pending) return
    await sendResult(pending)
  }, [sendResult])

  const discardSession = useCallback(() => {
    current.current = { ...current.current, session: null }
    setSession(null)
    persistNow()
    clearAccountSession(userId, current.current.progress)
  }, [persistNow, userId])

  return {
    progress,
    session,
    startSession,
    captureSession,
    recordStageResult,
    refreshProgress,
    discardSession,
    persistNow,
    pendingResult,
    retryPendingResult,
  }
}
