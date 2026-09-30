import { createSeededRandom, generateMaze } from './mazeGenerator'
import {
  expandedGridSize,
  gridToLogicalPosition,
  isWalkableGridPosition,
  logicalToGridPosition,
} from './mazeGrid'
import type { Maze, Position } from './types'

function closedMaze(size: number): Maze {
  return {
    size,
    seed: 1,
    cells: Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, col) => ({
        row,
        col,
        visited: true,
        walls: { top: true, right: true, bottom: true, left: true },
      })),
    ),
  }
}

describe('expanded maze grid', () => {
  it('maps logical cell centers to odd coordinates and back', () => {
    expect(expandedGridSize(3)).toBe(7)
    expect(logicalToGridPosition({ row: 0, col: 2 })).toEqual({ row: 1, col: 5 })
    expect(gridToLogicalPosition({ row: 5, col: 3 })).toEqual({ row: 2, col: 1 })
    expect(gridToLogicalPosition({ row: 2, col: 3 })).toBeNull()
    expect(gridToLogicalPosition({ row: 1, col: 2 })).toBeNull()
    expect(gridToLogicalPosition({ row: 0, col: 1 })).toBeNull()
  })

  it('allows floor centers and only open horizontal or vertical passages', () => {
    const maze = closedMaze(3)
    maze.cells[1][1].walls.right = false
    maze.cells[1][2].walls.left = false
    maze.cells[0][1].walls.bottom = false
    maze.cells[1][1].walls.top = false

    expect(isWalkableGridPosition(maze, { row: 3, col: 3 })).toBe(true)
    expect(isWalkableGridPosition(maze, { row: 3, col: 4 })).toBe(true)
    expect(isWalkableGridPosition(maze, { row: 2, col: 3 })).toBe(true)
    expect(isWalkableGridPosition(maze, { row: 3, col: 2 })).toBe(false)
    expect(isWalkableGridPosition(maze, { row: 4, col: 3 })).toBe(false)
  })

  it('blocks junctions, outside connectors, and invalid coordinates', () => {
    const maze = generateMaze(3, createSeededRandom(4))
    const blocked: Position[] = [
      { row: 2, col: 2 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 6, col: 5 },
      { row: 5, col: 6 },
      { row: -1, col: 1 },
      { row: 1.5, col: 1 },
    ]
    for (const position of blocked) {
      expect(isWalkableGridPosition(maze, position)).toBe(false)
    }
  })
})
