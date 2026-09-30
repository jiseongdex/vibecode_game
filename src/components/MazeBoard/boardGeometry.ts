import type { Cell, Direction, Maze, Position } from '../../game/types'

export interface WallSlot {
  cell: Cell
  side: Direction
  position: Position
}

export function visualSize(mazeSize: number): number {
  return mazeSize * 2 + 1
}

export function visualCell(position: Position): Position {
  return { row: position.row * 2 + 1, col: position.col * 2 + 1 }
}

export function visualWall(position: Position, side: Direction): Position {
  const center = visualCell(position)
  if (side === 'up') return { row: center.row - 1, col: center.col }
  if (side === 'right') return { row: center.row, col: center.col + 1 }
  if (side === 'down') return { row: center.row + 1, col: center.col }
  return { row: center.row, col: center.col - 1 }
}

export function closedWallSlots(maze: Maze): WallSlot[] {
  const slots: WallSlot[] = []
  for (const row of maze.cells) {
    for (const cell of row) {
      const sides: Direction[] = []
      if (cell.walls.top) sides.push('up')
      if (cell.walls.left) sides.push('left')
      if (cell.col === maze.size - 1 && cell.walls.right) sides.push('right')
      if (cell.row === maze.size - 1 && cell.walls.bottom) sides.push('down')
      for (const side of sides) {
        slots.push({ cell, side, position: visualWall(cell, side) })
      }
    }
  }
  return slots
}
