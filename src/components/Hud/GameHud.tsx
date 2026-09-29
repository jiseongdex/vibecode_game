import styles from './GameHud.module.css'

export interface GameHudProps {
  stage: number
  remainingSeconds: number
  rescuedCount: number
  rescueCount: number
  moveCount: number
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
  moveCount,
  onPause,
  canPause = true,
}: GameHudProps) {
  return (
    <header className={styles.hud}>
      <div className={styles.stats} aria-live="polite">
        <span>{stage}단계</span>
        <span
          className={remainingSeconds <= 10 ? styles.urgent : undefined}
          data-urgent={remainingSeconds <= 10}
        >
          남은 시간: {formatTime(remainingSeconds)}
        </span>
        <span>
          구출: {rescuedCount}/{rescueCount}
        </span>
        <span>이동: {moveCount}회</span>
      </div>
      <button type="button" onClick={onPause} disabled={!canPause}>
        일시정지
      </button>
    </header>
  )
}
