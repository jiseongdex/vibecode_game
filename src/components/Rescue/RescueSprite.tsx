import styles from '../MazeBoard/MazeBoard.module.css'

interface RescueSpriteProps {
  following?: boolean
  order?: number
}

export function RescueSprite({ following = false, order }: RescueSpriteProps) {
  return (
    <span
      className={`${styles.sprite} ${following ? styles.followerSprite : styles.rescueSprite}`}
      role="img"
      aria-label={following ? `구출한 동료 ${order}` : '구출 대상'}
      data-asset-slot={following ? 'follower' : 'rescue-target'}
      data-follower-order={following ? order : undefined}
    >
      {following ? '🧝' : '🧚'}
    </span>
  )
}
