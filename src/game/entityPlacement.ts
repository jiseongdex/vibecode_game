import { createSeededRandom, getReachablePositions } from './mazeGenerator'
import type { EntityPosition, Maze, Position } from './types'

export interface PlacedEntities {
  exit: Position
  rescues: Array<EntityPosition & { rescued: boolean }>
}

export function placeEntities(maze: Maze, rescueCount: number): PlacedEntities {
  if (!Number.isInteger(rescueCount) || rescueCount < 0) {
    throw new RangeError('Rescue count must be a nonnegative integer.')
  }

  const reachable = getReachablePositions(maze, { row: 0, col: 0 })
  const exit = reachable.at(-1)
  if (!exit || reachable.length - 2 < rescueCount) {
    throw new RangeError('Maze has too few distinct cells for the entities.')
  }

  // BFS lists cells by distance, so late entries are more challenging to reach.
  const candidates = reachable.slice(1, -1)
  const preferredStart = Math.floor(candidates.length * 0.2)
  const preferred = candidates.slice(preferredStart)
  const pool = preferred.length >= rescueCount ? preferred : candidates
  const random = createSeededRandom(maze.seed ^ 0x72e5c0de)

  // Partial Fisher-Yates shuffle keeps picks distinct and repeatable on retry.
  for (let index = 0; index < rescueCount; index += 1) {
    const pick = index + Math.floor(random() * (pool.length - index))
    ;[pool[index], pool[pick]] = [pool[pick], pool[index]]
  }

  return {
    exit: { ...exit },
    rescues: pool.slice(0, rescueCount).map((position, index) => ({
      id: `rescue-${index + 1}`,
      ...position,
      rescued: false,
    })),
  }
}

export function moveFollowers(
  followers: Position[],
  previousPlayer: Position,
): Position[] {
  if (followers.length === 0) return []

  return [
    { ...previousPlayer },
    ...followers.slice(0, -1).map((position) => ({ ...position })),
  ]
}
