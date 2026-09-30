import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import { mazeThemes } from '../../assets/assetManifest'
import type { PlayerAppearance } from '../../assets/assetManifest'
import { getMazeTheme } from '../../assets/mazeTheme'
import type { GameState } from '../../game/gameState'
import type { Direction, Position } from '../../game/types'
import { ExitSprite } from '../Exit/ExitSprite'
import { PlayerSprite } from '../Player/PlayerSprite'
import { RescueSprite } from '../Rescue/RescueSprite'
import { MazeCell } from './MazeCell'
import styles from './MazeBoard.module.css'

export interface MazeBoardProps {
  state: GameState
  onMove: (direction: Direction) => void
  appearance?: PlayerAppearance
}

interface ViewportSize {
  width: number
  height: number
}

interface MotionSnapshot {
  moveCount: number
  seed: number
  player: Position
  playerFacing: Direction
  followers: Position[]
}

interface MotionState {
  moveCount: number
  playerMoved: boolean
  playerFacing: Direction
  followerMoved: boolean[]
}

function cameraOffset(
  playerCoordinate: number,
  mazeSize: number,
  cellSize: number,
  viewportSize: number,
): number {
  const boardSize = mazeSize * cellSize
  if (boardSize <= viewportSize) return (viewportSize - boardSize) / 2

  const centered = viewportSize / 2 - (playerCoordinate + 0.5) * cellSize
  return Math.max(viewportSize - boardSize, Math.min(0, centered))
}

function samePosition(first: Position, second: Position): boolean {
  return first.row === second.row && first.col === second.col
}

export function MazeBoard({ state, appearance = 'girl' }: MazeBoardProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const previous = useRef<MotionSnapshot>({
    moveCount: state.moveCount,
    seed: state.maze.seed,
    player: { ...state.player },
    playerFacing: state.playerFacing,
    followers: state.followers.map((follower) => ({ ...follower })),
  })
  const [motion, setMotion] = useState<MotionState | null>(null)
  const [viewport, setViewport] = useState<ViewportSize>({
    width: 640,
    height: 480,
  })

  useLayoutEffect(() => {
    const element = viewportRef.current
    if (!element) return

    const measure = () => {
      const rect = element.getBoundingClientRect()
      const width = element.clientWidth || rect.width || 640
      const height = element.clientHeight || rect.height || 480
      setViewport((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      )
    }

    measure()
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(element)
    window.addEventListener('resize', measure)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  useLayoutEffect(() => {
    const last = previous.current
    const next: MotionSnapshot = {
      moveCount: state.moveCount,
      seed: state.maze.seed,
      player: { ...state.player },
      playerFacing: state.playerFacing,
      followers: state.followers.map((follower) => ({ ...follower })),
    }
    previous.current = next

    if (next.seed === last.seed && next.moveCount === last.moveCount + 1) {
      setMotion({
        moveCount: next.moveCount,
        playerMoved: !samePosition(last.player, next.player),
        playerFacing: next.playerFacing,
        followerMoved: next.followers.map((follower, index) =>
          Boolean(
            last.followers[index] &&
            !samePosition(last.followers[index], follower),
          ),
        ),
      })
    } else if (
      next.seed !== last.seed ||
      next.moveCount !== last.moveCount ||
      next.playerFacing !== last.playerFacing
    ) {
      setMotion(null)
    }
  })

  const cellSize = Math.max(36, Math.min(52, Math.floor(viewport.width / 9)))
  const offsetX = cameraOffset(
    state.player.col,
    state.maze.size,
    cellSize,
    viewport.width,
  )
  const offsetY = cameraOffset(
    state.player.row,
    state.maze.size,
    cellSize,
    viewport.height,
  )
  const boardStyle = {
    '--cell-size': `${cellSize}px`,
    '--maze-size': state.maze.size,
    transform: `translate3d(${offsetX}px, ${offsetY}px, 0)`,
  } as CSSProperties
  const unlockedExit = state.rescues.every((target) => target.rescued)
  const rescuedTargets = state.rescues.filter((target) => target.rescued)
  const themeId = getMazeTheme(state.maze.seed)
  const theme = mazeThemes[themeId]
  const currentMotion = motion?.moveCount === state.moveCount ? motion : null

  return (
    <div
      ref={viewportRef}
      className={styles.viewport}
      role="region"
      aria-label={`${state.stageConfig.stage}단계 미로`}
      data-testid="maze-viewport"
    >
      <div
        className={styles.board}
        style={boardStyle}
        data-testid="maze-board"
        data-theme={themeId}
      >
        {state.maze.cells.flatMap((row) =>
          row.map((cell) => {
            const position = { row: cell.row, col: cell.col }
            const isPlayer = samePosition(position, state.player)
            const isExit = samePosition(position, state.exit)
            const waiting = state.rescues.filter(
              (target) => !target.rescued && samePosition(position, target),
            )
            const followers = state.followers
              .map((follower, index) => ({ follower, index }))
              .filter(({ follower }) => samePosition(position, follower))
            const type = isPlayer
              ? 'player'
              : waiting.length > 0
                ? 'rescue'
                : followers.length > 0
                  ? 'follower'
                  : isExit
                    ? 'exit'
                    : 'floor'

            return (
              <MazeCell
                key={`${cell.row}:${cell.col}`}
                cell={cell}
                type={type}
                seed={state.maze.seed}
                mazeSize={state.maze.size}
                theme={theme}
              >
                {isExit && <ExitSprite unlocked={unlockedExit} />}
                {waiting.map((target) => (
                  <RescueSprite
                    key={target.id}
                    animalId={target.id}
                    facing="down"
                  />
                ))}
                {followers.map(({ index }) => (
                  <RescueSprite
                    key={`follower-${index}`}
                    animalId={rescuedTargets[index]?.id ?? 'rescue-1'}
                    following
                    order={index + 1}
                    facing={state.followerFacings[index] ?? 'down'}
                    moveCount={state.moveCount}
                    animateMove={currentMotion?.followerMoved[index] ?? false}
                  />
                ))}
                {isPlayer && (
                  <PlayerSprite
                    appearance={appearance}
                    facing={state.playerFacing}
                    moveCount={state.moveCount}
                    animateMove={Boolean(
                      currentMotion?.playerMoved &&
                      currentMotion.playerFacing === state.playerFacing,
                    )}
                  />
                )}
              </MazeCell>
            )
          }),
        )}
      </div>
    </div>
  )
}
