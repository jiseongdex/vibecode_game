import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'

import type { PlayerAppearance } from '../../assets/assetManifest'
import { createGameState, gameReducer } from '../../game/gameState'
import type { GameState } from '../../game/gameState'
import { generateMaze } from '../../game/mazeGenerator'
import type { Direction } from '../../game/types'
import { useKeyboardMovement } from '../../hooks/useKeyboardMovement'
import { usePageVisibilityPause } from '../../hooks/usePageVisibilityPause'
import { DirectionControls } from '../Controls/DirectionControls'
import { StickerIcon } from '../Decorations/StickerIcon'
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

type MovementSource = 'keyboard' | 'button'

const BASE_FRAME_WIDTH = 1250
const BASE_FRAME_HEIGHT = 850

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
  const [movementSource, setMovementSource] = useState<MovementSource>('button')
  const [pressedDirections, setPressedDirections] = useState<Direction[]>([])
  const [sceneScale, setSceneScale] = useState(1)
  const screenRef = useRef<HTMLDivElement>(null)
  const playfieldAreaRef = useRef<HTMLDivElement>(null)
  const controlsAreaRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const screen = screenRef.current
    const area = playfieldAreaRef.current
    const controls = controlsAreaRef.current
    if (!screen || !area || !controls) return

    const measure = () => {
      const screenRect = screen.getBoundingClientRect()
      const areaRect = area.getBoundingClientRect()
      const controlsRect = controls.getBoundingClientRect()
      const bottomPadding = Number.parseFloat(window.getComputedStyle(screen).paddingBottom) || 0
      const availableHeight = window.innerHeight
        - (areaRect.top - screenRect.top)
        - controlsRect.height
        - bottomPadding
      if (
        !Number.isFinite(areaRect.width) || areaRect.width <= 0 ||
        !Number.isFinite(availableHeight)
      ) return
      const next = Math.max(0.1, Math.min(
        areaRect.width / BASE_FRAME_WIDTH,
        availableHeight / BASE_FRAME_HEIGHT,
      ))
      setSceneScale((previous) => previous === next ? previous : next)
    }

    measure()
    let observer: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure)
      observer.observe(area)
      observer.observe(controls)
      const hud = screen.firstElementChild
      if (hud instanceof HTMLElement) observer.observe(hud)
    }
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const handleMove = useCallback((direction: Direction, source: MovementSource) => {
    setMovementSource(source)
    setMovementAttempt((attempt) => attempt + 1)
    dispatch({ type: 'MOVE', direction })
  }, [])
  const handleKeyboardMove = useCallback(
    (direction: Direction) => handleMove(direction, 'keyboard'),
    [handleMove],
  )
  const handleButtonMove = useCallback(
    (direction: Direction) => handleMove(direction, 'button'),
    [handleMove],
  )

  useKeyboardMovement({
    enabled: playing,
    onMove: handleKeyboardMove,
    onPressedDirectionsChange: setPressedDirections,
  })

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
    <div className={styles.screen} ref={screenRef}>
      <GameHud
        stage={state.stageConfig.stage}
        remainingSeconds={state.remainingSeconds}
        rescuedCount={rescuedCount}
        rescueCount={state.stageConfig.rescueCount}
        canPause={playing}
        onPause={pauseAndSave}
      />

      <div className={styles.gameContent}>
        <div className={styles.playfieldArea} ref={playfieldAreaRef}>
          <div
            className={styles.playfield}
            style={{ width: BASE_FRAME_WIDTH * sceneScale, height: BASE_FRAME_HEIGHT * sceneScale }}
            data-testid="playfield"
          >
            <MazeBoard
              state={state}
              onMove={handleButtonMove}
              appearance={appearance}
              movementAttempt={movementAttempt}
              movementSource={movementSource}
              pressedDirections={pressedDirections}
              scale={sceneScale}
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
        </div>

        <div className={styles.controlsArea} ref={controlsAreaRef}>
          <div className={styles.actions}>
            {state.status === 'ready' && (
              <button type="button" onClick={() => dispatch({ type: 'START', now: Date.now() })}>
                <StickerIcon kind="footprint" />
                시작하기
              </button>
            )}
          </div>

          <DirectionControls disabled={!playing} onMove={handleButtonMove} />
        </div>
      </div>
    </div>
  )
}
