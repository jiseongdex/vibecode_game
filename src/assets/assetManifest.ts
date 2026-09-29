export const gameAssets = {
  player: {
    girl: '/assets/player-girl.png',
    boy: '/assets/player-boy.png',
  },
  exit: '/assets/exit.png',
  floor: '/assets/maze-floor.png',
  wall: '/assets/maze-wall.png',
} as const

export type PlayerAppearance = keyof typeof gameAssets.player

export const rescueAnimals = [
  { name: '토끼', image: '/assets/rescue-rabbit.png', fallback: '🐰' },
  { name: '여우', image: '/assets/rescue-fox.png', fallback: '🦊' },
  { name: '곰', image: '/assets/rescue-bear.png', fallback: '🐻' },
  { name: '흰 고양이', image: '/assets/rescue-cat.png', fallback: '🐱' },
  { name: '강아지', image: '/assets/rescue-dog.png', fallback: '🐶' },
] as const

export function getRescueAnimal(id: string) {
  const index = Number(id.match(/^rescue-(\d+)$/)?.[1]) - 1
  return rescueAnimals[index] ?? rescueAnimals[0]
}
