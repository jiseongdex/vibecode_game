import { useEffect, useState } from 'react'

import { playerSprites, playerWalkSprites } from '../../assets/assetManifest'
import type { PlayerAppearance } from '../../assets/assetManifest'
import type { Direction } from '../../game/types'
import styles from '../MazeBoard/MazeBoard.module.css'

interface PlayerSpriteProps {
  appearance?: PlayerAppearance
  facing: Direction
  moveCount: number
  animateMove: boolean
}

export function PlayerSprite({
  appearance = 'girl',
  facing,
  moveCount,
  animateMove,
}: PlayerSpriteProps) {
  const [frame, setFrame] = useState<0 | 1 | null>(null)

  useEffect(() => {
    if (
      !animateMove ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setFrame(null)
      return
    }

    setFrame(0)
    const secondFrame = window.setTimeout(() => setFrame(1), 80)
    const stop = window.setTimeout(() => setFrame(null), 160)
    return () => {
      window.clearTimeout(secondFrame)
      window.clearTimeout(stop)
    }
  }, [animateMove, facing, moveCount])

  const walk = frame !== null && animateMove
  const frameIndex =
    moveCount % 2 === 1 ? frame : frame === null ? null : 1 - frame
  const src = walk && frameIndex !== null
    ? playerWalkSprites[appearance][facing][frameIndex]
    : playerSprites[appearance][facing]

  return (
    <span
      className={`${styles.sprite} ${styles.playerSprite}`}
      role="img"
      aria-label="탐험가"
      data-asset-slot="player"
      data-facing={facing}
      data-motion={walk ? 'walk' : 'none'}
    >
      <span aria-hidden="true">{appearance === 'girl' ? '🧙‍♀️' : '🧙‍♂️'}</span>
      <img
        key={src}
        src={src}
        alt=""
        aria-hidden="true"
        onError={(event) => { event.currentTarget.hidden = true }}
      />
    </span>
  )
}
