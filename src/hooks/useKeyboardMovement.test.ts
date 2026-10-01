import { act, fireEvent, renderHook } from '@testing-library/react'

import { useKeyboardMovement } from './useKeyboardMovement'

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
      useKeyboardMovement({ enabled: true, onMove }),
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
    renderHook(() => useKeyboardMovement({ enabled: true, onMove }))

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
    const { unmount } = renderHook(() => useKeyboardMovement({ enabled: true, onMove }))

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
      ({ enabled }) => useKeyboardMovement({ enabled, onMove }),
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
})
