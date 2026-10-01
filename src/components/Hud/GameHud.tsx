import { StickerIcon } from '../Decorations/StickerIcon'
import styles from './GameHud.module.css'

export interface GameHudProps {
  stage: number
  remainingSeconds: number
  rescuedCount: number
  rescueCount: number
  onPause: () => void
  canPause?: boolean
}

export function formatTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function GameHud({
  stage,
  remainingSeconds,
  rescuedCount,
  rescueCount,
  onPause,
  canPause = true,
}: GameHudProps) {
  return (
    <header className={styles.hud}>
      <div className={styles.stats}>
        <span className={styles.badge}><StickerIcon kind="leaf" />{stage}단계</span>
        <span
          className={`${styles.badge} ${remainingSeconds <= 10 ? styles.urgent : ''}`}
          data-urgent={remainingSeconds <= 10}
          role="timer"
          aria-live="polite"
          aria-atomic="true"
        >
          남은 시간: {formatTime(remainingSeconds)}
        </span>
        {remainingSeconds <= 10 && <span className={styles.warning} role="status">⚠️ 시간 부족</span>}
        <span className={styles.badge} role="status" aria-live="polite" aria-atomic="true">
          <StickerIcon kind="footprint" />구출: {rescuedCount}/{rescueCount}
        </span>
      </div>
      <button type="button" onClick={onPause} disabled={!canPause}>
        일시정지
      </button>
    </header>
  )
}
