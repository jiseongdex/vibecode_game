export const gameAssets = {
  player: {
    girl: '/assets/players/player-girl-front.png',
    boy: '/assets/players/player-boy-front.png',
  },
  exit: '/assets/maps/exit.png',
  floor: '/assets/maps/maze-floor.png',
  wall: '/assets/maps/maze-wall.png',
} as const

export type PlayerAppearance = keyof typeof gameAssets.player

export const rescueAnimals = [
  { name: '토끼', image: '/assets/animals/rescue-rabbit-front.png', fallback: '🐰' },
  { name: '여우', image: '/assets/animals/rescue-fox-front.png', fallback: '🦊' },
  { name: '곰', image: '/assets/animals/rescue-bear-front.png', fallback: '🐻' },
  { name: '흰 고양이', image: '/assets/animals/rescue-cat-front.png', fallback: '🐱' },
  { name: '강아지', image: '/assets/animals/rescue-dog-front.png', fallback: '🐶' },
] as const

export function getRescueAnimal(id: string) {
  const index = Number(id.match(/^rescue-(\d+)$/)?.[1]) - 1
  return rescueAnimals[index] ?? rescueAnimals[0]
}
