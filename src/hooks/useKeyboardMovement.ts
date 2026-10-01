import { useEffect } from 'react'

import type { Direction } from '../game/types'

const HOLD_REPEAT_INTERVAL_MS = 110

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

    const keyTimers = new Map<string, number>()

    const stopKey = (keyId: string) => {
      const timer = keyTimers.get(keyId)
      if (timer === undefined) return
      window.clearInterval(timer)
      keyTimers.delete(keyId)
    }

    const clearPressedKeys = () => {
      for (const keyId of keyTimers.keys()) stopKey(keyId)
    }

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
      if (event.repeat || keyTimers.has(keyId)) return

      onMove(direction)
      keyTimers.set(
        keyId,
        window.setInterval(() => onMove(direction), HOLD_REPEAT_INTERVAL_MS),
      )
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      stopKey(event.code || event.key)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', clearPressedKeys)
    return () => {
      clearPressedKeys()
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', clearPressedKeys)
    }
  }, [enabled, onMove])
}
