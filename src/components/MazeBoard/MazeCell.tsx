import type { ReactNode } from 'react'

import type { Cell } from '../../game/types'
import styles from './MazeBoard.module.css'

interface MazeCellProps {
  cell: Cell
  type: 'floor' | 'player' | 'rescue' | 'follower' | 'exit'
  children?: ReactNode
}

export function MazeCell({ cell, type, children }: MazeCellProps) {
  const walls = [
    cell.walls.top && styles.wallTop,
    cell.walls.right && styles.wallRight,
    cell.walls.bottom && styles.wallBottom,
    cell.walls.left && styles.wallLeft,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={`${styles.cell} ${walls}`}
      data-row={cell.row}
      data-col={cell.col}
      data-cell-type={type}
    >
      {children}
    </div>
  )
}
