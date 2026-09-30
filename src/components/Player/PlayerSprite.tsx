import { useEffect, useState } from 'react'

import { playerSprites, playerWalkSprites } from '../../assets/assetManifest'
import type { PlayerAppearance } from '../../assets/assetManifest'
import type { Direction, Position } from '../../game/types'
import styles from '../MazeBoard/MazeBoard.module.css'

const playerImageCache = new Map<string, HTMLImageElement>()

function preloadPlayerImages(appearance: PlayerAppearance): void {
  const sources = [
    ...Object.values(playerSprites[appearance]),
    ...Object.values(playerWalkSprites[appearance]).flat(),
  ]

  for (const src of sources) {
    if (playerImageCache.has(src) || typeof Image === 'undefined') continue

    const image = new Image()
    playerImageCache.set(src, image)
    image.src = src
    if (typeof image.decode === 'function') {
      void image.decode().catch(() => undefined)
    }
  }
}

interface PlayerSpriteProps {
  appearance?: PlayerAppearance
  facing: Direction
  position: Position
  cellSize: number
  movementAttempt: number
  animateMove: boolean
}

export function PlayerSprite({
  appearance = 'girl',
  facing,
  position,
  cellSize,
  movementAttempt,
  animateMove,
}: PlayerSpriteProps) {
  const [frame, setFrame] = useState<0 | 1 | null>(null)

  useEffect(() => {
    preloadPlayerImages(appearance)
  }, [appearance])

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
  }, [animateMove, facing, movementAttempt])

  const walk = frame !== null && animateMove
  const frameIndex =
    movementAttempt % 2 === 1 ? frame : frame === null ? null : 1 - frame
  const src = walk && frameIndex !== null
    ? playerWalkSprites[appearance][facing][frameIndex]
    : playerSprites[appearance][facing]

  return (
    <span
      className={`${styles.sprite} ${styles.playerSprite}`}
      style={{
        translate: `${(position.col * 2 + 1.5) * cellSize}px ${(position.row * 2 + 1.5) * cellSize}px`,
      }}
      role="img"
      aria-label="탐험가"
      data-asset-slot="player"
      data-facing={facing}
      data-motion={walk ? 'walk' : 'none'}
    >
      <img
        src={src}
        alt=""
        aria-hidden="true"
        onLoad={(event) => { event.currentTarget.hidden = false }}
        onError={(event) => { event.currentTarget.hidden = true }}
      />
      <span className={styles.spriteFallback} aria-hidden="true">
        {appearance === 'girl' ? '🧙‍♀️' : '🧙‍♂️'}
      </span>
    </span>
  )
}
