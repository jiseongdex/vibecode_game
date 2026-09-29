import styles from '../MazeBoard/MazeBoard.module.css'

export function PlayerSprite() {
  return (
    <span
      className={`${styles.sprite} ${styles.playerSprite}`}
      role="img"
      aria-label="탐험가"
      data-asset-slot="player"
    >
      🧙
    </span>
  )
}
