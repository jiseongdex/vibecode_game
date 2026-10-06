import { completeStage, createCampaignProgress } from './campaignProgress'
import { createGameState, gameReducer } from './gameState'
import type { GameState } from './gameState'
import { createSeededRandom, generateMaze } from './mazeGenerator'
import { isWalkableGridPosition } from './mazeGrid'
import { loadSave, mergeSaveData, saveSave } from '../persistence/saveStore'
import { makeSavedSession } from '../persistence/saveStore'
import { loadAccountSave, saveAccountSave } from '../persistence/accountSaveStore'
import { SAVE_VERSION } from '../persistence/saveSchema'
import type { Direction, Maze, Position } from './types'

const steps: Array<[Direction, number, number]> = [
  ['up', -1, 0],
  ['right', 0, 1],
  ['down', 1, 0],
  ['left', 0, -1],
]
function key(position: Position): string {
  return `${position.row}:${position.col}`
}

function route(maze: Maze, start: Position, destination: Position): Direction[] {
  const queue: Position[] = [start]
  const previous = new Map<string, { from: string; direction: Direction }>()
  const seen = new Set([key(start)])

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]
    if (key(current) === key(destination)) break
    for (const [direction, rowDelta, colDelta] of steps) {
      const next = { row: current.row + rowDelta, col: current.col + colDelta }
      if (!isWalkableGridPosition(maze, next)) continue
      if (seen.has(key(next))) continue
      seen.add(key(next))
      previous.set(key(next), { from: key(current), direction })
      queue.push(next)
    }
  }

  const directions: Direction[] = []
  let cursor = key(destination)
  while (cursor !== key(start)) {
    const step = previous.get(cursor)
    if (!step) throw new Error('Destination is unreachable.')
    directions.unshift(step.direction)
    cursor = step.from
  }
  return directions
}

function walkTo(state: GameState, destination: Position): GameState {
  for (const direction of route(state.maze, state.player, destination)) {
    state = gameReducer(state, { type: 'MOVE', direction })
  }
  return state
}

describe('gameplay integration', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => {
    vi.useRealTimers()
    window.localStorage.clear()
  })

  it('starts, rescues everyone, exits, and unlocks the next stage', () => {
    const maze = generateMaze(15, createSeededRandom(42))
    let state = gameReducer(createGameState(1, maze), { type: 'START', now: 1000 })
    for (const target of [...state.rescues]) state = walkTo(state, target)
    expect(state.rescues.every((target) => target.rescued)).toBe(true)
    state = walkTo(state, state.exit)

    expect(state.status).toBe('won')
    const progress = completeStage(createCampaignProgress(), 1, 65)
    expect(progress.unlockedStage).toBe(2)
  })

  it('times out, retries the same maze, and restarts with a different maze', () => {
    const maze = generateMaze(15, createSeededRandom(42))
    let state = gameReducer(createGameState(1, maze), { type: 'START', now: 0 })
    for (let second = 0; second < state.stageConfig.timeLimitSeconds; second += 1) {
      state = gameReducer(state, { type: 'TICK' })
    }
    expect(state.status).toBe('lost')
    expect(state.remainingSeconds).toBe(0)

    const retry = gameReducer(state, { type: 'RETRY_SAME_MAZE' })
    expect(retry.status).toBe('ready')
    expect(retry.maze).toBe(maze)
    expect(retry.remainingSeconds).toBe(retry.stageConfig.timeLimitSeconds)

    const freshMaze = generateMaze(15, createSeededRandom(99))
    const fresh = gameReducer(state, { type: 'RESTART_NEW_MAZE', maze: freshMaze })
    expect(fresh.maze).toBe(freshMaze)
    expect(fresh.maze.seed).not.toBe(maze.seed)
    expect(fresh.status).toBe('ready')
  })

  it('saves a moving account game, restores it paused, and resumes explicitly', () => {
    const progress = createCampaignProgress()
    const attemptId = '01234567-89ab-4cde-8fab-0123456789ab'
    const maze = generateMaze(15, createSeededRandom(42))
    let state = gameReducer(createGameState(1, maze), { type: 'START', now: 1000 })
    state = walkTo(state, state.rescues[0])
    const saved = makeSavedSession(state, 2000)
    expect(saved?.state.status).toBe('paused')
    saveAccountSave({ version: 1, userId: 'player-1', currentSession: saved,
      attemptId, pendingResult: null })

    const restored = loadAccountSave('player-1', progress)
    expect(restored.attemptId).toBe(attemptId)
    expect(restored.currentSession?.state.maze).toEqual(maze)
    expect(loadAccountSave('player-2', progress).currentSession).toBeNull()
    const resumed = gameReducer(restored.currentSession!.state, { type: 'RESUME', now: 3000 })
    expect(resumed.status).toBe('playing')
    expect(resumed.player).toEqual(state.player)
  })

  it('rescues five animals on stage 20 and keeps the best merged records', () => {
    const maze = generateMaze(100, createSeededRandom(20))
    let state = gameReducer(createGameState(20, maze), { type: 'START', now: 0 })
    expect(state.rescues).toHaveLength(5)
    for (const target of [...state.rescues]) state = walkTo(state, target)
    state = walkTo(state, state.exit)
    expect(state.status).toBe('won')
    expect(state.followers).toHaveLength(5)

    const initial = {
      unlockedStage: 20,
      stageRecords: { 20: { bestTimeSeconds: 300 } },
    }
    const improved = completeStage(initial, 20, 280)
    expect(improved.unlockedStage).toBe(20)
    expect(improved.stageRecords[20]).toEqual({ bestTimeSeconds: 280 })

    saveSave({ version: SAVE_VERSION, ...improved, currentSession: null })
    const merged = mergeSaveData(loadSave(), {
      version: SAVE_VERSION,
      unlockedStage: 20,
      stageRecords: { 20: { bestTimeSeconds: 320 } },
      currentSession: null,
    })
    expect(merged.stageRecords[20]).toEqual({ bestTimeSeconds: 280 })
  })
})
