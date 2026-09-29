import { useCallback, useState } from 'react'

import { CampaignScreen } from './components/Campaign/CampaignScreen'
import { GameScreen } from './components/GameScreen/GameScreen'
import { completeStage, createCampaignProgress } from './game/campaignProgress'
import type { CampaignProgress } from './game/campaignProgress'
import { createGameState } from './game/gameState'
import type { GameState } from './game/gameState'
import { generateMaze } from './game/mazeGenerator'
import { getMazeSize, MAX_STAGE } from './game/stageConfig'

export function App() {
  const [progress, setProgress] = useState<CampaignProgress>(createCampaignProgress)
  const [session, setSession] = useState<{ id: number; state: GameState } | null>(null)

  const startSession = useCallback((state: GameState) => {
    setSession((current) => ({ id: (current?.id ?? 0) + 1, state }))
  }, [])

  const startStage = useCallback((stage: number) => {
    if (stage > MAX_STAGE) return
    startSession(createGameState(stage, generateMaze(getMazeSize(stage))))
  }, [startSession])

  const handleStageComplete = useCallback(
    (stage: number, clearTimeSeconds: number, moveCount: number) => {
      setProgress((current) => completeStage(current, stage, clearTimeSeconds, moveCount))
    },
    [],
  )

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
            initialState={session.state}
            onStageComplete={handleStageComplete}
            onNextStage={startStage}
            onCampaign={() => setSession(null)}
          />
        ) : (
          <CampaignScreen progress={progress} onStartSession={startSession} />
        )}
      </section>
    </main>
  )
}
