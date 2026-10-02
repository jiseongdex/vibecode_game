import type { Direction } from '../game/types'
import type { MazeThemeId } from './mazeTheme'

export const gameAssets = {
  player: {
    girl: '/assets/players/player-girl-front.png',
    boy: '/assets/players/player-boy-front.png',
  },
  exit: '/assets/maps/exit.png',
} as const

export type PlayerAppearance = keyof typeof gameAssets.player

function playerDirections(appearance: PlayerAppearance): Record<Direction, string> {
  const base = `/assets/players/player-${appearance}`
  return {
    up: `${base}-back.png`,
    right: `${base}-right.png`,
    down: `${base}-front.png`,
    left: `${base}-left.png`,
  }
}

function playerWalkDirections(appearance: PlayerAppearance): Record<Direction, readonly [string, string]> {
  const base = `/assets/players/player-${appearance}`
  const frames = (direction: string): readonly [string, string] => [
    `${base}-${direction}-walk-a.png`,
    `${base}-${direction}-walk-b.png`,
  ]
  return {
    up: frames('back'),
    right: frames('right'),
    down: frames('front'),
    left: frames('left'),
  }
}

function animalDirections(animal: string): Record<Direction, string> {
  const base = `/assets/animals/rescue-${animal}`
  return {
    up: `${base}-back.png`,
    right: `${base}-right.png`,
    down: `${base}-front.png`,
    left: `${base}-left.png`,
  }
}

export const playerSprites: Record<PlayerAppearance, Record<Direction, string>> = {
  girl: playerDirections('girl'),
  boy: playerDirections('boy'),
}

export const playerWalkSprites: Record<PlayerAppearance, Record<Direction, readonly [string, string]>> = {
  girl: playerWalkDirections('girl'),
  boy: playerWalkDirections('boy'),
}

export const rescueAnimals = [
  { name: '토끼', image: '/assets/animals/rescue-rabbit-front.png', fallback: '🐰', sprites: animalDirections('rabbit') },
  { name: '여우', image: '/assets/animals/rescue-fox-front.png', fallback: '🦊', sprites: animalDirections('fox') },
  { name: '곰', image: '/assets/animals/rescue-bear-front.png', fallback: '🐻', sprites: animalDirections('bear') },
  { name: '흰 고양이', image: '/assets/animals/rescue-cat-front.png', fallback: '🐱', sprites: animalDirections('cat') },
  { name: '강아지', image: '/assets/animals/rescue-dog-front.png', fallback: '🐶', sprites: animalDirections('dog') },
] as const

export interface MazeThemeAssets {
  floor: readonly [string, string]
  wall: readonly [string, string, string]
  wallDisplaySize: readonly [number, number, number]
  wallRotateOnVertical: readonly [boolean, boolean, boolean]
  floorColor: string
  wallColor: string
}

function themeAssets(
  theme: MazeThemeId,
  floorColor: string,
  wallColor: string,
  wallDisplaySize: readonly [number, number, number] = [185, 185, 185],
  wallRotateOnVertical: readonly [boolean, boolean, boolean] = [false, false, false],
): MazeThemeAssets {
  const base = `/assets/maps/maze-${theme}`
  return {
    floor: [`${base}-floor-01.png`, `${base}-floor-02.png`],
    wall: [`${base}-wall-01.png`, `${base}-wall-02.png`, `${base}-wall-03.png`],
    wallDisplaySize,
    wallRotateOnVertical,
    floorColor,
    wallColor,
  }
}

export const mazeThemes: Record<MazeThemeId, MazeThemeAssets> = {
  forest: themeAssets('forest', '#dce9b5', '#557b4a'),
  candy: themeAssets('candy', '#ffe1ed', '#d3578a', [185, 135, 185], [false, true, false]),
  ice: themeAssets('ice', '#dff5fb', '#5da9ca', [185, 185, 135], [false, false, true]),
  desert: themeAssets('desert', '#f6dca8', '#b47a3c', [185, 185, 135], [false, false, true]),
}

export function getRescueAnimal(id: string) {
  const index = Number(id.match(/^rescue-(\d+)$/)?.[1]) - 1
  return rescueAnimals[index] ?? rescueAnimals[0]
}
