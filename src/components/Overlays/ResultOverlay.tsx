import { formatTime } from '../Hud/GameHud'
import styles from './Overlays.module.css'

interface ResultOverlayProps {
  status: 'won' | 'lost'
  stage: number
  clearTimeSeconds: number
  moveCount: number
  onRetrySameMaze: () => void
  onRestartNewMaze: () => void
  onNextStage?: () => void
  onCampaign?: () => void
}

export function ResultOverlay({
  status,
  stage,
  clearTimeSeconds,
  moveCount,
  onRetrySameMaze,
  onRestartNewMaze,
  onNextStage,
  onCampaign,
}: ResultOverlayProps) {
  const won = status === 'won'

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div className={styles.panel}>
        <h2 id="result-title">
          {won ? (stage === 20 ? '20단계 완료!' : `${stage}단계 클리어!`) : '시간 초과!'}
        </h2>
        {won ? (
          <p>클리어 시간 {formatTime(clearTimeSeconds)} · 이동 {moveCount}회</p>
        ) : (
          <p>친구를 모두 구출하고 탈출구를 다시 찾아보세요.</p>
        )}
        <div className={styles.actions}>
          {!won && (
            <button type="button" onClick={onRetrySameMaze}>같은 미로 재도전</button>
          )}
          <button type="button" onClick={onRestartNewMaze}>
            {won ? '새 미로로 재플레이' : '새 미로로 재시작'}
          </button>
          {won && onNextStage && stage < 20 && (
            <button type="button" onClick={onNextStage}>다음 단계</button>
          )}
          {won && onCampaign && (
            <button type="button" onClick={onCampaign}>단계 선택</button>
          )}
        </div>
      </div>
    </div>
  )
}
