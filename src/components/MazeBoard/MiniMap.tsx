import { useMemo } from 'react'
import type { CSSProperties, ReactElement } from 'react'

import type { RescueTarget } from '../../game/gameState'
import type { Maze, Position } from '../../game/types'
import { visualSize } from './boardGeometry'
import {
  getMinimapWallSegments,
  projectGridCenter,
} from './minimapGeometry'
import type { MinimapViewportBounds } from './minimapGeometry'
import styles from './MiniMap.module.css'

export interface MiniMapProps {
  maze: Maze
  rescues: readonly RescueTarget[]
  exit: Position
  viewport: MinimapViewportBounds
}

function markerStyle(position: Position, boardTiles: number): CSSProperties {
  const { leftPercent, topPercent } = projectGridCenter(position, boardTiles)
  return { left: `${leftPercent}%`, top: `${topPercent}%` }
}

export function MiniMap({ maze, rescues, exit, viewport }: MiniMapProps): ReactElement {
  const boardTiles = visualSize(maze.size)
  const wallSegments = useMemo(() => getMinimapWallSegments(maze), [maze])
  const waiting = rescues.filter((target) => !target.rescued)
  const left = viewport.left * 100
  const top = viewport.top * 100
  const right = viewport.right * 100
  const bottom = viewport.bottom * 100
  const viewWidth = right - left
  const viewHeight = bottom - top

  return (
    <aside
      className={styles.minimap}
      role="region"
      aria-label={`전체 미니맵, 구조할 동물 ${waiting.length}마리와 탈출구`}
      data-testid="minimap"
    >
      <div className={styles.map}>
        <svg
          className={styles.walls}
          viewBox={`0 0 ${boardTiles} ${boardTiles}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          data-testid="minimap-walls"
        >
          {wallSegments.map(({ key, x1, y1, x2, y2 }) => (
            <line
              key={key}
              className={styles.wallLine}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
            />
          ))}
        </svg>

        <span
          className={styles.shade}
          data-testid="minimap-shade-top"
          style={{ left: 0, top: 0, width: '100%', height: `${top}%` }}
          aria-hidden="true"
        />
        <span
          className={styles.shade}
          data-testid="minimap-shade-bottom"
          style={{ left: 0, top: `${bottom}%`, width: '100%', height: `${100 - bottom}%` }}
          aria-hidden="true"
        />
        <span
          className={styles.shade}
          data-testid="minimap-shade-left"
          style={{ left: 0, top: `${top}%`, width: `${left}%`, height: `${viewHeight}%` }}
          aria-hidden="true"
        />
        <span
          className={styles.shade}
          data-testid="minimap-shade-right"
          style={{ left: `${right}%`, top: `${top}%`, width: `${100 - right}%`, height: `${viewHeight}%` }}
          aria-hidden="true"
        />

        {waiting.map((target) => (
          <span
            key={target.id}
            className={styles.animal}
            data-minimap-animal={target.id}
            style={markerStyle(target, boardTiles)}
            aria-hidden="true"
          />
        ))}
        <span
          className={styles.exit}
          data-testid="minimap-exit"
          style={markerStyle(exit, boardTiles)}
          aria-hidden="true"
        />
        <span
          className={styles.viewOutline}
          data-testid="minimap-viewport"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: `${viewWidth}%`,
            height: `${viewHeight}%`,
          }}
          aria-hidden="true"
        />
      </div>
    </aside>
  )
}
