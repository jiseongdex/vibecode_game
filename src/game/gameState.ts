import { placeEntities, moveFollowers } from './entityPlacement'
import { generateMaze } from './mazeGenerator'
import { getStageConfig } from './stageConfig'
import type {
  CellWalls,
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

const movement: Record<Direction, Position & { wall: keyof CellWalls }> = {
  up: { row: -1, col: 0, wall: 'top' },
  right: { row: 0, col: 1, wall: 'right' },
  down: { row: 1, col: 0, wall: 'bottom' },
  left: { row: 0, col: -1, wall: 'left' },
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

export function createGameState(stage: number, maze?: Maze): GameState {
  const stageConfig = getStageConfig(stage)
  const selectedMaze = maze ?? generateMaze(stageConfig.size)

  if (selectedMaze.size !== stageConfig.size) {
    throw new RangeError('Maze size does not match the stage configuration.')
  }

  const { exit, rescues } = placeEntities(
    selectedMaze,
    stageConfig.rescueCount,
  )

  return {
    stageConfig,
    maze: selectedMaze,
    player: { row: 0, col: 0 },
    exit,
    rescues,
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
      if (
        nextPlayer.row < 0 ||
        nextPlayer.row >= state.maze.size ||
        nextPlayer.col < 0 ||
        nextPlayer.col >= state.maze.size ||
        state.maze.cells[state.player.row][state.player.col].walls[offset.wall]
      ) {
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

    case 'RETRY_SAME_MAZE':
      if (state.status !== 'lost' && state.status !== 'won') return state
      return createGameState(state.stageConfig.stage, state.maze)

    case 'RESTART_NEW_MAZE':
      return createGameState(state.stageConfig.stage, action.maze)
  }
}
