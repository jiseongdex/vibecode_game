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
import { visualCell, visualSize } from './boardGeometry'
import { MazeCell } from './MazeCell'
import { WallLayer } from './MazeWall'
import styles from './MazeBoard.module.css'

export interface MazeBoardProps {
  state: GameState
  onMove: (direction: Direction) => void
  appearance?: PlayerAppearance
  movementAttempt?: number
}

interface ViewportSize {
  width: number
  height: number
}

interface MotionSnapshot {
  movementAttempt: number
  seed: number
  player: Position
  playerFacing: Direction
  followers: Position[]
}

interface MotionState {
  movementAttempt: number
  playerFacing: Direction
  followerMoved: boolean[]
}

function cameraOffset(
  visualCoordinate: number,
  boardTiles: number,
  cellSize: number,
  viewportSize: number,
): number {
  const boardSize = boardTiles * cellSize
  if (boardSize <= viewportSize) return (viewportSize - boardSize) / 2

  const centered = viewportSize / 2 - (visualCoordinate + 0.5) * cellSize
  return Math.max(viewportSize - boardSize, Math.min(0, centered))
}

function samePosition(first: Position, second: Position): boolean {
  return first.row === second.row && first.col === second.col
}

export function MazeBoard({
  state,
  appearance = 'girl',
  movementAttempt = 0,
}: MazeBoardProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const previous = useRef<MotionSnapshot>({
    movementAttempt,
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
      movementAttempt,
      seed: state.maze.seed,
      player: { ...state.player },
      playerFacing: state.playerFacing,
      followers: state.followers.map((follower) => ({ ...follower })),
    }
    previous.current = next

    if (
      next.seed === last.seed &&
      next.movementAttempt === last.movementAttempt + 1
    ) {
      setMotion({
        movementAttempt: next.movementAttempt,
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
      next.movementAttempt !== last.movementAttempt ||
      next.playerFacing !== last.playerFacing
    ) {
      setMotion(null)
    }
  })

  // The visual grid has two tiles per logical step. Keep each step at the
  // original board's 36–52px spacing instead of doubling its screen size.
  const logicalCellSize = Math.max(36, Math.min(52, Math.floor(viewport.width / 9)))
  const cellSize = Math.floor(logicalCellSize / 2)
  const boardTiles = visualSize(state.maze.size)
  const playerTile = visualCell(state.player)
  const offsetX = cameraOffset(
    playerTile.col,
    boardTiles,
    cellSize,
    viewport.width,
  )
  const offsetY = cameraOffset(
    playerTile.row,
    boardTiles,
    cellSize,
    viewport.height,
  )
  const themeId = getMazeTheme(state.maze.seed)
  const theme = mazeThemes[themeId]
  const boardStyle = {
    '--cell-size': `${cellSize}px`,
    '--visual-size': boardTiles,
    backgroundColor: theme.floorColor,
    backgroundImage: `url("${theme.floor[0]}")`,
    transform: `translate3d(${offsetX}px, ${offsetY}px, 0)`,
  } as CSSProperties
  const unlockedExit = state.rescues.every((target) => target.rescued)
  const rescuedTargets = state.rescues.filter((target) => target.rescued)
  const currentMotion = motion?.movementAttempt === movementAttempt ? motion : null

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
                    movementAttempt={movementAttempt}
                    animateMove={currentMotion?.followerMoved[index] ?? false}
                  />
                ))}
              </MazeCell>
            )
          }),
        )}
        <PlayerSprite
          appearance={appearance}
          facing={state.playerFacing}
          position={state.player}
          cellSize={cellSize}
          movementAttempt={movementAttempt}
          animateMove={Boolean(
            currentMotion &&
            currentMotion.playerFacing === state.playerFacing,
          )}
        />
        <WallLayer maze={state.maze} theme={theme} />
      </div>
    </div>
  )
}
