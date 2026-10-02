import { useEffect } from 'react'

import { isWalkableGridPosition } from '../game/mazeGrid'
import type { Direction, Maze, Position } from '../game/types'

const HOLD_REPEAT_INTERVAL_MS = 110

interface KeyboardMovementOptions {
  enabled: boolean
  onMove: (direction: Direction) => void
  getTurnContext: () => TurnContext
  onPressedDirectionsChange?: (directions: Direction[]) => void
}

interface TurnContext {
  player: Position
  maze: Maze
}

interface PendingTurn {
  keyId: string
  direction: Direction
  approachDirection: Direction
  start: Position
  entry: Position
  phase: 'approach' | 'turn'
}

const directionOffsets: Record<Direction, Position> = {
  up: { row: -1, col: 0 },
  right: { row: 0, col: 1 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
}

function nextPosition(position: Position, direction: Direction): Position {
  const offset = directionOffsets[direction]
  return { row: position.row + offset.row, col: position.col + offset.col }
}

function samePosition(first: Position, second: Position): boolean {
  return first.row === second.row && first.col === second.col
}

function isPerpendicular(first: Direction, second: Direction): boolean {
  return directionOffsets[first].row !== directionOffsets[second].row &&
    directionOffsets[first].col !== directionOffsets[second].col
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
  getTurnContext,
  onPressedDirectionsChange,
}: KeyboardMovementOptions): void {
  useEffect(() => {
    if (!enabled) return

    const heldKeys = new Map<string, Direction>()
    let activeKeyId: string | null = null
    let repeatTimer: number | null = null
    let pendingTurn: PendingTurn | null = null

    const lastHeldKeyId = (): string | null => [...heldKeys.keys()].at(-1) ?? null
    const hasDirection = (direction: Direction): boolean =>
      [...heldKeys.values()].includes(direction)

    const stopTimer = () => {
      if (repeatTimer !== null) window.clearInterval(repeatTimer)
      repeatTimer = null
    }

    const repeatMove = () => {
      if (pendingTurn) {
        const pending = pendingTurn
        const { player, maze } = getTurnContext()
        if (!heldKeys.has(pending.keyId) || !hasDirection(pending.approachDirection)) {
          pendingTurn = null
        } else if (pending.phase === 'approach' && samePosition(player, pending.start)) {
          pending.phase = 'turn'
          onMove(pending.approachDirection)
          return
        } else if (
          pending.phase === 'turn' &&
          samePosition(player, pending.entry) &&
          isWalkableGridPosition(maze, nextPosition(player, pending.direction))
        ) {
          activeKeyId = pending.keyId
          pendingTurn = null
          onMove(pending.direction)
          return
        } else {
          pendingTurn = null
        }
      }

      const direction = activeKeyId === null ? undefined : heldKeys.get(activeKeyId)
      if (direction) onMove(direction)
    }

    const startTimer = () => {
      stopTimer()
      repeatTimer = window.setInterval(repeatMove, HOLD_REPEAT_INTERVAL_MS)
    }

    const notifyPressedDirections = () => {
      onPressedDirectionsChange?.([
        ...new Set(heldKeys.values()),
      ])
    }

    const stopKey = (keyId: string) => {
      if (!heldKeys.delete(keyId)) return
      if (pendingTurn) {
        if (keyId === pendingTurn.keyId || !hasDirection(pendingTurn.approachDirection)) {
          pendingTurn = null
        } else if (activeKeyId === keyId) {
          activeKeyId = [...heldKeys.entries()]
            .filter(([, direction]) => direction === pendingTurn?.approachDirection)
            .at(-1)?.[0] ?? null
        }
      }
      if (activeKeyId === keyId || (activeKeyId !== null && !heldKeys.has(activeKeyId))) {
        activeKeyId = lastHeldKeyId()
      }
      if (heldKeys.size === 0) stopTimer()
      notifyPressedDirections()
    }

    const clearPressedKeys = () => {
      stopTimer()
      heldKeys.clear()
      activeKeyId = null
      pendingTurn = null
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
      if (event.repeat || heldKeys.has(keyId)) return

      const activeDirection = activeKeyId === null ? undefined : heldKeys.get(activeKeyId)
      const sameDirectionHeld = hasDirection(direction)
      heldKeys.set(keyId, direction)

      if (!activeDirection) {
        activeKeyId = keyId
        onMove(direction)
        startTimer()
      } else if (!sameDirectionHeld) {
        pendingTurn = null
        const { player, maze } = getTurnContext()
        if (isWalkableGridPosition(maze, nextPosition(player, direction))) {
          activeKeyId = keyId
          onMove(direction)
          startTimer()
        } else if (isPerpendicular(activeDirection, direction)) {
          const entry = nextPosition(player, activeDirection)
          if (
            isWalkableGridPosition(maze, entry) &&
            isWalkableGridPosition(maze, nextPosition(entry, direction))
          ) {
            pendingTurn = {
              keyId,
              direction,
              approachDirection: activeDirection,
              start: { ...player },
              entry,
              phase: 'approach',
            }
          }
        } else {
          activeKeyId = keyId
          onMove(direction)
          startTimer()
        }
      }
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
  }, [enabled, onMove, getTurnContext, onPressedDirectionsChange])
}
