import type { Direction } from '../../game/types'
import styles from './DirectionControls.module.css'

interface DirectionControlsProps {
  disabled?: boolean
  onMove: (direction: Direction) => void
}

const directions: Array<{
  direction: Direction
  label: string
  symbol: string
}> = [
  { direction: 'up', label: '위로 이동', symbol: '↑' },
  { direction: 'left', label: '왼쪽으로 이동', symbol: '←' },
  { direction: 'down', label: '아래로 이동', symbol: '↓' },
  { direction: 'right', label: '오른쪽으로 이동', symbol: '→' },
]

export function DirectionControls({
  disabled = false,
  onMove,
}: DirectionControlsProps) {
  return (
    <div className={styles.controls} role="group" aria-label="이동 방향 버튼">
      {directions.map(({ direction, label, symbol }) => (
        <button
          key={direction}
          className={`${styles.button} ${styles[direction]}`}
          type="button"
          aria-label={label}
          disabled={disabled}
          onClick={() => onMove(direction)}
        >
          {symbol}
        </button>
      ))}
    </div>
  )
}
