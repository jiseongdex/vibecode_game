import { StickerIcon } from '../Decorations/StickerIcon'
import styles from './Overlays.module.css'

interface PauseOverlayProps {
  onResume: () => void
  onDiscard?: () => void
}

export function PauseOverlay({ onResume, onDiscard }: PauseOverlayProps) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div className={styles.panel}>
        <StickerIcon kind="mushroom" className={styles.decoration} />
        <h2 id="pause-title">일시정지</h2>
        <p>잠깐 쉬어 가요. 남은 시간은 멈춰 있어요.</p>
        <div className={styles.actions}>
          <button type="button" onClick={onResume}>이어하기</button>
          {onDiscard && (
            <button type="button" onClick={onDiscard}>게임 버리고 단계 선택</button>
          )}
        </div>
      </div>
    </div>
  )
}
