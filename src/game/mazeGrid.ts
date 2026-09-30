import type { Maze, Position } from './types'

/** Number of rendered movement tiles for an N by N logical maze. */
export function expandedGridSize(size: number): number {
  return size * 2 + 1
}

/** Maps a logical maze-cell coordinate to its center on the expanded grid. */
export function logicalToGridPosition(position: Position): Position {
  return { row: position.row * 2 + 1, col: position.col * 2 + 1 }
}

/** Returns a logical cell coordinate only when the expanded coordinate is a cell center. */
export function gridToLogicalPosition(position: Position): Position | null {
  if (
    !Number.isInteger(position.row) ||
    !Number.isInteger(position.col) ||
    position.row < 1 ||
    position.col < 1 ||
    position.row % 2 === 0 ||
    position.col % 2 === 0
  ) {
    return null
  }

  return { row: (position.row - 1) / 2, col: (position.col - 1) / 2 }
}

/** Returns whether an expanded-grid tile is a logical floor center or open passage. */
export function isWalkableGridPosition(maze: Maze, position: Position): boolean {
  const gridSize = expandedGridSize(maze.size)
  if (
    !Number.isInteger(position.row) ||
    !Number.isInteger(position.col) ||
    position.row < 0 ||
    position.col < 0 ||
    position.row >= gridSize ||
    position.col >= gridSize
  ) {
    return false
  }

  if (position.row % 2 === 1 && position.col % 2 === 1) return true

  if (position.row % 2 === 1 && position.col % 2 === 0) {
    const logicalRow = (position.row - 1) / 2
    const leftCol = position.col / 2 - 1
    if (leftCol < 0 || leftCol + 1 >= maze.size) return false
    return !maze.cells[logicalRow][leftCol].walls.right
  }

  if (position.row % 2 === 0 && position.col % 2 === 1) {
    const upperRow = position.row / 2 - 1
    const logicalCol = (position.col - 1) / 2
    if (upperRow < 0 || upperRow + 1 >= maze.size) return false
    return !maze.cells[upperRow][logicalCol].walls.bottom
  }

  return false
}
