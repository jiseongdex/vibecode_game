import { useState, type ReactElement } from 'react'

import type { AuthType } from '../../api/contracts'
import type { PlayerAppearance } from '../../assets/assetManifest'
import type { CampaignProgress } from '../../game/campaignProgress'
import { LeaderboardPanel } from '../Leaderboard/LeaderboardPanel'
import { CampaignScreen } from './CampaignScreen'
import styles from './CampaignWorkspace.module.css'

interface CampaignWorkspaceProps {
  authType: AuthType
  currentUserId: string
  currentDisplayName: string
  progress: CampaignProgress
  appearance: PlayerAppearance
  onAppearanceChange: (appearance: PlayerAppearance) => void
  onStartStage: (stage: number) => Promise<void>
  onUnauthorized: () => Promise<void>
}

type CampaignTab = 'stages' | 'leaderboard'

export function CampaignWorkspace({
  authType,
  currentUserId,
  currentDisplayName,
  progress,
  appearance,
  onAppearanceChange,
  onStartStage,
  onUnauthorized,
}: CampaignWorkspaceProps): ReactElement {
  const [activeTab, setActiveTab] = useState<CampaignTab>('stages')

  return (
    <div className={styles.workspace} data-testid="campaign-workspace" data-active-tab={activeTab}>
      <div className={styles.tabs} role="group" aria-label="화면 선택">
        <button
          type="button"
          className={styles.tab}
          aria-controls="campaign-stages-panel"
          aria-pressed={activeTab === 'stages'}
          onClick={() => setActiveTab('stages')}
        >
          단계 선택
        </button>
        <button
          type="button"
          className={styles.tab}
          aria-controls="campaign-leaderboard-panel"
          aria-pressed={activeTab === 'leaderboard'}
          onClick={() => setActiveTab('leaderboard')}
        >
          랭킹
        </button>
      </div>
      <div id="campaign-leaderboard-panel" className={`${styles.pane} ${styles.leaderboardPane}`} data-testid="leaderboard-pane">
        <LeaderboardPanel
          authType={authType}
          currentUserId={currentUserId}
          currentDisplayName={currentDisplayName}
          onUnauthorized={onUnauthorized}
        />
      </div>
      <div id="campaign-stages-panel" className={`${styles.pane} ${styles.stagesPane}`} data-testid="stages-pane">
        <CampaignScreen
          progress={progress}
          appearance={appearance}
          onAppearanceChange={onAppearanceChange}
          onStartStage={onStartStage}
        />
      </div>
    </div>
  )
}
