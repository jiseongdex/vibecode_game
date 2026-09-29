import { getRescueAnimal } from '../../assets/assetManifest'
import styles from '../MazeBoard/MazeBoard.module.css'

interface RescueSpriteProps {
  animalId: string
  following?: boolean
  order?: number
}

export function RescueSprite({ animalId, following = false, order }: RescueSpriteProps) {
  const animal = getRescueAnimal(animalId)
  return (
    <span
      className={`${styles.sprite} ${following ? styles.followerSprite : styles.rescueSprite}`}
      role="img"
      aria-label={following ? `구출한 동료 ${order}` : '구출 대상'}
      data-asset-slot={following ? 'follower' : 'rescue-target'}
      data-follower-order={following ? order : undefined}
      data-animal={animal.name}
      title={animal.name}
    >
      <span aria-hidden="true">{animal.fallback}</span>
      <img src={animal.image} alt="" aria-hidden="true" onError={(event) => { event.currentTarget.hidden = true }} />
    </span>
  )
}
