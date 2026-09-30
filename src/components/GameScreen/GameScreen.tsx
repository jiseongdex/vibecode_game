import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import type { PlayerAppearance } from '../../assets/assetManifest'
import { createGameState, gameReducer } from '../../game/gameState'
import type { GameState } from '../../game/gameState'
import { generateMaze } from '../../game/mazeGenerator'
import type { Direction } from '../../game/types'
import { useKeyboardMovement } from '../../hooks/useKeyboardMovement'
import { usePageVisibilityPause } from '../../hooks/usePageVisibilityPause'
import { DirectionControls } from '../Controls/DirectionControls'
import { GameHud } from '../Hud/GameHud'
import { MazeBoard } from '../MazeBoard/MazeBoard'
import { PauseOverlay } from '../Overlays/PauseOverlay'
import { ResultOverlay } from '../Overlays/ResultOverlay'
import styles from './GameScreen.module.css'

interface GameScreenProps {
  appearance?: PlayerAppearance
  initialState?: GameState
  onStageComplete?: (stage: number, clearTimeSeconds: number) => void
  onNextStage?: (stage: number) => void
  onCampaign?: () => void
  onStateChange?: (state: GameState) => void
  onPersistNow?: () => void
  onDiscardSession?: () => void
}

export function GameScreen({
  appearance = 'girl',
  initialState,
  onStageComplete,
  onNextStage,
  onCampaign,
  onStateChange,
  onPersistNow,
  onDiscardSession,
}: GameScreenProps) {
  const [state, dispatch] = useReducer(
    gameReducer,
    initialState,
    (provided) => provided ?? createGameState(1),
  )
  const playing = state.status === 'playing'
  const reportedWin = useRef(false)
  const [movementAttempt, setMovementAttempt] = useState(0)

  const handleMove = useCallback((direction: Direction) => {
    setMovementAttempt((attempt) => attempt + 1)
    dispatch({ type: 'MOVE', direction })
  }, [])

  useKeyboardMovement({ enabled: playing, onMove: handleMove })

  const pauseAndSave = useCallback(() => {
    if (state.status !== 'playing') return
    const now = Date.now()
    const paused = gameReducer(state, { type: 'PAUSE', now })
    dispatch({ type: 'PAUSE', now })
    onStateChange?.(paused)
    onPersistNow?.()
  }, [state, onStateChange, onPersistNow])

  usePageVisibilityPause({ enabled: playing, onPause: pauseAndSave })

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => dispatch({ type: 'TICK' }), 1000)
    return () => window.clearInterval(timer)
  }, [playing])

  useEffect(() => {
    onStateChange?.(state)
  }, [state, onStateChange])

  useEffect(() => {
    if (state.status === 'ready') reportedWin.current = false
    if (state.status === 'won' && !reportedWin.current) {
      reportedWin.current = true
      onStageComplete?.(
        state.stageConfig.stage,
        state.stageConfig.timeLimitSeconds - state.remainingSeconds,
      )
    }
  }, [state.status, state.stageConfig, state.remainingSeconds, onStageComplete])

  const rescuedCount = state.rescues.filter((target) => target.rescued).length

  return (
    <div className={styles.screen}>
      <GameHud
        stage={state.stageConfig.stage}
        remainingSeconds={state.remainingSeconds}
        rescuedCount={rescuedCount}
        rescueCount={state.stageConfig.rescueCount}
        canPause={playing}
        onPause={pauseAndSave}
      />

      <div className={styles.playfield}>
        <MazeBoard
          state={state}
          onMove={handleMove}
          appearance={appearance}
          movementAttempt={movementAttempt}
        />
        {state.status === 'paused' && (
          <PauseOverlay
            onResume={() => dispatch({ type: 'RESUME', now: Date.now() })}
            onDiscard={onDiscardSession}
          />
        )}
        {(state.status === 'won' || state.status === 'lost') && (
          <ResultOverlay
            status={state.status}
            stage={state.stageConfig.stage}
            clearTimeSeconds={state.stageConfig.timeLimitSeconds - state.remainingSeconds}
            onRetrySameMaze={() => dispatch({ type: 'RETRY_SAME_MAZE' })}
            onRestartNewMaze={() =>
              dispatch({
                type: 'RESTART_NEW_MAZE',
                maze: generateMaze(state.stageConfig.size),
              })
            }
            onNextStage={onNextStage ? () => onNextStage(state.stageConfig.stage + 1) : undefined}
            onCampaign={onCampaign}
          />
        )}
      </div>

      <div className={styles.actions}>
        {state.status === 'ready' && (
          <button type="button" onClick={() => dispatch({ type: 'START', now: Date.now() })}>
            시작하기
          </button>
        )}
      </div>

      <DirectionControls disabled={!playing} onMove={handleMove} />
    </div>
  )
}
