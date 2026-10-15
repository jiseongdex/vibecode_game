import { useCallback, useRef, useState, type ReactElement } from 'react'

import { ApiClientError, startRun } from './api/client'
import type { AuthType, SessionDto } from './api/contracts'
import type { PlayerAppearance } from './assets/assetManifest'
import { LoginScreen, RouteChoice, getAuthRoute, getDeploymentTarget } from './components/Auth/LoginScreen'
import { CampaignWorkspace } from './components/Campaign/CampaignWorkspace'
import { ActionIcon } from './components/Decorations/ActionIcon'
import { StickerIcon } from './components/Decorations/StickerIcon'
import { GameScreen } from './components/GameScreen/GameScreen'
import { createGameState } from './game/gameState'
import type { GameState } from './game/gameState'
import { generateMaze } from './game/mazeGenerator'
import { getMazeSize, MAX_STAGE } from './game/stageConfig'
import type { Maze } from './game/types'
import { useAuthSession } from './hooks/useAuthSession'
import { usePersistedGame } from './hooks/usePersistedGame'

const APPEARANCE_KEY = 'maze-rescue-game.appearance.v1'

function loadAppearance(): PlayerAppearance {
  try {
    return window.localStorage.getItem(APPEARANCE_KEY) === 'boy' ? 'boy' : 'girl'
  } catch {
    return 'girl'
  }
}

function handleUnauthorized(error: unknown, refresh: () => Promise<void>): void {
  if (error instanceof ApiClientError && error.status === 401) void refresh()
}

function AuthenticatedGame({
  account,
  onSignOut,
  onRefreshAuth,
}: {
  account: SessionDto
  onSignOut: () => Promise<void>
  onRefreshAuth: () => Promise<void>
}): ReactElement {
  const [appearance, setAppearance] = useState<PlayerAppearance>(loadAppearance)
  const [startError, setStartError] = useState<string | null>(null)
  const [pendingError, setPendingError] = useState<string | null>(null)
  const [retryingPending, setRetryingPending] = useState(false)
  const starting = useRef(false)
  const {
    progress,
    session,
    startSession,
    captureSession,
    recordStageResult,
    discardSession,
    persistNow,
    pendingResult,
    retryPendingResult,
  } = usePersistedGame({ userId: account.user.id, initialProgress: account.progress })

  const startStage = useCallback(async (stage: number, maze?: Maze, retry = false) => {
    if (starting.current) return
    if (stage < 1 || stage > MAX_STAGE || stage > progress.unlockedStage || pendingResult) {
      setStartError('현재는 이 단계를 시작할 수 없어요. 진행 상태를 확인해주세요.')
      throw new Error('Stage is locked or a result is pending.')
    }
    starting.current = true
    setStartError(null)
    try {
      const issued = await startRun(stage)
      startSession(
        createGameState(stage, maze ?? generateMaze(getMazeSize(stage))),
        issued.attemptId,
        retry,
      )
    } catch (error) {
      setStartError('새 도전을 시작하지 못했어요. 다시 시도해주세요.')
      handleUnauthorized(error, onRefreshAuth)
      throw error
    } finally {
      starting.current = false
    }
  }, [onRefreshAuth, pendingResult, progress.unlockedStage, startSession])

  const handleStageComplete = useCallback(async (
    stage: number,
    clearTimeSeconds: number,
    attemptId: string,
  ) => {
    try {
      await recordStageResult(stage, clearTimeSeconds, attemptId)
    } catch (error) {
      handleUnauthorized(error, onRefreshAuth)
      throw error
    }
  }, [onRefreshAuth, recordStageResult])

  const handleSessionChange = useCallback((state: GameState) => {
    if (session) captureSession(session.id, state)
  }, [session?.id, captureSession])

  const chooseAppearance = useCallback((next: PlayerAppearance) => {
    setAppearance(next)
    try {
      window.localStorage.setItem(APPEARANCE_KEY, next)
    } catch {
      // Appearance is a device preference; storage failure does not block play.
    }
  }, [])

  const retryResult = async () => {
    if (retryingPending) return
    setRetryingPending(true)
    setPendingError(null)
    try {
      await retryPendingResult()
    } catch (error) {
      setPendingError('기록을 확인하지 못했어요. 다시 시도해주세요.')
      handleUnauthorized(error, onRefreshAuth)
    } finally {
      setRetryingPending(false)
    }
  }

  return (
    <main
      data-game-active={session ? 'true' : undefined}
      data-campaign-active={session ? undefined : 'true'}
    >
      {!session && (
        <header>
          <div className="header-title">
            <h1><StickerIcon kind="leaf" />동물구조탐험대<StickerIcon kind="mushroom" /></h1>
            <p>동물들을 구하러 탐험을 떠나자!</p>
          </div>
          <div className="account-toolbar">
            <span>{account.user.displayName}</span>
            <button type="button" aria-label="로그아웃" title="로그아웃"
              onClick={() => { void onSignOut() }}><ActionIcon kind="door" /></button>
          </div>
        </header>
      )}
      <section aria-label="게임 화면" data-testid="game-container">
        {session ? (
          <GameScreen
            key={session.id}
            appearance={appearance}
            initialState={session.state}
            attemptId={session.attemptId}
            skipIntroMessage={session.skipIntroMessage}
            onStageComplete={handleStageComplete}
            onRetryStage={(stage, maze) => startStage(stage, maze, true)}
            onNextStage={(stage) => startStage(stage)}
            onCampaign={discardSession}
            onStateChange={handleSessionChange}
            onPersistNow={persistNow}
            onDiscardSession={discardSession}
          />
        ) : (
          <>
            {startError && <p className="account-error" role="alert">{startError}</p>}
            {pendingResult && (
              <div className="account-pending" role="status">
                <p>{pendingResult.stage}단계 기록 전송을 확인해야 해요.</p>
                {pendingError && <p className="account-error" role="alert">{pendingError}</p>}
                <button type="button" disabled={retryingPending} onClick={() => { void retryResult() }}>
                  {retryingPending ? '확인 중…' : '기록 다시 보내기'}
                </button>
              </div>
            )}
            <CampaignWorkspace
              authType={account.user.authType}
              currentUserId={account.user.id}
              currentDisplayName={account.user.displayName}
              progress={progress}
              appearance={appearance}
              onAppearanceChange={chooseAppearance}
              onStartStage={(stage) => startStage(stage)}
              onUnauthorized={onRefreshAuth}
            />
          </>
        )}
      </section>
    </main>
  )
}

function AuthGate({ authType }: { authType: AuthType }): ReactElement {
  const auth = useAuthSession()
  if (auth.status === 'loading') {
    return <main className="auth-gate"><p role="status">로그인 상태를 확인하고 있어요…</p></main>
  }
  if (auth.status === 'error') {
    return (
      <main className="auth-gate">
        <p role="alert">{auth.error}</p>
        <button type="button" onClick={() => { void auth.refresh() }}>다시 시도</button>
      </main>
    )
  }
  if (auth.status === 'anonymous' || !auth.session) {
    return <main><LoginScreen authType={authType} onAuthenticated={auth.accept} /></main>
  }
  if (auth.session.user.authType !== authType) {
    return (
      <main className="auth-gate">
        <p role="alert">이 주소는 다른 로그인 방식의 계정으로 접속되어 있어요. 로그아웃 후 다시 로그인해주세요.</p>
        <button type="button" onClick={() => { void auth.signOut() }}>로그아웃</button>
      </main>
    )
  }
  return (
    <AuthenticatedGame
      key={`${auth.session.user.authType}:${auth.session.user.id}`}
      account={auth.session}
      onSignOut={auth.signOut}
      onRefreshAuth={auth.refresh}
    />
  )
}

export function App(): ReactElement {
  const target = getDeploymentTarget()
  const authType = getAuthRoute(window.location.pathname, target)
  return authType
    ? <AuthGate authType={authType} />
    : <main><RouteChoice target={target} /></main>
}
