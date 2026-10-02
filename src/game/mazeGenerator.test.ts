import {
  createSeededRandom,
  generateMaze,
  getReachablePositions,
} from './mazeGenerator'
import type { Maze } from './types'

function serializeWalls(maze: Maze): string {
  return maze.cells
    .flat()
    .map((cell) =>
      [
        cell.walls.top,
        cell.walls.right,
        cell.walls.bottom,
        cell.walls.left,
      ]
        .map(Number)
        .join(''),
    )
    .join('|')
}

function countOpenEdges(maze: Maze): number {
  return maze.cells.flat().reduce((edgeCount, cell) => {
    const rightEdge = cell.col < maze.size - 1 && !cell.walls.right ? 1 : 0
    const bottomEdge =
      cell.row < maze.size - 1 && !cell.walls.bottom ? 1 : 0
    return edgeCount + rightEdge + bottomEdge
  }, 0)
}

describe('generateMaze', () => {
  it.each([15, 100])('creates a %ix%i maze with reset visit flags', (size) => {
    const maze = generateMaze(size, createSeededRandom(101))

    expect(maze.size).toBe(size)
    expect(maze.cells).toHaveLength(size)
    expect(maze.cells.every((row) => row.length === size)).toBe(true)
    expect(maze.cells.flat().every((cell) => !cell.visited)).toBe(true)
  })

  it('connects every cell without introducing a cycle', () => {
    const maze = generateMaze(15, createSeededRandom(2026))

    expect(getReachablePositions(maze, { row: 0, col: 0 })).toHaveLength(
      maze.size * maze.size,
    )
    expect(countOpenEdges(maze)).toBe(maze.size * maze.size - 1)
  })

  it('creates reciprocal walls between adjacent cells', () => {
    const maze = generateMaze(15, createSeededRandom(77))

    for (const row of maze.cells) {
      for (const cell of row) {
        if (cell.col < maze.size - 1) {
          expect(cell.walls.right).toBe(
            maze.cells[cell.row][cell.col + 1].walls.left,
          )
        }
        if (cell.row < maze.size - 1) {
          expect(cell.walls.bottom).toBe(
            maze.cells[cell.row + 1][cell.col].walls.top,
          )
        }
      }
    }
  })

  it('is deterministic for equal random seeds and differs for other seeds', () => {
    const first = generateMaze(15, createSeededRandom(1234))
    const second = generateMaze(15, createSeededRandom(1234))
    const different = generateMaze(15, createSeededRandom(5678))

    expect(second.seed).toBe(first.seed)
    expect(serializeWalls(second)).toBe(serializeWalls(first))
    expect(serializeWalls(different)).not.toBe(serializeWalls(first))
  })

  it('rejects invalid sizes and unreachable start positions', () => {
    expect(() => generateMaze(0)).toThrow(RangeError)

    const maze = generateMaze(3, createSeededRandom(1))
    expect(() => getReachablePositions(maze, { row: -1, col: 0 })).toThrow(
      RangeError,
    )
  })
})
