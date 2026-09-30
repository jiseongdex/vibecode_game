import { useEffect, useState } from 'react'

import { getRescueAnimal } from '../../assets/assetManifest'
import type { Direction } from '../../game/types'
import styles from '../MazeBoard/MazeBoard.module.css'

interface RescueSpriteProps {
  animalId: string
  facing?: Direction
  following?: boolean
  order?: number
  moveCount?: number
  animateMove?: boolean
}

export function RescueSprite({
  animalId,
  facing = 'down',
  following = false,
  order,
  moveCount = 0,
  animateMove = false,
}: RescueSpriteProps) {
  const [hopping, setHopping] = useState(false)
  const animal = getRescueAnimal(animalId)
  const src = animal.sprites[facing]

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
  }, [following, animateMove, moveCount])

  return (
    <span
      className={`${styles.sprite} ${following ? styles.followerSprite : styles.rescueSprite}`}
      role="img"
      aria-label={following ? `구출한 동료 ${order}` : '구출 대상'}
      data-asset-slot={following ? 'follower' : 'rescue-target'}
      data-follower-order={following ? order : undefined}
      data-animal={animal.name}
      data-facing={facing}
      data-motion={hopping ? 'hop' : 'none'}
      title={animal.name}
    >
      <span
        key={moveCount}
        className={`${styles.spriteVisual} ${hopping ? styles.hopping : ''}`}
      >
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          onError={(event) => { event.currentTarget.hidden = true }}
        />
        <span className={styles.spriteFallback} aria-hidden="true">
          {animal.fallback}
        </span>
      </span>
    </span>
  )
}
