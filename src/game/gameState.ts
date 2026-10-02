import { rescueAnimals } from '../assets/assetManifest'
import { placeEntities, moveFollowers } from './entityPlacement'
import { createSeededRandom, generateMaze } from './mazeGenerator'
import { getStageConfig } from './stageConfig'
import { isWalkableGridPosition, logicalToGridPosition } from './mazeGrid'
import type {
  Direction,
  EntityPosition,
  Maze,
  Position,
  StageConfig,
} from './types'

export type GameStatus = 'ready' | 'playing' | 'paused' | 'won' | 'lost'
export type RescueTarget = EntityPosition & { rescued: boolean }

export interface GameState {
  stageConfig: StageConfig
  maze: Maze
  player: Position
  exit: Position
  rescues: RescueTarget[]
  followers: Position[]
  playerFacing: Direction
  followerFacings: Direction[]
  remainingSeconds: number
  status: GameStatus
  startedAt: number | null
  pausedAt: number | null
  seed: number
}

export type GameAction =
  | { type: 'START'; now: number }
  | { type: 'MOVE'; direction: Direction }
  | { type: 'TICK' }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'RETRY_SAME_MAZE' }
  | { type: 'RESTART_NEW_MAZE'; maze: Maze }

const movement: Record<Direction, Position> = {
  up: { row: -1, col: 0 },
  right: { row: 0, col: 1 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
}

function samePosition(first: Position, second: Position): boolean {
  return first.row === second.row && first.col === second.col
}

function directionFromStep(from: Position, to: Position): Direction | null {
  const rowChange = to.row - from.row
  const colChange = to.col - from.col
  if (rowChange === -1 && colChange === 0) return 'up'
  if (rowChange === 1 && colChange === 0) return 'down'
  if (rowChange === 0 && colChange === -1) return 'left'
  if (rowChange === 0 && colChange === 1) return 'right'
  return null
}

function shuffledRescueIds(seed: number): string[] {
  const ids = rescueAnimals.map((_, index) => `rescue-${index + 1}`)
  const random = createSeededRandom(seed ^ 0x51a3c7d2)

  for (let index = ids.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(random() * (index + 1))
    ;[ids[index], ids[pick]] = [ids[pick], ids[index]]
  }

  return ids
}

export function createGameState(stage: number, maze?: Maze): GameState {
  const stageConfig = getStageConfig(stage)
  const selectedMaze = maze ?? generateMaze(stageConfig.size)

  if (selectedMaze.size !== stageConfig.size) {
    throw new RangeError('Maze size does not match the stage configuration.')
  }
  if (stageConfig.rescueCount > rescueAnimals.length) {
    throw new RangeError('Rescue count exceeds the available animal types.')
  }

  const { exit, rescues } = placeEntities(
    selectedMaze,
    stageConfig.rescueCount,
  )
  const animalIds = shuffledRescueIds(selectedMaze.seed)
  return {
    stageConfig,
    maze: selectedMaze,
    player: logicalToGridPosition({ row: 0, col: 0 }),
    exit: logicalToGridPosition(exit),
    rescues: rescues.map((target, index) => ({
      ...target,
      id: animalIds[index],
      ...logicalToGridPosition(target),
    })),
    followers: [],
    playerFacing: 'down',
    followerFacings: [],
    remainingSeconds: stageConfig.timeLimitSeconds,
    status: 'ready',
    startedAt: null,
    pausedAt: null,
    seed: selectedMaze.seed,
  }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START':
      if (state.status !== 'ready') return state
      return { ...state, status: 'playing', startedAt: action.now }

    case 'MOVE': {
      if (state.status !== 'playing') return state
      const offset = movement[action.direction]
      if (!offset) return state

      const nextPlayer = {
        row: state.player.row + offset.row,
        col: state.player.col + offset.col,
      }
      if (!isWalkableGridPosition(state.maze, nextPlayer)) {
        return state.playerFacing === action.direction
          ? state
          : { ...state, playerFacing: action.direction }
      }

      const newlyRescued = state.rescues.some(
        (target) => !target.rescued && samePosition(target, nextPlayer),
      )
      const rescues = newlyRescued
        ? [
            ...state.rescues.filter((target) => target.rescued),
            ...state.rescues
              .filter((target) => !target.rescued && samePosition(target, nextPlayer))
              .map((target) => ({ ...target, rescued: true })),
            ...state.rescues.filter(
              (target) => !target.rescued && !samePosition(target, nextPlayer),
            ),
          ]
        : state.rescues
      const followers = moveFollowers(state.followers, state.player)

      if (newlyRescued) {
        const previousTail = state.followers.at(-1) ?? state.player
        followers.push({ ...previousTail })
      }
      const followerFacings = followers.map((position, index) =>
        index < state.followers.length
          ? directionFromStep(state.followers[index], position) ??
            state.followerFacings[index] ??
            'down'
          : 'down',
      )

      const won =
        samePosition(nextPlayer, state.exit) &&
        rescues.every((target) => target.rescued)

      return {
        ...state,
        player: nextPlayer,
        rescues,
        followers,
        playerFacing: action.direction,
        followerFacings,
        status: won ? 'won' : 'playing',
      }
    }

    case 'TICK':
      if (state.status !== 'playing') return state
      return {
        ...state,
        remainingSeconds: Math.max(0, state.remainingSeconds - 1),
        status: state.remainingSeconds <= 1 ? 'lost' : 'playing',
      }

    case 'PAUSE':
      if (state.status !== 'playing') return state
      return { ...state, status: 'paused', pausedAt: action.now }

    case 'RESUME':
      if (state.status !== 'paused') return state
      return {
        ...state,
        status: 'playing',
        startedAt:
          state.startedAt === null || state.pausedAt === null
            ? state.startedAt
            : state.startedAt + action.now - state.pausedAt,
        pausedAt: null,
      }

    case 'RETRY_SAME_MAZE': {
      if (state.status !== 'lost' && state.status !== 'won') return state
      const retry = createGameState(state.stageConfig.stage, state.maze)
      const previousIds = new Map(
        state.rescues.map((target) => [`${target.row}:${target.col}`, target.id]),
      )
      return {
        ...retry,
        rescues: retry.rescues.map((target) => ({
          ...target,
          id: previousIds.get(`${target.row}:${target.col}`) ?? target.id,
        })),
      }
    }

    case 'RESTART_NEW_MAZE':
      return createGameState(state.stageConfig.stage, action.maze)
  }
}
