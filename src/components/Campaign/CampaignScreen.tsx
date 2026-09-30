import type { GameState } from '../../game/gameState'
import { createGameState } from '../../game/gameState'
import type { CampaignProgress } from '../../game/campaignProgress'
import { generateMaze } from '../../game/mazeGenerator'
import { getMazeSize, MAX_STAGE } from '../../game/stageConfig'
import { formatTime } from '../Hud/GameHud'
import styles from './CampaignScreen.module.css'

interface CampaignScreenProps {
  progress: CampaignProgress
  onStartSession: (session: GameState) => void
}

export function CampaignScreen({ progress, onStartSession }: CampaignScreenProps) {
  const completedCount = Object.keys(progress.stageRecords).length
  const campaignComplete = Boolean(progress.stageRecords[MAX_STAGE])

  const startStage = (stage: number) => {
    if (stage > progress.unlockedStage) return
    onStartSession(createGameState(stage, generateMaze(getMazeSize(stage))))
  }

  return (
    <section className={styles.campaign} aria-label="단계 선택">
      <h2>미로 구출 작전</h2>
      {campaignComplete ? (
        <p className={styles.complete} role="status">
          20단계 캠페인 완료! 모든 친구를 구출했습니다.
        </p>
      ) : (
        <p>친구를 구출하고 탈출구에 도착하면 다음 단계가 열립니다.</p>
      )}
      <p>완료 {completedCount}/20단계 · 해금 {progress.unlockedStage}/20단계</p>

      <div className={styles.grid}>
        {Array.from({ length: MAX_STAGE }, (_, index) => index + 1).map((stage) => {
          const record = progress.stageRecords[stage]
          const locked = stage > progress.unlockedStage
          return (
            <button
              key={stage}
              type="button"
              className={`${styles.stage} ${record ? styles.completed : ''}`}
              aria-label={`${stage}단계 ${locked ? '잠김' : record ? '완료, 재플레이 가능' : '도전 가능'}`}
              disabled={locked}
              onClick={() => startStage(stage)}
            >
              <strong>{stage}단계</strong>
              {locked ? (
                <span>잠김</span>
              ) : record ? (
                <span>최고 {formatTime(record.bestTimeSeconds)}</span>
              ) : (
                <span>시작하기</span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
