import type { CSSProperties } from 'react'

import { gameAssets } from '../../assets/assetManifest'
import type { Position } from '../../game/types'
import { playerDepth } from '../MazeBoard/boardDepth'
import styles from '../MazeBoard/MazeBoard.module.css'

interface ExitSpriteProps {
  unlocked: boolean
  position: Position
}

export function ExitSprite({ unlocked, position }: ExitSpriteProps) {
  return (
    <span
      className={`${styles.sprite} ${styles.exitSprite} ${unlocked ? styles.exitUnlocked : ''}`}
      style={{
        '--sprite-size': 'calc(var(--cell-size) * 1.6)',
        backgroundColor: 'transparent',
        zIndex: playerDepth(position.row),
      } as CSSProperties}
      role="img"
      aria-label={unlocked ? '열린 탈출구' : '잠긴 탈출구'}
      data-asset-slot="exit"
    >
      <span aria-hidden="true">🚪</span>
      <img className={styles.exitImage} src={gameAssets.exit} alt="" aria-hidden="true" onError={(event) => { event.currentTarget.hidden = true }} />
      {unlocked && (
        <img
          className={styles.exitSparkles}
          src={gameAssets.exitSparkles}
          alt=""
          aria-hidden="true"
          data-testid="exit-sparkles"
          onError={(event) => { event.currentTarget.hidden = true }}
        />
      )}
    </span>
  )
}
