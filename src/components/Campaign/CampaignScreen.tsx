import { useRef, useState, type CSSProperties } from 'react'

import type { PlayerAppearance } from '../../assets/assetManifest'
import type { CampaignProgress } from '../../game/campaignProgress'
import { MAX_STAGE } from '../../game/stageConfig'
import { StickerIcon } from '../Decorations/StickerIcon'
import { formatTime } from '../Hud/GameHud'
import { PlayerAppearancePicker } from '../Player/PlayerAppearancePicker'
import styles from './CampaignScreen.module.css'

interface CampaignScreenProps {
  progress: CampaignProgress
  appearance: PlayerAppearance
  onAppearanceChange: (appearance: PlayerAppearance) => void
  onStartStage: (stage: number) => Promise<void>
}

type RouteDirection = 'left' | 'right' | 'down' | 'end'

function routePosition(stage: number, columns: 5 | 2): {
  row: number
  col: number
  next: RouteDirection
} {
  const row = Math.floor((stage - 1) / columns) + 1
  const slot = (stage - 1) % columns
  const col = (row % 2 === 1 ? slot : columns - 1 - slot) + 1
  const next = stage === MAX_STAGE
    ? 'end'
    : slot === columns - 1
      ? 'down'
      : row % 2 === 1 ? 'right' : 'left'

  return { row, col, next }
}

export function CampaignScreen({
  progress,
  appearance,
  onAppearanceChange,
  onStartStage,
}: CampaignScreenProps) {
  const [startingStage, setStartingStage] = useState<number | null>(null)
  const starting = useRef(false)
  const campaignComplete = Boolean(progress.stageRecords[MAX_STAGE])

  const startStage = async (stage: number) => {
    if (stage > progress.unlockedStage || starting.current) return
    starting.current = true
    setStartingStage(stage)
    try {
      await onStartStage(stage)
    } catch {
      // The parent keeps the stage selection visible and displays the request error.
    } finally {
      starting.current = false
      setStartingStage(null)
    }
  }

  return (
    <section className={styles.campaign} aria-label="단계 선택">
      <div className={styles.titleRow}>
        <StickerIcon kind="leaf" />
        <h2>단계 선택</h2>
        <StickerIcon kind="mushroom" />
      </div>
      {campaignComplete ? (
        <p className={styles.complete} role="status">
          20단계 캠페인 완료! 모든 친구를 구출했습니다.
        </p>
      ) : (
        <p className={styles.intro}>동물 친구를 구출하고 탈출구를 찾으면 다음 단계가 열려요.</p>
      )}
      <p className={styles.pickerLabel}>함께 떠날 탐험가를 골라요</p>
      <PlayerAppearancePicker value={appearance} onChange={onAppearanceChange} />

      <div className={styles.grid} role="group" aria-label="구출 경로">
        {Array.from({ length: MAX_STAGE }, (_, index) => index + 1).map((stage) => {
          const record = progress.stageRecords[stage]
          const locked = stage > progress.unlockedStage
          const desktop = routePosition(stage, 5)
          const mobile = routePosition(stage, 2)
          const positionStyle = {
            '--desktop-row': desktop.row,
            '--desktop-col': desktop.col,
            '--mobile-row': mobile.row,
            '--mobile-col': mobile.col,
          } as CSSProperties
          return (
            <div
              key={stage}
              className={styles.routeNode}
              style={positionStyle}
              data-desktop-next={desktop.next}
              data-mobile-next={mobile.next}
            >
              <button
                type="button"
                className={`${styles.stage} ${record ? styles.completed : ''}`}
                aria-label={`${stage}단계 ${locked ? '잠김' : record ? '완료, 재플레이 가능' : '도전 가능'}`}
                disabled={locked || startingStage !== null}
                onClick={() => { void startStage(stage) }}
              >
                <StickerIcon kind={stage % 3 === 0 ? 'leaf' : stage % 3 === 1 ? 'mushroom' : 'footprint'} className={styles.stageIcon} />
                <strong>{stage}단계</strong>
                {locked ? (
                  <span>잠김</span>
                ) : record ? (
                  <span>최고 {formatTime(record.bestTimeSeconds)}</span>
                ) : (
                  <span>{startingStage === stage ? '준비 중…' : '시작하기'}</span>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
