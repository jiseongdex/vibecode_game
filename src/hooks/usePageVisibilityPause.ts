import { useEffect } from 'react'

interface PageVisibilityPauseOptions {
  enabled: boolean
  onPause: () => void
}

export function usePageVisibilityPause({
  enabled,
  onPause,
}: PageVisibilityPauseOptions): void {
  useEffect(() => {
    if (!enabled) return

    const pauseIfHidden = () => {
      if (document.visibilityState === 'hidden') onPause()
    }
    const pauseOnLeave = () => onPause()

    document.addEventListener('visibilitychange', pauseIfHidden)
    window.addEventListener('pagehide', pauseOnLeave)
    return () => {
      document.removeEventListener('visibilitychange', pauseIfHidden)
      window.removeEventListener('pagehide', pauseOnLeave)
    }
  }, [enabled, onPause])
}
