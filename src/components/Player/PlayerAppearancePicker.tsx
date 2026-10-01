import { gameAssets } from '../../assets/assetManifest'
import type { PlayerAppearance } from '../../assets/assetManifest'
import styles from './PlayerAppearancePicker.module.css'

interface Props {
  value: PlayerAppearance
  onChange: (appearance: PlayerAppearance) => void
}

export function PlayerAppearancePicker({ value, onChange }: Props) {
  return (
    <div className={styles.picker} role="group" aria-label="탐험가 캐릭터 선택">
      {(['girl', 'boy'] as const).map((appearance) => (
        <button
          key={appearance}
          type="button"
          aria-label={appearance === 'girl' ? '여자 탐험가' : '남자 탐험가'}
          aria-pressed={value === appearance}
          onClick={() => onChange(appearance)}
        >
          <img src={gameAssets.player[appearance]} alt="" aria-hidden="true" onError={(event) => { event.currentTarget.hidden = true }} />
          <span>{appearance === 'girl' ? '여자 탐험가' : '남자 탐험가'}</span>
        </button>
      ))}
    </div>
  )
}
