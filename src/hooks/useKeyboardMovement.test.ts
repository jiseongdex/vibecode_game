import { act, fireEvent, renderHook } from '@testing-library/react'

import { isWalkableGridPosition } from '../game/mazeGrid'
import type { Direction, Maze, Position } from '../game/types'
import { useKeyboardMovement } from './useKeyboardMovement'

const defaultContext = {
  player: { row: 1, col: 1 },
  maze: {
    size: 1,
    seed: 1,
    cells: [[{
      row: 0,
      col: 0,
      visited: true,
      walls: { top: true, right: true, bottom: true, left: true },
    }]],
  } satisfies Maze,
}

function nextPosition(position: Position, direction: Direction): Position {
  const offsets: Record<Direction, Position> = {
    up: { row: -1, col: 0 },
    right: { row: 0, col: 1 },
    down: { row: 1, col: 0 },
    left: { row: 0, col: -1 },
  }
  return {
    row: position.row + offsets[direction].row,
    col: position.col + offsets[direction].col,
  }
}

function corridorMaze(turnCell: 1 | 2): Maze {
  const size = turnCell + 1
  const cells: Maze['cells'] = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => ({
      row,
      col,
      visited: true,
      walls: { top: true, right: true, bottom: true, left: true },
    })),
  )
  for (let col = 0; col < turnCell; col += 1) {
    cells[0][col].walls.right = false
    cells[0][col + 1].walls.left = false
  }
  cells[0][turnCell].walls.bottom = false
  cells[1][turnCell].walls.top = false
  return { size, cells, seed: turnCell }
}

function movementHarness(maze: Maze, start: Position) {
  let player = start
  const onMove = vi.fn((direction: Direction) => {
    const next = nextPosition(player, direction)
    if (isWalkableGridPosition(maze, next)) player = next
  })
  const getTurnContext = () => ({ player, maze })
  const getPlayer = () => player
  return { onMove, getTurnContext, getPlayer }
}

describe('useKeyboardMovement', () => {
  it.each([
    ['ArrowUp', 'up'],
    ['ArrowRight', 'right'],
    ['ArrowDown', 'down'],
    ['ArrowLeft', 'left'],
    ['w', 'up'],
    ['d', 'right'],
    ['s', 'down'],
    ['a', 'left'],
  ] as const)('maps %s to %s', (key, direction) => {
    const onMove = vi.fn()
    const { unmount } = renderHook(() =>
      useKeyboardMovement({ enabled: true, onMove, getTurnContext: () => defaultContext }),
    )

    const event = new KeyboardEvent('keydown', { key, cancelable: true })
    window.dispatchEvent(event)

    expect(onMove).toHaveBeenCalledTimes(1)
    expect(onMove).toHaveBeenCalledWith(direction)
    expect(event.defaultPrevented).toBe(key.startsWith('Arrow'))
    unmount()
  })

  it('ignores unrelated keys, modified shortcuts, and text inputs', () => {
    const onMove = vi.fn()
    renderHook(() => useKeyboardMovement({ enabled: true, onMove, getTurnContext: () => defaultContext }))

    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.keyDown(window, { key: 'w', ctrlKey: true })
    const input = document.createElement('input')
    document.body.appendChild(input)
    fireEvent.keyDown(input, { key: 'w' })
    input.remove()

    expect(onMove).not.toHaveBeenCalled()
  })

  it('moves once for a tap and repeats a held key every 110ms without native duplicates', () => {
    vi.useFakeTimers()
    const onMove = vi.fn()
    const { unmount } = renderHook(() => useKeyboardMovement({ enabled: true, onMove, getTurnContext: () => defaultContext }))

    try {
      const keyDown = (repeat = false) => fireEvent.keyDown(window, {
        key: 'ArrowRight',
        code: 'ArrowRight',
        repeat,
      })
      const keyUp = () => fireEvent.keyUp(window, {
        key: 'ArrowRight',
        code: 'ArrowRight',
      })

      keyDown()
      expect(onMove).toHaveBeenCalledTimes(1)
      act(() => vi.advanceTimersByTime(50))
      keyUp()
      act(() => vi.advanceTimersByTime(300))
      expect(onMove).toHaveBeenCalledTimes(1)

      keyDown()
      expect(onMove).toHaveBeenCalledTimes(2)
      keyDown(true)
      keyDown()
      act(() => vi.advanceTimersByTime(109))
      expect(onMove).toHaveBeenCalledTimes(2)
      act(() => vi.advanceTimersByTime(1))
      expect(onMove).toHaveBeenCalledTimes(3)
      act(() => vi.advanceTimersByTime(110))
      expect(onMove).toHaveBeenCalledTimes(4)
      keyUp()
      keyDown(true)
      act(() => vi.advanceTimersByTime(300))
      expect(onMove).toHaveBeenCalledTimes(4)
    } finally {
      unmount()
      vi.useRealTimers()
    }
  })

  it('stops held-key movement on blur, disable, and unmount', () => {
    vi.useFakeTimers()
    const onMove = vi.fn()
    const { rerender, unmount } = renderHook(
      ({ enabled }) => useKeyboardMovement({ enabled, onMove, getTurnContext: () => defaultContext }),
      { initialProps: { enabled: true } },
    )

    try {
      fireEvent.keyDown(window, { key: 'W' })
      expect(onMove).toHaveBeenCalledTimes(1)
      fireEvent.blur(window)
      act(() => vi.advanceTimersByTime(330))
      expect(onMove).toHaveBeenCalledTimes(1)

      fireEvent.keyDown(window, { key: 'W' })
      expect(onMove).toHaveBeenCalledTimes(2)
      rerender({ enabled: false })
      act(() => vi.advanceTimersByTime(330))
      fireEvent.keyDown(window, { key: 'W' })
      expect(onMove).toHaveBeenCalledTimes(2)

      rerender({ enabled: true })
      unmount()
      fireEvent.keyDown(window, { key: 'W' })
      expect(onMove).toHaveBeenCalledTimes(2)
    } finally {
      unmount()
      vi.useRealTimers()
    }
  })

  it('reports distinct held directions and clears them on release, blur, and disable', () => {
    vi.useFakeTimers()
    const onMove = vi.fn()
    const onPressedDirectionsChange = vi.fn()
    const { rerender, unmount } = renderHook(
      ({ enabled }) => useKeyboardMovement({
        enabled,
        onMove,
        getTurnContext: () => defaultContext,
        onPressedDirectionsChange,
      }),
      { initialProps: { enabled: true } },
    )

    try {
      fireEvent.keyDown(window, { key: 'ArrowUp', code: 'ArrowUp' })
      expect(onPressedDirectionsChange).toHaveBeenLastCalledWith(['up'])
      fireEvent.keyDown(window, { key: 'w', code: 'KeyW' })
      expect(onPressedDirectionsChange).toHaveBeenLastCalledWith(['up'])
      fireEvent.keyDown(window, { key: 'ArrowLeft', code: 'ArrowLeft' })
      expect(onPressedDirectionsChange).toHaveBeenLastCalledWith(['up', 'left'])

      fireEvent.keyUp(window, { key: 'ArrowUp', code: 'ArrowUp' })
      expect(onPressedDirectionsChange).toHaveBeenLastCalledWith(['up', 'left'])
      fireEvent.keyUp(window, { key: 'w', code: 'KeyW' })
      expect(onPressedDirectionsChange).toHaveBeenLastCalledWith(['left'])
      fireEvent.keyUp(window, { key: 'ArrowLeft', code: 'ArrowLeft' })
      expect(onPressedDirectionsChange).toHaveBeenLastCalledWith([])

      fireEvent.keyDown(window, { key: 'ArrowRight', code: 'ArrowRight' })
      fireEvent.blur(window)
      expect(onPressedDirectionsChange).toHaveBeenLastCalledWith([])
      act(() => vi.advanceTimersByTime(220))
      expect(onMove).toHaveBeenCalledTimes(2)

      fireEvent.keyDown(window, { key: 'ArrowDown', code: 'ArrowDown' })
      rerender({ enabled: false })
      expect(onPressedDirectionsChange).toHaveBeenLastCalledWith([])
      act(() => vi.advanceTimersByTime(220))
      expect(onMove).toHaveBeenCalledTimes(3)
    } finally {
      unmount()
      vi.useRealTimers()
    }
  })

  it('continues one tile to a nearby opening before turning on the next 110ms tick', () => {
    vi.useFakeTimers()
    const movement = movementHarness(corridorMaze(1), { row: 1, col: 1 })
    const { unmount } = renderHook(() => useKeyboardMovement({
      enabled: true,
      onMove: movement.onMove,
      getTurnContext: movement.getTurnContext,
    }))

    try {
      fireEvent.keyDown(window, { key: 'ArrowRight', code: 'ArrowRight' })
      expect(movement.getPlayer()).toEqual({ row: 1, col: 2 })
      fireEvent.keyDown(window, { key: 'ArrowDown', code: 'ArrowDown' })
      expect(movement.onMove).toHaveBeenCalledTimes(1)

      act(() => vi.advanceTimersByTime(110))
      expect(movement.getPlayer()).toEqual({ row: 1, col: 3 })
      expect(movement.onMove).toHaveBeenCalledTimes(2)
      expect(movement.onMove).toHaveBeenLastCalledWith('right')

      act(() => vi.advanceTimersByTime(110))
      expect(movement.getPlayer()).toEqual({ row: 2, col: 3 })
      expect(movement.onMove).toHaveBeenCalledTimes(3)
      expect(movement.onMove).toHaveBeenLastCalledWith('down')

      act(() => vi.advanceTimersByTime(110))
      expect(movement.getPlayer()).toEqual({ row: 3, col: 3 })
      expect(movement.onMove).toHaveBeenCalledTimes(4)
      expect(movement.onMove).toHaveBeenLastCalledWith('down')
    } finally {
      unmount()
      vi.useRealTimers()
    }
  })

  it('turns immediately at an open tile and does not repeat before another 110ms', () => {
    vi.useFakeTimers()
    const movement = movementHarness(corridorMaze(1), { row: 1, col: 2 })
    const { unmount } = renderHook(() => useKeyboardMovement({
      enabled: true,
      onMove: movement.onMove,
      getTurnContext: movement.getTurnContext,
    }))

    try {
      fireEvent.keyDown(window, { key: 'ArrowRight', code: 'ArrowRight' })
      expect(movement.getPlayer()).toEqual({ row: 1, col: 3 })
      fireEvent.keyDown(window, { key: 'ArrowDown', code: 'ArrowDown' })
      expect(movement.getPlayer()).toEqual({ row: 2, col: 3 })
      expect(movement.onMove).toHaveBeenCalledTimes(2)

      act(() => vi.advanceTimersByTime(109))
      expect(movement.onMove).toHaveBeenCalledTimes(2)
      act(() => vi.advanceTimersByTime(1))
      expect(movement.getPlayer()).toEqual({ row: 3, col: 3 })
      expect(movement.onMove).toHaveBeenLastCalledWith('down')

      fireEvent.keyDown(window, { key: 'ArrowUp', code: 'ArrowUp' })
      expect(movement.getPlayer()).toEqual({ row: 2, col: 3 })
      expect(movement.onMove).toHaveBeenLastCalledWith('up')
    } finally {
      unmount()
      vi.useRealTimers()
    }
  })

  it('does not queue a turn at an opening two tiles away', () => {
    vi.useFakeTimers()
    const movement = movementHarness(corridorMaze(2), { row: 1, col: 2 })
    const { unmount } = renderHook(() => useKeyboardMovement({
      enabled: true,
      onMove: movement.onMove,
      getTurnContext: movement.getTurnContext,
    }))

    try {
      fireEvent.keyDown(window, { key: 'ArrowRight', code: 'ArrowRight' })
      expect(movement.getPlayer()).toEqual({ row: 1, col: 3 })
      fireEvent.keyDown(window, { key: 'ArrowDown', code: 'ArrowDown' })
      expect(movement.onMove).toHaveBeenCalledTimes(1)

      act(() => vi.advanceTimersByTime(220))
      expect(movement.getPlayer()).toEqual({ row: 1, col: 5 })
      expect(movement.onMove).toHaveBeenCalledTimes(3)
      expect(movement.onMove).toHaveBeenLastCalledWith('right')

      fireEvent.keyUp(window, { key: 'ArrowRight', code: 'ArrowRight' })
      act(() => vi.advanceTimersByTime(110))
      expect(movement.getPlayer()).toEqual({ row: 2, col: 5 })
      expect(movement.onMove).toHaveBeenLastCalledWith('down')
    } finally {
      unmount()
      vi.useRealTimers()
    }
  })

  it('cancels a queued turn on key release, blur, and disable', () => {
    vi.useFakeTimers()
    const movement = movementHarness(corridorMaze(1), { row: 1, col: 1 })
    const { rerender, unmount } = renderHook(
      ({ enabled }) => useKeyboardMovement({
        enabled,
        onMove: movement.onMove,
        getTurnContext: movement.getTurnContext,
      }),
      { initialProps: { enabled: true } },
    )

    try {
      fireEvent.keyDown(window, { key: 'ArrowRight', code: 'ArrowRight' })
      fireEvent.keyDown(window, { key: 'ArrowDown', code: 'ArrowDown' })
      fireEvent.keyUp(window, { key: 'ArrowDown', code: 'ArrowDown' })
      act(() => vi.advanceTimersByTime(220))
      expect(movement.getPlayer()).toEqual({ row: 1, col: 3 })
      expect(movement.onMove).not.toHaveBeenCalledWith('down')

      fireEvent.blur(window)
      const callsAfterBlur = movement.onMove.mock.calls.length
      act(() => vi.advanceTimersByTime(220))
      expect(movement.onMove).toHaveBeenCalledTimes(callsAfterBlur)

      fireEvent.keyDown(window, { key: 'ArrowDown', code: 'ArrowDown' })
      expect(movement.getPlayer()).toEqual({ row: 2, col: 3 })
      rerender({ enabled: false })
      const callsAfterDisable = movement.onMove.mock.calls.length
      act(() => vi.advanceTimersByTime(220))
      expect(movement.onMove).toHaveBeenCalledTimes(callsAfterDisable)
    } finally {
      unmount()
      vi.useRealTimers()
    }
  })

  it('drops the approach when its held direction is released', () => {
    vi.useFakeTimers()
    const movement = movementHarness(corridorMaze(1), { row: 1, col: 1 })
    const { unmount } = renderHook(() => useKeyboardMovement({
      enabled: true,
      onMove: movement.onMove,
      getTurnContext: movement.getTurnContext,
    }))

    try {
      fireEvent.keyDown(window, { key: 'ArrowRight', code: 'ArrowRight' })
      fireEvent.keyDown(window, { key: 'ArrowDown', code: 'ArrowDown' })
      fireEvent.keyUp(window, { key: 'ArrowRight', code: 'ArrowRight' })
      act(() => vi.advanceTimersByTime(220))
      expect(movement.getPlayer()).toEqual({ row: 1, col: 2 })
      expect(movement.onMove.mock.calls.map(([direction]) => direction)).toEqual([
        'right', 'down', 'down',
      ])
    } finally {
      unmount()
      vi.useRealTimers()
    }
  })

  it('does not restore a pending turn after movement is disabled', () => {
    vi.useFakeTimers()
    const movement = movementHarness(corridorMaze(1), { row: 1, col: 1 })
    const { rerender, unmount } = renderHook(
      ({ enabled }) => useKeyboardMovement({
        enabled,
        onMove: movement.onMove,
        getTurnContext: movement.getTurnContext,
      }),
      { initialProps: { enabled: true } },
    )

    try {
      fireEvent.keyDown(window, { key: 'ArrowRight', code: 'ArrowRight' })
      fireEvent.keyDown(window, { key: 'ArrowDown', code: 'ArrowDown' })
      rerender({ enabled: false })
      act(() => vi.advanceTimersByTime(220))
      expect(movement.getPlayer()).toEqual({ row: 1, col: 2 })
      expect(movement.onMove).toHaveBeenCalledTimes(1)

      rerender({ enabled: true })
      act(() => vi.advanceTimersByTime(220))
      expect(movement.onMove).toHaveBeenCalledTimes(1)
    } finally {
      unmount()
      vi.useRealTimers()
    }
  })

  it('keeps one repeat timer for two physical keys in the same direction', () => {
    vi.useFakeTimers()
    const movement = movementHarness(corridorMaze(1), { row: 1, col: 1 })
    const onPressedDirectionsChange = vi.fn()
    const { unmount } = renderHook(() => useKeyboardMovement({
      enabled: true,
      onMove: movement.onMove,
      getTurnContext: movement.getTurnContext,
      onPressedDirectionsChange,
    }))

    try {
      fireEvent.keyDown(window, { key: 'ArrowRight', code: 'ArrowRight' })
      fireEvent.keyDown(window, { key: 'd', code: 'KeyD' })
      expect(movement.onMove).toHaveBeenCalledTimes(1)
      expect(onPressedDirectionsChange).toHaveBeenLastCalledWith(['right'])

      act(() => vi.advanceTimersByTime(110))
      expect(movement.getPlayer()).toEqual({ row: 1, col: 3 })
      expect(movement.onMove).toHaveBeenCalledTimes(2)
      fireEvent.keyUp(window, { key: 'ArrowRight', code: 'ArrowRight' })
      act(() => vi.advanceTimersByTime(110))
      expect(movement.onMove).toHaveBeenCalledTimes(3)
      expect(movement.onMove).toHaveBeenLastCalledWith('right')
      expect(onPressedDirectionsChange).toHaveBeenLastCalledWith(['right'])
    } finally {
      unmount()
      vi.useRealTimers()
    }
  })
})
