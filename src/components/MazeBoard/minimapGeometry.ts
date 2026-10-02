import type { Maze, Position } from '../../game/types'
import { closedWallSlots } from './boardGeometry'

export interface MinimapWallSegment {
  key: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface MinimapMarkerPercent {
  leftPercent: number
  topPercent: number
}

export interface CameraFrame {
  boardTiles: number
  cellSize: number
  viewWidth: number
  viewHeight: number
  offsetX: number
  offsetY: number
}

export interface MinimapViewportBounds {
  left: number
  top: number
  right: number
  bottom: number
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function getMinimapWallSegments(maze: Maze): MinimapWallSegment[] {
  return closedWallSlots(maze).map(({ side, position }) => {
    const key = `${position.row}:${position.col}`

    if (side === 'up' || side === 'down') {
      return {
        key,
        x1: position.col - 0.5,
        y1: position.row + 0.5,
        x2: position.col + 1.5,
        y2: position.row + 0.5,
      }
    }

    return {
      key,
      x1: position.col + 0.5,
      y1: position.row - 0.5,
      x2: position.col + 0.5,
      y2: position.row + 1.5,
    }
  })
}

export function projectGridCenter(
  position: Position,
  boardTiles: number,
): MinimapMarkerPercent {
  if (
    !isPositiveInteger(boardTiles) ||
    !Number.isInteger(position.row) ||
    !Number.isInteger(position.col) ||
    position.row < 0 ||
    position.col < 0 ||
    position.row >= boardTiles ||
    position.col >= boardTiles
  ) {
    throw new RangeError('Minimap position must be inside a positive board.')
  }

  return {
    leftPercent: (position.col + 0.5) / boardTiles * 100,
    topPercent: (position.row + 0.5) / boardTiles * 100,
  }
}

export function getMinimapViewportBounds({
  boardTiles,
  cellSize,
  viewWidth,
  viewHeight,
  offsetX,
  offsetY,
}: CameraFrame): MinimapViewportBounds {
  if (
    !isPositiveInteger(boardTiles) ||
    !isFinitePositive(cellSize) ||
    !isFinitePositive(viewWidth) ||
    !isFinitePositive(viewHeight) ||
    !Number.isFinite(offsetX) ||
    !Number.isFinite(offsetY)
  ) {
    throw new RangeError('Minimap camera dimensions and offsets must be finite.')
  }

  const boardPixels = boardTiles * cellSize
  if (!Number.isFinite(boardPixels)) {
    throw new RangeError('Minimap board size must be finite.')
  }

  return {
    left: clampUnit(-offsetX / boardPixels),
    top: clampUnit(-offsetY / boardPixels),
    right: clampUnit((viewWidth - offsetX) / boardPixels),
    bottom: clampUnit((viewHeight - offsetY) / boardPixels),
  }
}
