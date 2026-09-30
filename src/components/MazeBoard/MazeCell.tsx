import type { CSSProperties, ReactNode } from 'react'

import type { MazeThemeAssets } from '../../assets/assetManifest'
import { getFloorVariant } from '../../assets/mazeTheme'
import type { Cell } from '../../game/types'
import { visualCell } from './boardGeometry'
import styles from './MazeBoard.module.css'

interface MazeCellProps {
  cell: Cell
  type: 'floor' | 'player' | 'rescue' | 'follower' | 'exit'
  seed: number
  theme: MazeThemeAssets
  children?: ReactNode
}

export function MazeCell({
  cell,
  type,
  seed,
  theme,
  children,
}: MazeCellProps) {
  const walls = [
    cell.walls.top && 'wallTop',
    cell.walls.right && 'wallRight',
    cell.walls.bottom && 'wallBottom',
    cell.walls.left && 'wallLeft',
  ]
    .filter(Boolean)
    .join(' ')
  const floorVariant = getFloorVariant(seed, cell.row, cell.col)
  const position = visualCell(cell)
  const style = {
    gridRow: position.row + 1,
    gridColumn: position.col + 1,
    backgroundColor: theme.floorColor,
    backgroundImage: `url("${theme.floor[floorVariant]}")`,
  } as CSSProperties

  return (
    <div
      className={`${styles.cell} ${walls}`}
      style={style}
      data-row={cell.row}
      data-col={cell.col}
      data-cell-type={type}
      data-floor-variant={floorVariant}
      data-visual-row={position.row}
      data-visual-col={position.col}
    >
      {children}
    </div>
  )
}
