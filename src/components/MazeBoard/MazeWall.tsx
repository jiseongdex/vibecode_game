import { memo, useMemo } from 'react'
import type { CSSProperties } from 'react'

import type { MazeThemeAssets } from '../../assets/assetManifest'
import { getWallVariant } from '../../assets/mazeTheme'
import type { Maze } from '../../game/types'
import { wallDepth } from './boardDepth'
import { closedWallSlots, isWithinGridBounds } from './boardGeometry'
import type { GridBounds } from './boardGeometry'
import styles from './MazeBoard.module.css'

interface WallLayerProps {
  maze: Maze
  theme: MazeThemeAssets
  bounds?: GridBounds | null
}

interface ObstacleTileProps {
  row: number
  col: number
  variant: 0 | 1 | 2
  theme: MazeThemeAssets
  side?: string
}

function ObstacleTile({ row, col, variant, theme, side }: ObstacleTileProps) {
  const src = theme.wall[variant]
  const rotate = (side === 'left' || side === 'right') && theme.wallRotateOnVertical[variant]
  const style = {
    gridRow: row + 1,
    gridColumn: col + 1,
    zIndex: wallDepth(row),
    '--wall-color': theme.wallColor,
    '--wall-image-size': `${theme.wallDisplaySize[variant]}%`,
    '--wall-image-rotation': rotate ? '90deg' : '0deg',
  } as CSSProperties

  return (
    <span
      className={styles.obstacleTile}
      style={style}
      data-wall-side={side}
      data-junction={side === undefined ? 'true' : undefined}
      data-wall-variant={variant}
      data-visual-row={row}
      data-visual-col={col}
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
}

export const WallLayer = memo(function WallLayer({ maze, theme, bounds = null }: WallLayerProps) {
  const walls = useMemo(() => closedWallSlots(maze), [maze])
  const junctions = useMemo(() => {
    const adjacent = new Set<string>()
    for (const { position } of walls) {
      if (position.row % 2 === 0) {
        adjacent.add(`${position.row}:${position.col - 1}`)
        adjacent.add(`${position.row}:${position.col + 1}`)
      } else {
        adjacent.add(`${position.row - 1}:${position.col}`)
        adjacent.add(`${position.row + 1}:${position.col}`)
      }
    }
    return Array.from(adjacent, (key) => {
      const [row, col] = key.split(':').map(Number)
      return { row, col }
    })
  }, [walls])

  return (
    <>
      {walls.filter(({ position }) => isWithinGridBounds(position, bounds)).map(({ cell, side, position }) => (
        <ObstacleTile
          key={`${position.row}:${position.col}`}
          row={position.row}
          col={position.col}
          variant={getWallVariant(maze.seed, cell.row, cell.col, side)}
          theme={theme}
          side={side}
        />
      ))}
      {junctions.filter((position) => isWithinGridBounds(position, bounds)).map(({ row, col }) => (
        <ObstacleTile
          key={`${row}:${col}`}
          row={row}
          col={col}
          variant={getWallVariant(maze.seed, row, col, 'down')}
          theme={theme}
        />
      ))}
    </>
  )
})
