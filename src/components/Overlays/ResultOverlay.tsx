import { formatTime } from '../Hud/GameHud'
import { StickerIcon } from '../Decorations/StickerIcon'
import styles from './Overlays.module.css'

interface ResultOverlayProps {
  status: 'won' | 'lost'
  stage: number
  clearTimeSeconds: number
  recordStatus: 'saving' | 'saved' | 'error'
  resultBusy: boolean
  resultError: string | null
  onRetryRecord: () => void
  onRetrySameMaze: () => void
  onRestartNewMaze: () => void
  onNextStage?: () => void
  onCampaign?: () => void
}

export function ResultOverlay({
  status,
  stage,
  clearTimeSeconds,
  recordStatus,
  resultBusy,
  resultError,
  onRetryRecord,
  onRetrySameMaze,
  onRestartNewMaze,
  onNextStage,
  onCampaign,
}: ResultOverlayProps) {
  const won = status === 'won'

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div className={styles.panel}>
        <StickerIcon kind={won ? 'leaf' : 'footprint'} className={styles.decoration} />
        <h2 id="result-title">
          {won ? (stage === 20 ? '20단계 완료!' : `${stage}단계 클리어!`) : '시간 초과!'}
        </h2>
        {won ? (
          <>
            <p>친구들이 무사히 돌아왔어요!</p>
            <p>클리어 시간 {formatTime(clearTimeSeconds)}</p>
          </>
        ) : (
          <p>친구들을 모두 구출하고 탈출구까지 다시 가봐요.</p>
        )}
        {won && recordStatus === 'saving' && (
          <p className={styles.resultStatus} role="status">기록 저장 중…</p>
        )}
        {won && recordStatus === 'saved' && (
          <p className={styles.resultStatus} role="status">기록이 저장됐어요.</p>
        )}
        {won && recordStatus === 'error' && (
          <p className={styles.resultError} role="alert">기록을 확인하지 못했어요. 다시 보내주세요.</p>
        )}
        {resultBusy && <p className={styles.resultStatus} role="status">새 도전 준비 중…</p>}
        {resultError && <p className={styles.resultError} role="alert">{resultError}</p>}
        <div className={styles.actions}>
          {won && recordStatus === 'error' && (
            <button type="button" onClick={onRetryRecord}>기록 다시 보내기</button>
          )}
          {!won && (
            <button type="button" disabled={resultBusy} onClick={onRetrySameMaze}>같은 미로 재도전</button>
          )}
          <button type="button" disabled={resultBusy || (won && recordStatus !== 'saved')}
            onClick={onRestartNewMaze}>
            {won ? '새 미로로 재플레이' : '새 미로로 재시작'}
          </button>
          {won && onNextStage && stage < 20 && (
            <button type="button" disabled={resultBusy || recordStatus !== 'saved'} onClick={onNextStage}>다음 단계</button>
          )}
          {onCampaign && (
            <button type="button" onClick={onCampaign}>단계 선택</button>
          )}
        </div>
      </div>
    </div>
  )
}
