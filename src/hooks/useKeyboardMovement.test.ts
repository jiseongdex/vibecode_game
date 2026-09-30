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

  it('moves only once while a movement key is held', () => {
    const onMove = vi.fn()
    renderHook(() => useKeyboardMovement({ enabled: true, onMove }))

    fireEvent.keyDown(window, { key: 'ArrowRight', repeat: false })
    fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true })
    fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true })

    expect(onMove).toHaveBeenCalledTimes(1)
    expect(onMove).toHaveBeenCalledWith('right')
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
