import { createSeededRandom } from '../game/mazeGenerator'
import type { Direction } from '../game/types'

export const MAZE_THEMES = ['forest', 'candy', 'ice', 'desert'] as const
export type MazeThemeId = (typeof MAZE_THEMES)[number]

const wallSalt: Record<Direction, number> = {
  up: 0x544f5001,
  right: 0x52474802,
  down: 0x42545403,
  left: 0x4c465404,
}

function tileSeed(seed: number, row: number, col: number, salt: number): number {
  return (
    seed ^
    Math.imul(row + 1, 0x9e3779b1) ^
    Math.imul(col + 1, 0x85ebca6b) ^
    salt
  ) >>> 0
}

export function getMazeTheme(seed: number): MazeThemeId {
  const random = createSeededRandom((seed ^ 0x5448454d) >>> 0)()
  return MAZE_THEMES[Math.floor(random * MAZE_THEMES.length)]
}

export function getFloorVariant(seed: number, row: number, col: number): 0 | 1 {
  return createSeededRandom(tileSeed(seed, row, col, 0x464c4f52))() < 0.5 ? 0 : 1
}

export function getWallVariant(seed: number, row: number, col: number, side: Direction): 0 | 1 | 2 {
  return Math.floor(createSeededRandom(tileSeed(seed, row, col, wallSalt[side]))() * 3) as 0 | 1 | 2
}
