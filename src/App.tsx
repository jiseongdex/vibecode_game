import { useCallback, useState } from 'react'

import type { PlayerAppearance } from './assets/assetManifest'
import { CampaignScreen } from './components/Campaign/CampaignScreen'
import { GameScreen } from './components/GameScreen/GameScreen'
import { createGameState } from './game/gameState'
import type { GameState } from './game/gameState'
import { generateMaze } from './game/mazeGenerator'
import { getMazeSize, MAX_STAGE } from './game/stageConfig'
import { usePersistedGame } from './hooks/usePersistedGame'

const APPEARANCE_KEY = 'maze-rescue-game.appearance.v1'

function loadAppearance(): PlayerAppearance {
  try {
    return window.localStorage.getItem(APPEARANCE_KEY) === 'boy' ? 'boy' : 'girl'
  } catch {
    return 'girl'
  }
}

export function App() {
  const [appearance, setAppearance] = useState<PlayerAppearance>(loadAppearance)
  const {
    progress,
    session,
    startSession,
    captureSession,
    recordStageResult,
    discardSession,
    persistNow,
  } = usePersistedGame()

  const startStage = useCallback((stage: number) => {
    if (stage > MAX_STAGE) return
    startSession(createGameState(stage, generateMaze(getMazeSize(stage))))
  }, [startSession])

  const handleSessionChange = useCallback(
    (state: GameState) => {
      if (session) captureSession(session.id, state)
    },
    [session?.id, captureSession],
  )

  const chooseAppearance = useCallback((next: PlayerAppearance) => {
    setAppearance(next)
    try {
      window.localStorage.setItem(APPEARANCE_KEY, next)
    } catch {
      // The game remains playable when browser storage is unavailable.
    }
  }, [])

  return (
    <main>
      <header>
        <p>20개의 미로, 하나의 구출 작전</p>
        <h1>미로 구출대</h1>
      </header>

      <section aria-label="게임 화면" data-testid="game-container">
        {session ? (
          <GameScreen
            key={session.id}
            appearance={appearance}
            initialState={session.state}
            onStageComplete={recordStageResult}
            onNextStage={startStage}
            onCampaign={discardSession}
            onStateChange={handleSessionChange}
            onPersistNow={persistNow}
            onDiscardSession={discardSession}
          />
        ) : (
          <CampaignScreen
            progress={progress}
            appearance={appearance}
            onAppearanceChange={chooseAppearance}
            onStartSession={startSession}
          />
        )}
      </section>
    </main>
  )
}
