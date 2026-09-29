import { fireEvent, renderHook } from '@testing-library/react'

import { usePageVisibilityPause } from './usePageVisibilityPause'

describe('usePageVisibilityPause', () => {
  it('pauses only when hidden or leaving and removes its listeners', () => {
    const onPause = vi.fn()
    const original = Object.getOwnPropertyDescriptor(document, 'visibilityState')
    let visibility = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    })

    try {
      const { rerender, unmount } = renderHook(
        ({ enabled }) => usePageVisibilityPause({ enabled, onPause }),
        { initialProps: { enabled: true } },
      )
      fireEvent(document, new Event('visibilitychange'))
      expect(onPause).not.toHaveBeenCalled()

      visibility = 'hidden'
      fireEvent(document, new Event('visibilitychange'))
      expect(onPause).toHaveBeenCalledTimes(1)
      rerender({ enabled: false })
      fireEvent(window, new Event('pagehide'))
      expect(onPause).toHaveBeenCalledTimes(1)
      unmount()
    } finally {
      if (original) Object.defineProperty(document, 'visibilityState', original)
      else Reflect.deleteProperty(document, 'visibilityState')
    }
  })
})
