import { useCallback, useEffect, useReducer, useRef } from 'react'

import { createGameState, gameReducer } from '../../game/gameState'
import type { GameState } from '../../game/gameState'
import { generateMaze } from '../../game/mazeGenerator'
import type { Direction } from '../../game/types'
import { useKeyboardMovement } from '../../hooks/useKeyboardMovement'
import { DirectionControls } from '../Controls/DirectionControls'
import { GameHud } from '../Hud/GameHud'
import { MazeBoard } from '../MazeBoard/MazeBoard'
import { PauseOverlay } from '../Overlays/PauseOverlay'
import { ResultOverlay } from '../Overlays/ResultOverlay'
import styles from './GameScreen.module.css'

interface GameScreenProps {
  initialState?: GameState
  onStageComplete?: (stage: number, clearTimeSeconds: number, moveCount: number) => void
  onNextStage?: (stage: number) => void
  onCampaign?: () => void
}

export function GameScreen({
  initialState,
  onStageComplete,
  onNextStage,
  onCampaign,
}: GameScreenProps) {
  const [state, dispatch] = useReducer(
    gameReducer,
    initialState,
    (provided) => provided ?? createGameState(1),
  )
  const playing = state.status === 'playing'
  const reportedWin = useRef(false)

  const handleMove = useCallback((direction: Direction) => {
    dispatch({ type: 'MOVE', direction })
  }, [])

  useKeyboardMovement({ enabled: playing, onMove: handleMove })

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => dispatch({ type: 'TICK' }), 1000)
    return () => window.clearInterval(timer)
  }, [playing])

  useEffect(() => {
    if (state.status === 'ready') reportedWin.current = false
    if (state.status === 'won' && !reportedWin.current) {
      reportedWin.current = true
      onStageComplete?.(
        state.stageConfig.stage,
        state.stageConfig.timeLimitSeconds - state.remainingSeconds,
        state.moveCount,
      )
    }
  }, [state.status, state.stageConfig, state.remainingSeconds, state.moveCount, onStageComplete])

  const rescuedCount = state.rescues.filter((target) => target.rescued).length

  return (
    <div className={styles.screen}>
      <GameHud
        stage={state.stageConfig.stage}
        remainingSeconds={state.remainingSeconds}
        rescuedCount={rescuedCount}
        rescueCount={state.stageConfig.rescueCount}
        moveCount={state.moveCount}
        canPause={playing}
        onPause={() => dispatch({ type: 'PAUSE', now: Date.now() })}
      />

      <div className={styles.playfield}>
        <MazeBoard state={state} onMove={handleMove} />
        {state.status === 'paused' && (
          <PauseOverlay onResume={() => dispatch({ type: 'RESUME', now: Date.now() })} />
        )}
        {(state.status === 'won' || state.status === 'lost') && (
          <ResultOverlay
            status={state.status}
            stage={state.stageConfig.stage}
            clearTimeSeconds={state.stageConfig.timeLimitSeconds - state.remainingSeconds}
            moveCount={state.moveCount}
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
