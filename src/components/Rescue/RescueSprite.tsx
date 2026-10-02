import { useEffect, useState } from 'react'
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
  movementAttempt?: number
  animateMove?: boolean
}

export function RescueSprite({
  animalId,
  position,
  cellSize,
  facing = 'down',
  following = false,
  order,
  movementAttempt = 0,
  animateMove = false,
}: RescueSpriteProps) {
  const [hopping, setHopping] = useState(false)
  const animal = getRescueAnimal(animalId)
  const src = animal.sprites[facing]
  const spriteLeft = Math.round((position.col - 0.2) * cellSize * 100) / 100
  const spriteTop = Math.round((position.row - 0.2) * cellSize * 100) / 100

  useEffect(() => {
    if (
      !following ||
      !animateMove ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setHopping(false)
      return
    }

    setHopping(true)
    const stop = window.setTimeout(() => setHopping(false), 220)
    return () => window.clearTimeout(stop)
  }, [following, animateMove, movementAttempt])

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
      data-motion={hopping ? 'hop' : 'none'}
      title={animal.name}
    >
      <span
        key={movementAttempt}
        className={`${styles.spriteVisual} ${hopping ? styles.hopping : ''}`}
      >
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
