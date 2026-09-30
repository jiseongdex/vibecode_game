import type { CSSProperties, ReactNode } from 'react'

import type { MazeThemeAssets } from '../../assets/assetManifest'
import { getFloorVariant, getWallVariant } from '../../assets/mazeTheme'
import type { Cell, Direction } from '../../game/types'
import styles from './MazeBoard.module.css'

interface MazeCellProps {
  cell: Cell
  type: 'floor' | 'player' | 'rescue' | 'follower' | 'exit'
  seed: number
  mazeSize: number
  theme: MazeThemeAssets
  children?: ReactNode
}

export function MazeCell({
  cell,
  type,
  seed,
  mazeSize,
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
  const style = {
    backgroundColor: theme.floorColor,
    backgroundImage: `url("${theme.floor[floorVariant]}")`,
    '--wall-color': theme.wallColor,
  } as CSSProperties
  const sides: Direction[] = []
  if (cell.walls.top) sides.push('up')
  if (cell.walls.left) sides.push('left')
  if (cell.col === mazeSize - 1 && cell.walls.right) sides.push('right')
  if (cell.row === mazeSize - 1 && cell.walls.bottom) sides.push('down')

  return (
    <div
      className={`${styles.cell} ${walls}`}
      style={style}
      data-row={cell.row}
      data-col={cell.col}
      data-cell-type={type}
      data-floor-variant={floorVariant}
    >
      {sides.map((side) => {
        const variant = getWallVariant(seed, cell.row, cell.col, side)
        return (
          <span
            key={side}
            className={`${styles.wallSegment} ${styles[`wallSegment${side}`]}`}
            data-wall-side={side}
            data-wall-variant={variant}
            aria-hidden="true"
          >
            <span
              className={styles.wallBlock}
              style={{ backgroundImage: `url("${theme.wall[variant]}")` }}
            />
          </span>
        )
      })}
      {children}
    </div>
  )
}
