import { fireEvent, renderHook } from '@testing-library/react'

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

  it('moves once for a tap and rate-limits held-key repeats to the walk cadence', () => {
    const onMove = vi.fn()
    renderHook(() => useKeyboardMovement({ enabled: true, onMove }))

    const keyDown = (timeStamp: number, repeat: boolean) => {
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        code: 'ArrowRight',
        repeat,
        cancelable: true,
      })
      Object.defineProperty(event, 'timeStamp', { value: timeStamp })
      window.dispatchEvent(event)
    }

    keyDown(0, false)
    keyDown(499, true)
    keyDown(500, true)
    keyDown(659, true)
    keyDown(660, true)

    expect(onMove).toHaveBeenCalledTimes(3)
    expect(onMove).toHaveBeenNthCalledWith(1, 'right')
    expect(onMove).toHaveBeenNthCalledWith(2, 'right')
    expect(onMove).toHaveBeenNthCalledWith(3, 'right')

    fireEvent.keyUp(window, { key: 'ArrowRight', code: 'ArrowRight' })
    keyDown(1000, true)
    expect(onMove).toHaveBeenCalledTimes(3)
  })

  it('detaches its listener when disabled or unmounted', () => {
    const onMove = vi.fn()
    const { rerender, unmount } = renderHook(
      ({ enabled }) => useKeyboardMovement({ enabled, onMove }),
      { initialProps: { enabled: true } },
    )

    fireEvent.keyDown(window, { key: 'W' })
    expect(onMove).toHaveBeenCalledTimes(1)
    rerender({ enabled: false })
    fireEvent.keyDown(window, { key: 'W' })
    expect(onMove).toHaveBeenCalledTimes(1)

    rerender({ enabled: true })
    unmount()
    fireEvent.keyDown(window, { key: 'W' })
    expect(onMove).toHaveBeenCalledTimes(1)
  })
})
