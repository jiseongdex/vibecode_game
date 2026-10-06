import type { ReactElement } from 'react'

import type { AuthType } from '../../api/contracts'
import type { PlayerAppearance } from '../../assets/assetManifest'
import type { CampaignProgress } from '../../game/campaignProgress'
import { LeaderboardPanel } from '../Leaderboard/LeaderboardPanel'
import { CampaignScreen } from './CampaignScreen'
import styles from './CampaignWorkspace.module.css'

interface CampaignWorkspaceProps {
  authType: AuthType
  currentUserId: string
  progress: CampaignProgress
  appearance: PlayerAppearance
  onAppearanceChange: (appearance: PlayerAppearance) => void
  onStartStage: (stage: number) => Promise<void>
  onUnauthorized: () => Promise<void>
}

export function CampaignWorkspace({
  authType,
  currentUserId,
  progress,
  appearance,
  onAppearanceChange,
  onStartStage,
  onUnauthorized,
}: CampaignWorkspaceProps): ReactElement {
  return (
    <div className={styles.workspace} data-testid="campaign-workspace">
      <div className={`${styles.pane} ${styles.leaderboardPane}`} data-testid="leaderboard-pane">
        <LeaderboardPanel
          authType={authType}
          currentUserId={currentUserId}
          onUnauthorized={onUnauthorized}
        />
      </div>
      <div className={`${styles.pane} ${styles.stagesPane}`} data-testid="stages-pane">
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
