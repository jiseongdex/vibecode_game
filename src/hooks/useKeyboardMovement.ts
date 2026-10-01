import { useEffect } from 'react'

import type { Direction } from '../game/types'

const HOLD_REPEAT_INTERVAL_MS = 110

interface KeyboardMovementOptions {
  enabled: boolean
  onMove: (direction: Direction) => void
  onPressedDirectionsChange?: (directions: Direction[]) => void
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
  onPressedDirectionsChange,
}: KeyboardMovementOptions): void {
  useEffect(() => {
    if (!enabled) return

    const keyTimers = new Map<string, { timer: number; direction: Direction }>()

    const notifyPressedDirections = () => {
      onPressedDirectionsChange?.([
        ...new Set([...keyTimers.values()].map(({ direction }) => direction)),
      ])
    }

    const stopKey = (keyId: string) => {
      const pressed = keyTimers.get(keyId)
      if (pressed === undefined) return
      window.clearInterval(pressed.timer)
      keyTimers.delete(keyId)
      notifyPressedDirections()
    }

    const clearPressedKeys = () => {
      for (const { timer } of keyTimers.values()) window.clearInterval(timer)
      keyTimers.clear()
      notifyPressedDirections()
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
        {
          timer: window.setInterval(() => onMove(direction), HOLD_REPEAT_INTERVAL_MS),
          direction,
        },
      )
      notifyPressedDirections()
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
  }, [enabled, onMove, onPressedDirectionsChange])
}
