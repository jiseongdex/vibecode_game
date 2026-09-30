import { useEffect } from 'react'

import type { Direction } from '../game/types'

const INITIAL_REPEAT_DELAY_MS = 500
const MIN_REPEAT_INTERVAL_MS = 160

interface KeyboardMovementOptions {
  enabled: boolean
  onMove: (direction: Direction) => void
}

const keyDirections: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowRight: 'right',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  w: 'up',
  d: 'right',
  s: 'down',
  a: 'left',
}

export function useKeyboardMovement({
  enabled,
  onMove,
}: KeyboardMovementOptions): void {
  useEffect(() => {
    if (!enabled) return

    const keyTimes = new Map<string, { startedAt: number; lastMoveAt: number }>()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return

      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return
      }

      const direction = keyDirections[event.key] ?? keyDirections[event.key.toLowerCase()]
      if (!direction) return

      if (event.key.startsWith('Arrow')) event.preventDefault()

      const keyId = event.code || event.key
      if (event.repeat) {
        const timing = keyTimes.get(keyId)
        if (
          !timing ||
          event.timeStamp - timing.startedAt < INITIAL_REPEAT_DELAY_MS ||
          event.timeStamp - timing.lastMoveAt < MIN_REPEAT_INTERVAL_MS
        ) {
          return
        }
        timing.lastMoveAt = event.timeStamp
      } else {
        keyTimes.set(keyId, {
          startedAt: event.timeStamp,
          lastMoveAt: event.timeStamp,
        })
      }

      onMove(direction)
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      keyTimes.delete(event.code || event.key)
    }
    const clearPressedKeys = () => keyTimes.clear()

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', clearPressedKeys)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', clearPressedKeys)
    }
  }, [enabled, onMove])
}
