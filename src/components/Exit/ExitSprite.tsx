import styles from '../MazeBoard/MazeBoard.module.css'

interface ExitSpriteProps {
  unlocked: boolean
}

export function ExitSprite({ unlocked }: ExitSpriteProps) {
  return (
    <span
      className={`${styles.sprite} ${styles.exitSprite} ${unlocked ? styles.exitUnlocked : ''}`}
      role="img"
      aria-label={unlocked ? '열린 탈출구' : '잠긴 탈출구'}
      data-asset-slot="exit"
    >
      🚪
    </span>
  )
}
