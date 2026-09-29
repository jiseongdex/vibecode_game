import type {
  Cell,
  CellWalls,
  Direction,
  Maze,
  Position,
} from './types'

const UINT32_RANGE = 0x1_0000_0000

interface Neighbor {
  direction: Direction
  position: Position
}

const directionOffsets: Record<Direction, Position> = {
  up: { row: -1, col: 0 },
  right: { row: 0, col: 1 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
}

const oppositeDirection: Record<Direction, Direction> = {
  up: 'down',
  right: 'left',
  down: 'up',
  left: 'right',
}

const directionToWall: Record<Direction, keyof CellWalls> = {
  up: 'top',
  right: 'right',
  down: 'bottom',
  left: 'left',
}

function assertValidSize(size: number): void {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError('Maze size must be a positive integer.')
  }
}

function createCryptoSeed(): number {
  const values = new Uint32Array(1)
  globalThis.crypto.getRandomValues(values)
  return values[0]
}

function createCells(size: number): Cell[][] {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => ({
      row,
      col,
      walls: {
        top: true,
        right: true,
        bottom: true,
        left: true,
      },
      visited: false,
    })),
  )
}

function isInside(size: number, position: Position): boolean {
  return (
    position.row >= 0 &&
    position.row < size &&
    position.col >= 0 &&
    position.col < size
  )
}

function getUnvisitedNeighbors(cells: Cell[][], cell: Cell): Neighbor[] {
  const neighbors: Neighbor[] = []

  for (const [direction, offset] of Object.entries(directionOffsets) as [
    Direction,
    Position,
  ][]) {
    const position = {
      row: cell.row + offset.row,
      col: cell.col + offset.col,
    }

    if (isInside(cells.length, position)) {
      const neighbor = cells[position.row][position.col]
      if (!neighbor.visited) {
        neighbors.push({ direction, position })
      }
    }
  }

  return neighbors
}

function removeWalls(current: Cell, next: Cell, direction: Direction): void {
  current.walls[directionToWall[direction]] = false

  const opposite = oppositeDirection[direction]
  next.walls[directionToWall[opposite]] = false
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE
  }
}

export function generateMaze(size: number, random?: () => number): Maze {
  assertValidSize(size)

  const seed = random
    ? Math.floor(random() * UINT32_RANGE) >>> 0
    : createCryptoSeed()
  const generator = random ?? createSeededRandom(seed)
  const cells = createCells(size)
  const stack: Cell[] = []
  let current = cells[0][0]
  current.visited = true
  let visitedCount = 1

  while (visitedCount < size * size) {
    const neighbors = getUnvisitedNeighbors(cells, current)

    if (neighbors.length === 0) {
      const previous = stack.pop()
      if (!previous) {
        throw new Error('Maze generation ended before every cell was visited.')
      }
      current = previous
      continue
    }

    const selected = neighbors[Math.floor(generator() * neighbors.length)]
    const next = cells[selected.position.row][selected.position.col]

    removeWalls(current, next, selected.direction)
    stack.push(current)
    next.visited = true
    current = next
    visitedCount += 1
  }

  for (const row of cells) {
    for (const cell of row) {
      cell.visited = false
    }
  }

  return { size, cells, seed }
}

export function getReachablePositions(
  maze: Maze,
  start: Position,
): Position[] {
  if (!isInside(maze.size, start)) {
    throw new RangeError('Start position must be inside the maze.')
  }

  const queue: Position[] = [{ ...start }]
  const reachable: Position[] = []
  const seen = new Set<string>([`${start.row}:${start.col}`])

  for (let index = 0; index < queue.length; index += 1) {
    const position = queue[index]
    const cell = maze.cells[position.row][position.col]
    reachable.push(position)

    for (const [direction, offset] of Object.entries(directionOffsets) as [
      Direction,
      Position,
    ][]) {
      if (cell.walls[directionToWall[direction]]) {
        continue
      }

      const next = {
        row: position.row + offset.row,
        col: position.col + offset.col,
      }
      const key = `${next.row}:${next.col}`

      if (isInside(maze.size, next) && !seen.has(key)) {
        seen.add(key)
        queue.push(next)
      }
    }
  }

  return reachable
}
