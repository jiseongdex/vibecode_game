import type { StageRecord } from '../game/campaignProgress'
import type { GameState } from '../game/gameState'
import { getReachablePositions } from '../game/mazeGenerator'
import { gridToLogicalPosition, isWalkableGridPosition } from '../game/mazeGrid'
import { getMazeSize, getStageConfig, MAX_STAGE, MIN_STAGE } from '../game/stageConfig'
import type { Cell, CellWalls, Direction, Maze, Position } from '../game/types'

export const SAVE_VERSION = 6 as const
export const SAVE_KEY = 'maze-rescue-game.save.v6'

export type { StageRecord } from '../game/campaignProgress'

export interface SavedSession {
  state: GameState & { status: 'paused' }
  updatedAt: number
}

export interface SaveData {
  version: typeof SAVE_VERSION
  unlockedStage: number
  currentSession: SavedSession | null
  stageRecords: Record<number, StageRecord>
}

type UnknownRecord = Record<string, unknown>

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonnegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function isStage(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= MIN_STAGE && (value as number) <= MAX_STAGE
}

function isDirection(value: unknown): value is Direction {
  return value === 'up' || value === 'right' || value === 'down' || value === 'left'
}

function isGridPosition(value: unknown, maze: Maze): value is Position {
  return (
    isObject(value) &&
    Number.isInteger(value.row) &&
    Number.isInteger(value.col) &&
    isWalkableGridPosition(maze, value as unknown as Position)
  )
}

function isFloorCenter(value: unknown, maze: Maze): value is Position {
  return (
    isGridPosition(value, maze) &&
    gridToLogicalPosition(value) !== null
  )
}

function isCell(value: unknown, row: number, col: number): value is Cell {
  if (!isObject(value) || !isObject(value.walls)) return false
  const walls = value.walls as UnknownRecord
  return (
    value.row === row &&
    value.col === col &&
    typeof value.visited === 'boolean' &&
    (Object.keys({ top: 1, right: 1, bottom: 1, left: 1 }) as Array<keyof CellWalls>)
      .every((side) => typeof walls[side] === 'boolean')
  )
}

function isMaze(value: unknown): value is Maze {
  if (!isObject(value) || !Number.isInteger(value.size) || !Array.isArray(value.cells)) {
    return false
  }
  const size = value.size as number
  if (
    size < 15 ||
    size > getMazeSize(MAX_STAGE) ||
    !isNonnegativeInteger(value.seed) ||
    (value.seed as number) > 0xffffffff ||
    value.cells.length !== size
  ) {
    return false
  }

  for (let row = 0; row < size; row += 1) {
    const cells = value.cells[row]
    if (!Array.isArray(cells) || cells.length !== size) return false
    for (let col = 0; col < size; col += 1) {
      const cell = cells[col]
      if (!isCell(cell, row, col)) return false
      if (
        (row === 0 && !cell.walls.top) ||
        (col === 0 && !cell.walls.left) ||
        (row === size - 1 && !cell.walls.bottom) ||
        (col === size - 1 && !cell.walls.right) ||
        (row > 0 && cell.walls.top !== value.cells[row - 1][col].walls.bottom) ||
        (col > 0 && cell.walls.left !== cells[col - 1].walls.right)
      ) {
        return false
      }
    }
  }

  return getReachablePositions(value as unknown as Maze, { row: 0, col: 0 }).length === size * size
}

function isSavedSession(value: unknown, unlockedStage: number): boolean {
  if (!isObject(value) || !isNonnegativeInteger(value.updatedAt) || !isObject(value.state)) {
    return false
  }
  const state = value.state
  if (!isObject(state.stageConfig) || !isStage(state.stageConfig.stage)) return false
  const stage = state.stageConfig.stage
  if (stage > unlockedStage) return false
  const config = getStageConfig(stage)
  if (
    state.stageConfig.size !== config.size ||
    state.stageConfig.rescueCount !== config.rescueCount ||
    state.stageConfig.timeLimitSeconds !== config.timeLimitSeconds ||
    !isMaze(state.maze) ||
    state.maze.size !== config.size ||
    state.seed !== state.maze.seed ||
    !isGridPosition(state.player, state.maze) ||
    !isFloorCenter(state.exit, state.maze) ||
    (state.exit.row === 1 && state.exit.col === 1) ||
    !Array.isArray(state.rescues) ||
    state.rescues.length !== config.rescueCount ||
    !Array.isArray(state.followers) ||
    'moveCount' in state ||
    !isNonnegativeInteger(state.remainingSeconds) ||
    state.remainingSeconds === 0 ||
    state.remainingSeconds > config.timeLimitSeconds ||
    state.status !== 'paused' ||
    (state.startedAt !== null && !isNonnegativeInteger(state.startedAt)) ||
    (state.pausedAt !== null && !isNonnegativeInteger(state.pausedAt))
  ) {
    return false
  }

  const rescueIds = new Set<string>()
  const rescuePositions = new Set<string>()
  let rescuedCount = 0
  for (const target of state.rescues) {
    const candidate: unknown = target
    if (
      !isObject(candidate) ||
      !isFloorCenter(candidate, state.maze) ||
      typeof candidate.id !== 'string' ||
      candidate.id.length === 0 ||
      typeof candidate.rescued !== 'boolean' ||
      (candidate.row === 1 && candidate.col === 1) ||
      (candidate.row === state.exit.row && candidate.col === state.exit.col)
    ) {
      return false
    }
    const key = `${candidate.row}:${candidate.col}`
    if (rescueIds.has(candidate.id) || rescuePositions.has(key)) return false
    rescueIds.add(candidate.id)
    rescuePositions.add(key)
    if (candidate.rescued) rescuedCount += 1
  }

  if (
    state.followers.length !== rescuedCount ||
    !state.followers.every((position: unknown) =>
      isGridPosition(position, state.maze as Maze),
    )
  ) {
    return false
  }

  return (
    isDirection(state.playerFacing) &&
    Array.isArray(state.followerFacings) &&
    state.followerFacings.length === state.followers.length &&
    state.followerFacings.every(isDirection)
  )
}

export function isSaveData(value: unknown): value is SaveData {
  if (
    !isObject(value) ||
    value.version !== SAVE_VERSION ||
    !isStage(value.unlockedStage) ||
    !isObject(value.stageRecords)
  ) {
    return false
  }

  for (const [key, record] of Object.entries(value.stageRecords)) {
    const stage = Number(key)
    if (
      !isStage(stage) ||
      String(stage) !== key ||
      stage > value.unlockedStage ||
      !isObject(record) ||
      'bestMoveCount' in record ||
      !isNonnegativeInteger(record.bestTimeSeconds)
    ) {
      return false
    }
  }

  return value.currentSession === null || isSavedSession(value.currentSession, value.unlockedStage)
}
