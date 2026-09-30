import { memo, useMemo } from 'react'
import type { CSSProperties } from 'react'

import type { MazeThemeAssets } from '../../assets/assetManifest'
import { getWallVariant } from '../../assets/mazeTheme'
import type { Maze } from '../../game/types'
import { closedWallSlots } from './boardGeometry'
import styles from './MazeBoard.module.css'

interface WallLayerProps {
  maze: Maze
  theme: MazeThemeAssets
}

export const WallLayer = memo(function WallLayer({ maze, theme }: WallLayerProps) {
  const walls = useMemo(() => closedWallSlots(maze), [maze])

  return walls.map(({ cell, side, position }) => {
    const variant = getWallVariant(maze.seed, cell.row, cell.col, side)
    const src = theme.wall[variant]
    const style = {
      gridRow: position.row + 1,
      gridColumn: position.col + 1,
      '--wall-color': theme.wallColor,
    } as CSSProperties

    return (
      <span
        key={`${position.row}:${position.col}`}
        className={styles.obstacleTile}
        style={style}
        data-wall-side={side}
        data-wall-variant={variant}
        data-visual-row={position.row}
        data-visual-col={position.col}
        aria-hidden="true"
      >
        <img
          key={src}
          className={styles.wallBlock}
          src={src}
          alt=""
          onError={(event) => { event.currentTarget.hidden = true }}
        />
        <span className={styles.wallFallback} />
      </span>
    )
  })
})
