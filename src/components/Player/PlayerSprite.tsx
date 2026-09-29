import { gameAssets } from '../../assets/assetManifest'
import type { PlayerAppearance } from '../../assets/assetManifest'
import styles from '../MazeBoard/MazeBoard.module.css'

export function PlayerSprite({ appearance = 'girl' }: { appearance?: PlayerAppearance }) {
  return (
    <span
      className={`${styles.sprite} ${styles.playerSprite}`}
      role="img"
      aria-label="탐험가"
      data-asset-slot="player"
    >
      <span aria-hidden="true">{appearance === 'girl' ? '🧙‍♀️' : '🧙‍♂️'}</span>
      <img key={appearance} src={gameAssets.player[appearance]} alt="" aria-hidden="true" onError={(event) => { event.currentTarget.hidden = true }} />
    </span>
  )
}
