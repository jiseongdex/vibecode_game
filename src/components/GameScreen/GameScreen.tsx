import { useCallback, useEffect, useReducer } from 'react'

import { createGameState, gameReducer } from '../../game/gameState'
import type { GameState } from '../../game/gameState'
import { generateMaze } from '../../game/mazeGenerator'
import type { Direction } from '../../game/types'
import { useKeyboardMovement } from '../../hooks/useKeyboardMovement'
import { DirectionControls } from '../Controls/DirectionControls'
import { MazeBoard } from '../MazeBoard/MazeBoard'
import styles from './GameScreen.module.css'

interface GameScreenProps {
  initialState?: GameState
}

export function GameScreen({ initialState }: GameScreenProps) {
  const [state, dispatch] = useReducer(
    gameReducer,
    initialState,
    (provided) => provided ?? createGameState(1),
  )
  const playing = state.status === 'playing'

  const handleMove = useCallback((direction: Direction) => {
    dispatch({ type: 'MOVE', direction })
  }, [])

  useKeyboardMovement({ enabled: playing, onMove: handleMove })

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => dispatch({ type: 'TICK' }), 1000)
    return () => window.clearInterval(timer)
  }, [playing])

  const rescuedCount = state.rescues.filter((target) => target.rescued).length

  return (
    <div className={styles.screen}>
      <div className={styles.summary} aria-live="polite">
        <span>{state.stageConfig.stage}단계</span>
        <span>남은 시간: {state.remainingSeconds}초</span>
        <span>
          구출: {rescuedCount}/{state.stageConfig.rescueCount}
        </span>
        <span>이동: {state.moveCount}회</span>
      </div>

      <MazeBoard state={state} onMove={handleMove} />

      <div className={styles.actions}>
        {state.status === 'ready' && (
          <button type="button" onClick={() => dispatch({ type: 'START', now: Date.now() })}>
            시작하기
          </button>
        )}
        {playing && (
          <button type="button" onClick={() => dispatch({ type: 'PAUSE', now: Date.now() })}>
            일시정지
          </button>
        )}
        {state.status === 'paused' && (
          <button type="button" onClick={() => dispatch({ type: 'RESUME', now: Date.now() })}>
            이어하기
          </button>
        )}
        {state.status === 'lost' && <p role="status">시간 초과!</p>}
        {state.status === 'won' && <p role="status">단계 클리어!</p>}
        {(state.status === 'lost' || state.status === 'won') && (
          <>
            <button type="button" onClick={() => dispatch({ type: 'RETRY_SAME_MAZE' })}>
              같은 미로 재도전
            </button>
            <button
              type="button"
              onClick={() =>
                dispatch({
                  type: 'RESTART_NEW_MAZE',
                  maze: generateMaze(state.stageConfig.size),
                })
              }
            >
              새 미로 시작
            </button>
          </>
        )}
      </div>

      <DirectionControls disabled={!playing} onMove={handleMove} />
    </div>
  )
}
