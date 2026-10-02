import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import { mazeThemes } from '../../assets/assetManifest'
import type { PlayerAppearance } from '../../assets/assetManifest'
import { getFloorVariant, getMazeTheme } from '../../assets/mazeTheme'
import type { GameState } from '../../game/gameState'
import type { Direction, Position } from '../../game/types'
import { ExitSprite } from '../Exit/ExitSprite'
import { PlayerSprite } from '../Player/PlayerSprite'
import { RescueSprite } from '../Rescue/RescueSprite'
import { foregroundDepth } from './boardDepth'
import { openPassageSlots, visualCell, visualSize } from './boardGeometry'
import { MazeCell } from './MazeCell'
import { WallLayer } from './MazeWall'
import { MiniMap } from './MiniMap'
import { getMinimapViewportBounds } from './minimapGeometry'
import styles from './MazeBoard.module.css'

export interface MazeBoardProps {
  state: GameState
  onMove: (direction: Direction) => void
  appearance?: PlayerAppearance
  movementAttempt?: number
  movementSource?: 'keyboard' | 'button'
  pressedDirections?: readonly Direction[]
  scale?: number
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
  playerMoved: boolean
  followerMoved: boolean[]
}

const VIEWPORT_WIDTH = 1240
const VIEWPORT_HEIGHT = 840
const TARGET_VISIBLE_COLUMNS = 11.4
const TARGET_VISIBLE_ROWS = 7.7
const CELL_SIZE = Math.floor(Math.min(
  VIEWPORT_WIDTH / TARGET_VISIBLE_COLUMNS,
  VIEWPORT_HEIGHT / TARGET_VISIBLE_ROWS,
))

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
  movementSource = 'button',
  pressedDirections = [],
  scale = 1,
}: MazeBoardProps) {
  const previous = useRef<MotionSnapshot>({
    movementAttempt,
    seed: state.maze.seed,
    player: { ...state.player },
    playerFacing: state.playerFacing,
    followers: state.followers.map((follower) => ({ ...follower })),
  })
  const [motion, setMotion] = useState<MotionState | null>(null)

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
        playerMoved: !samePosition(last.player, next.player),
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

  const sceneScale = Number.isFinite(scale) && scale > 0 ? scale : 1
  const cellSize = CELL_SIZE * sceneScale
  const viewWidth = VIEWPORT_WIDTH * sceneScale
  const viewHeight = VIEWPORT_HEIGHT * sceneScale
  const boardTiles = visualSize(state.maze.size)
  const playerTile = state.player
  const offsetX = cameraOffset(
    playerTile.col,
    boardTiles,
    cellSize,
    viewWidth,
  )
  const offsetY = cameraOffset(
    playerTile.row,
    boardTiles,
    cellSize,
    viewHeight,
  )
  const minimapViewport = getMinimapViewportBounds({
    boardTiles, cellSize, viewWidth, viewHeight, offsetX, offsetY,
  })
  const themeId = getMazeTheme(state.maze.seed)
  const theme = mazeThemes[themeId]
  const boardStyle = {
    '--cell-size': `${cellSize}px`,
    '--visual-size': boardTiles,
    '--foreground-depth': foregroundDepth(boardTiles),
    backgroundColor: theme.floorColor,
    backgroundImage: `url("${theme.floor[0]}")`,
    transform: `translate3d(${offsetX}px, ${offsetY}px, 0)`,
  } as CSSProperties
  const unlockedExit = state.rescues.every((target) => target.rescued)
  const rescuedTargets = state.rescues.filter((target) => target.rescued)
  const currentMotion = motion?.movementAttempt === movementAttempt ? motion : null
  const animatePlayer = Boolean(
    currentMotion &&
    currentMotion.playerFacing === state.playerFacing &&
    (
      currentMotion.playerMoved ||
      (
        state.status === 'playing' &&
        (movementSource === 'button' || pressedDirections.includes(state.playerFacing)))
    ),
  )

  return (
    <div
      className={styles.viewport}
      role="region"
      aria-label={`${state.stageConfig.stage}단계 미로`}
      data-testid="maze-viewport"
      style={{ width: viewWidth, height: viewHeight, borderWidth: 5 * sceneScale }}
    >
      <div
        className={styles.board}
        style={boardStyle}
        data-testid="maze-board"
        data-theme={themeId}
      >
        {openPassageSlots(state.maze).map(({ cell, position }) => {
          const floorVariant = getFloorVariant(state.maze.seed, cell.row, cell.col)
          return (
            <span
              key={`${position.row}:${position.col}`}
              className={styles.openPassage}
              style={{
                gridRow: position.row + 1,
                gridColumn: position.col + 1,
                backgroundColor: theme.floorColor,
                backgroundImage: `url("${theme.floor[floorVariant]}")`,
              }}
              data-open-passage="true"
              data-visual-row={position.row}
              data-visual-col={position.col}
            />
          )
        })}
        {state.maze.cells.flatMap((row) =>
          row.map((cell) => {
            const position = { row: cell.row, col: cell.col }
            const gridPosition = visualCell(position)
            const isPlayer = samePosition(gridPosition, state.player)
            const isExit = samePosition(gridPosition, state.exit)
            const waiting = state.rescues.filter(
              (target) => !target.rescued && samePosition(gridPosition, target),
            )
            const type = isPlayer
              ? 'player'
              : waiting.length > 0
                ? 'rescue'
                : state.followers.some((follower) => samePosition(gridPosition, follower))
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
              </MazeCell>
            )
          }),
        )}
        {state.rescues.filter((target) => !target.rescued).map((target) => (
          <RescueSprite
            key={target.id}
            animalId={target.id}
            position={target}
            cellSize={cellSize}
          />
        ))}
        {state.followers.map((position, index) => (
          <RescueSprite
            key={`follower-${index}`}
            animalId={rescuedTargets[index]?.id ?? 'rescue-1'}
            position={position}
            cellSize={cellSize}
            following
            order={index + 1}
            facing={state.followerFacings[index] ?? 'down'}
            movementAttempt={movementAttempt}
            animateMove={currentMotion?.followerMoved[index] ?? false}
          />
        ))}
        <PlayerSprite
          appearance={appearance}
          facing={state.playerFacing}
          position={state.player}
          cellSize={cellSize}
          movementAttempt={movementAttempt}
          animateMove={animatePlayer}
        />
        <WallLayer maze={state.maze} theme={theme} />
      </div>
      <MiniMap
        maze={state.maze}
        rescues={state.rescues}
        exit={state.exit}
        viewport={minimapViewport}
      />
    </div>
  )
}
