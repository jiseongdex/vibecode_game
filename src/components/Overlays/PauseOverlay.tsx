import styles from './Overlays.module.css'

interface PauseOverlayProps {
  onResume: () => void
}

export function PauseOverlay({ onResume }: PauseOverlayProps) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div className={styles.panel}>
        <h2 id="pause-title">일시정지</h2>
        <p>남은 시간은 멈춰 있습니다.</p>
        <div className={styles.actions}>
          <button type="button" onClick={onResume}>이어하기</button>
        </div>
      </div>
    </div>
  )
}
