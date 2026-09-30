export const gameAssets = {
  player: {
    girl: '/assets/players/player-girl.png',
    boy: '/assets/players/player-boy.png',
  },
  exit: '/assets/maps/exit.png',
  floor: '/assets/maps/maze-floor.png',
  wall: '/assets/maps/maze-wall.png',
} as const

export type PlayerAppearance = keyof typeof gameAssets.player

export const rescueAnimals = [
  { name: '토끼', image: '/assets/animals/rescue-rabbit.png', fallback: '🐰' },
  { name: '여우', image: '/assets/animals/rescue-fox.png', fallback: '🦊' },
  { name: '곰', image: '/assets/animals/rescue-bear.png', fallback: '🐻' },
  { name: '흰 고양이', image: '/assets/animals/rescue-cat.png', fallback: '🐱' },
  { name: '강아지', image: '/assets/animals/rescue-dog.png', fallback: '🐶' },
] as const

export function getRescueAnimal(id: string) {
  const index = Number(id.match(/^rescue-(\d+)$/)?.[1]) - 1
  return rescueAnimals[index] ?? rescueAnimals[0]
}
