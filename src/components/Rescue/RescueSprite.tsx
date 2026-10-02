import type { CSSProperties } from 'react'

import { gameAssets, getRescueAnimal } from '../../assets/assetManifest'
import type { Direction, Position } from '../../game/types'
import styles from '../MazeBoard/MazeBoard.module.css'

interface RescueSpriteProps {
  animalId: string
  position: Position
  cellSize: number
  facing?: Direction
  following?: boolean
  order?: number
}

export function RescueSprite({
  animalId,
  position,
  cellSize,
  facing = 'down',
  following = false,
  order,
}: RescueSpriteProps) {
  const animal = getRescueAnimal(animalId)
  const src = animal.sprites[facing]
  const spriteLeft = Math.round((position.col - 0.2) * cellSize * 100) / 100
  const spriteTop = Math.round((position.row - 0.2) * cellSize * 100) / 100

  return (
    <span
      className={`${styles.sprite} ${following ? styles.followerSprite : styles.rescueSprite}`}
      style={{
        '--sprite-size': 'calc(var(--cell-size) * 1.4)',
        top: `${spriteTop}px`,
        left: `${spriteLeft}px`,
        transform: 'none',
      } as CSSProperties}
      role="img"
      aria-label={following ? `구출한 동료 ${order}` : '구출 대상'}
      data-asset-slot={following ? 'follower' : 'rescue-target'}
      data-follower-order={following ? order : undefined}
      data-animal={animal.name}
      data-facing={facing}
      data-grid-row={position.row}
      data-grid-col={position.col}
      title={animal.name}
    >
      <span className={styles.spriteVisual}>
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          style={{ objectFit: 'contain' }}
          onError={(event) => { event.currentTarget.hidden = true }}
        />
        <span className={styles.spriteFallback} aria-hidden="true">
          {animal.fallback}
        </span>
      </span>
      {!following && (
        <span className={styles.cageOverlay} aria-hidden="true">
          <img
            src={gameAssets.rescueCage}
            alt=""
            data-testid="rescue-cage"
            onError={(event) => { event.currentTarget.hidden = true }}
          />
        </span>
      )}
    </span>
  )
}
