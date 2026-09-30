import { useEffect } from 'react'

import type { Direction } from '../game/types'

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
      if (event.repeat) return
      onMove(direction)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onMove])
}
