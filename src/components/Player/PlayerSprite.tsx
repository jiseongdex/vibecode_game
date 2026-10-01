import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

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

interface RenderedPlayerVisual {
  appearance: PlayerAppearance
  facing: Direction
  src: string
}

interface TurnOverlay {
  id: number
  src: string
}

const TURN_DURATION_MS = 100
const PLAYER_SPRITE_SCALE = 1.6

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
    const secondFrame = window.setTimeout(() => setFrame(1), 55)
    const stop = window.setTimeout(() => setFrame(null), 110)
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
  const previousVisual = useRef<RenderedPlayerVisual>({ appearance, facing, src })
  const nextTurnId = useRef(0)
  const [turn, setTurn] = useState<TurnOverlay | null>(null)

  useLayoutEffect(() => {
    const previous = previousVisual.current
    if (previous.appearance === appearance && previous.facing !== facing) {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        setTurn(null)
      } else {
        nextTurnId.current += 1
        setTurn({ id: nextTurnId.current, src: previous.src })
      }
    } else if (previous.appearance !== appearance) {
      setTurn(null)
    }
    previousVisual.current = { appearance, facing, src }
  })

  useEffect(() => {
    if (!turn) return

    const stop = window.setTimeout(() => {
      setTurn((current) => current?.id === turn.id ? null : current)
    }, TURN_DURATION_MS)
    return () => window.clearTimeout(stop)
  }, [turn])

  const spriteInset = (PLAYER_SPRITE_SCALE - 1) / 2
  const spriteLeft = Math.round((position.col - spriteInset) * cellSize * 100) / 100
  const spriteTop = Math.round((position.row - spriteInset) * cellSize * 100) / 100

  return (
    <span
      className={`${styles.sprite} ${styles.playerSprite}`}
      style={{
        '--sprite-size': `calc(var(--cell-size) * ${PLAYER_SPRITE_SCALE})`,
        translate: `${spriteLeft}px ${spriteTop}px`,
      } as CSSProperties}
      role="img"
      aria-label="탐험가"
      data-asset-slot="player"
      data-facing={facing}
      data-grid-row={position.row}
      data-grid-col={position.col}
      data-motion={walk ? 'walk' : 'none'}
    >
      <img
        src={src}
        alt=""
        aria-hidden="true"
        style={{ objectFit: 'contain' }}
        onLoad={(event) => { event.currentTarget.hidden = false }}
        onError={(event) => { event.currentTarget.hidden = true }}
      />
      <span className={styles.spriteFallback} aria-hidden="true">
        {appearance === 'girl' ? '🧙‍♀️' : '🧙‍♂️'}
      </span>
      {turn && (
        <span
          key={turn.id}
          className={styles.turnPrevious}
          style={{ backgroundImage: `url("${turn.src}")` }}
          aria-hidden="true"
          data-turn-previous={turn.src}
        />
      )}
    </span>
  )
}
