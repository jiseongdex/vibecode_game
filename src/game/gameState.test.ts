import { createGameState, gameReducer } from './gameState'
import { createSeededRandom, generateMaze, getReachablePositions } from './mazeGenerator'
import { isWalkableGridPosition, logicalToGridPosition } from './mazeGrid'
import type { Direction, Position } from './types'

const deltas: Record<Direction, Position> = {
  up: { row: -1, col: 0 },
  right: { row: 0, col: 1 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
}

function setup() {
  const maze = generateMaze(15, createSeededRandom(42))
  return createGameState(1, maze)
}

function directionBetween(from: Position, to: Position): Direction {
  const direction = (Object.keys(deltas) as Direction[]).find(
    (candidate) =>
      from.row + deltas[candidate].row === to.row &&
      from.col + deltas[candidate].col === to.col,
  )
  if (!direction) throw new Error('Expected adjacent path positions.')
  return direction
}

function pathTo(from: Position, destination: Position, maze: ReturnType<typeof generateMaze>): Position[] {
  // Search the expanded movement grid so each direction represents one tile.
  const queue: Position[][] = [[from]]
  const seen = new Set([`${from.row}:${from.col}`])
  for (let index = 0; index < queue.length; index += 1) {
    const path = queue[index]
    const current = path.at(-1)!
    if (current.row === destination.row && current.col === destination.col) return path
    for (const direction of Object.keys(deltas) as Direction[]) {
      const next = { row: current.row + deltas[direction].row, col: current.col + deltas[direction].col }
      const key = `${next.row}:${next.col}`
      if (!isWalkableGridPosition(maze, next) || seen.has(key)) continue
      seen.add(key)
      queue.push([...path, next])
    }
  }
  throw new Error('No route found.')
}

describe('gameReducer', () => {
  it('places distinct targets and a farthest exit, and starts only once', () => {
    const ready = setup()
    const reachable = getReachablePositions(ready.maze, { row: 0, col: 0 })
    expect(ready.exit).toEqual(logicalToGridPosition(reachable.at(-1)!))
    expect(ready.player).toEqual({ row: 1, col: 1 })
    expect(ready.rescues).toHaveLength(1)
    expect(ready.playerFacing).toBe('down')
    expect(ready.followerFacings).toEqual([])
    expect(ready.rescues[0]).not.toMatchObject(ready.player)
    expect(ready.rescues[0]).not.toMatchObject(ready.exit)
    expect(gameReducer(ready, { type: 'MOVE', direction: 'right' })).toBe(ready)

    const playing = gameReducer(ready, { type: 'START', now: 1000 })
    expect(playing.status).toBe('playing')
    expect(playing.startedAt).toBe(1000)
    expect(gameReducer(playing, { type: 'START', now: 2000 })).toBe(playing)
  })

  it('moves one expanded tile through open passages and blocks walls and junctions', () => {
    const state = gameReducer(setup(), { type: 'START', now: 0 })
    const facingWall = gameReducer(state, { type: 'MOVE', direction: 'up' })
    expect(facingWall).toMatchObject({
      player: state.player,
      playerFacing: 'up',
      followers: state.followers,
      followerFacings: state.followerFacings,
    })
    expect(facingWall.rescues).toBe(state.rescues)
    expect(gameReducer(facingWall, { type: 'MOVE', direction: 'up' })).toBe(facingWall)
    expect(gameReducer(state, { type: 'MOVE', direction: 'diagonal' as Direction })).toBe(state)
    const open = (Object.keys(deltas) as Direction[]).find(
      (direction) => isWalkableGridPosition(state.maze, {
        row: state.player.row + deltas[direction].row,
        col: state.player.col + deltas[direction].col,
      }),
    )!
    const moved = gameReducer(state, { type: 'MOVE', direction: open })
    expect(moved.player).toEqual({
      row: state.player.row + deltas[open].row,
      col: state.player.col + deltas[open].col,
    })
    expect(Math.abs(moved.player.row - state.player.row) + Math.abs(moved.player.col - state.player.col)).toBe(1)
    expect(moved.playerFacing).toBe(open)
    const closed = (Object.keys(deltas) as Direction[]).find(
      (direction) => !isWalkableGridPosition(state.maze, {
        row: moved.player.row + deltas[direction].row,
        col: moved.player.col + deltas[direction].col,
      }),
    )
    if (closed) {
      const blocked = gameReducer(moved, { type: 'MOVE', direction: closed })
      expect(blocked.playerFacing).toBe(closed)
      expect(blocked.player).toEqual(moved.player)
      expect(blocked.followers).toBe(moved.followers)
    }
  })

  it('requires rescue before escape and moves followers along previous positions', () => {
    let state = gameReducer(setup(), { type: 'START', now: 0 })
    const routeToExit = pathTo(state.player, state.exit, state.maze)
    const exitRouteKeys = new Set(
      routeToExit.map((position) => `${position.row}:${position.col}`),
    )
    const branchTarget = getReachablePositions(state.maze, { row: 0, col: 0 })
      .map(logicalToGridPosition)
      .find((position) => !exitRouteKeys.has(`${position.row}:${position.col}`))
    if (!branchTarget) throw new Error('Expected a branch outside the exit path.')
    state = {
      ...state,
      rescues: [{ ...state.rescues[0], ...branchTarget }],
    }

    for (let index = 1; index < routeToExit.length; index += 1) {
      state = gameReducer(state, {
        type: 'MOVE', direction: directionBetween(routeToExit[index - 1], routeToExit[index]),
      })
    }
    expect(state.rescues[0].rescued).toBe(false)
    expect(state.status).toBe('playing')

    const target = state.rescues[0]
    if (!target.rescued) {
      const route = pathTo(state.player, target, state.maze)
      for (let index = 1; index < route.length; index += 1) {
        const previous = state.player
        state = gameReducer(state, {
          type: 'MOVE', direction: directionBetween(route[index - 1], route[index]),
        })
        if (index === route.length - 1) {
          expect(state.rescues[0].rescued).toBe(true)
          expect(state.followers).toEqual([previous])
          expect(state.followerFacings).toEqual(['down'])
        }
      }
    }
    const nextRoute = pathTo(state.player, state.exit, state.maze)
    for (let index = 1; index < nextRoute.length; index += 1) {
      const previous = state.player
      const previousFollower = state.followers[0]
      const previousFacing = state.followerFacings[0]
      state = gameReducer(state, {
        type: 'MOVE', direction: directionBetween(nextRoute[index - 1], nextRoute[index]),
      })
      expect(state.followers[0]).toEqual(previous)
      expect(state.followerFacings[0]).toBe(
        previousFollower.row === previous.row && previousFollower.col === previous.col
          ? previousFacing
          : directionBetween(previousFollower, previous),
      )
    }
    expect(state.status).toBe('won')
    expect(gameReducer(state, { type: 'MOVE', direction: 'left' })).toBe(state)
  })

  it('keeps followers in a line when rescuing more than one target', () => {
    const maze = generateMaze(19, createSeededRandom(123))
    let state = gameReducer(createGameState(5, maze), { type: 'START', now: 0 })
    for (const target of state.rescues) {
      const route = pathTo(state.player, target, state.maze)
      for (let index = 1; index < route.length; index += 1) {
        const oldPlayer = state.player
        const oldFollowers = state.followers
        const oldFacings = state.followerFacings
        state = gameReducer(state, {
          type: 'MOVE', direction: directionBetween(route[index - 1], route[index]),
        })
        if (oldFollowers.length > 0) {
          expect(state.followers[0]).toEqual(oldPlayer)
        }
        if (oldFollowers.length === 2) {
          expect(state.followers[1]).toEqual(oldFollowers[0])
        }
        expect(state.followerFacings).toHaveLength(state.followers.length)
        oldFollowers.forEach((position, followerIndex) => {
          const next = state.followers[followerIndex]
          expect(state.followerFacings[followerIndex]).toBe(
            position.row === next.row && position.col === next.col
              ? oldFacings[followerIndex]
              : directionBetween(position, next),
          )
        })
        if (state.followers.length > oldFollowers.length) {
          expect(state.followerFacings.at(-1)).toBe('down')
        }
      }
      expect(state.rescues.find((item) => item.id === target.id)?.rescued).toBe(true)
    }
    expect(state.followers).toHaveLength(2)
  })

  it('keeps rescued targets in pickup order for their matching follower sprites', () => {
    const maze = generateMaze(19, createSeededRandom(123))
    let state = gameReducer(createGameState(5, maze), { type: 'START', now: 0 })
    const targets = [...state.rescues].reverse()
    for (const target of targets) {
      const route = pathTo(state.player, target, state.maze)
      for (let index = 1; index < route.length; index += 1) {
        state = gameReducer(state, {
          type: 'MOVE', direction: directionBetween(route[index - 1], route[index]),
        })
      }
    }
    expect(state.rescues.filter((target) => target.rescued).map((target) => target.id))
      .toEqual(targets.map((target) => target.id))
  })

  it('pauses time, resumes, and loses exactly at zero', () => {
    const playing = gameReducer(setup(), { type: 'START', now: 1000 })
    const paused = gameReducer(playing, { type: 'PAUSE', now: 2000 })
    expect(paused.status).toBe('paused')
    expect(gameReducer(paused, { type: 'TICK' })).toBe(paused)
    expect(gameReducer(paused, { type: 'MOVE', direction: 'right' })).toBe(paused)
    const resumed = gameReducer(paused, { type: 'RESUME', now: 5000 })
    expect(resumed.startedAt).toBe(4000)
    expect(resumed.pausedAt).toBeNull()
    const almostOut = { ...resumed, remainingSeconds: 1 }
    const lost = gameReducer(almostOut, { type: 'TICK' })
    expect(lost.remainingSeconds).toBe(0)
    expect(lost.status).toBe('lost')
    expect(gameReducer(lost, { type: 'TICK' })).toBe(lost)
  })

  it('retries the same maze or resets with a new one', () => {
    const original = setup()
    const lost = { ...original, status: 'lost' as const, remainingSeconds: 0 }
    const retry = gameReducer(lost, { type: 'RETRY_SAME_MAZE' })
    expect(retry.maze).toBe(original.maze)
    expect(retry.exit).toEqual(original.exit)
    expect(retry.rescues).toEqual(original.rescues)
    expect(retry.remainingSeconds).toBe(original.stageConfig.timeLimitSeconds)
    expect(retry.status).toBe('ready')
    expect(retry.playerFacing).toBe('down')
    expect(retry.followerFacings).toEqual([])

    const freshMaze = generateMaze(15, createSeededRandom(99))
    const restarted = gameReducer(lost, { type: 'RESTART_NEW_MAZE', maze: freshMaze })
    expect(restarted.maze).toBe(freshMaze)
    expect(restarted.seed).toBe(freshMaze.seed)
    expect(restarted.status).toBe('ready')
    expect(restarted.playerFacing).toBe('down')
    expect(restarted.followerFacings).toEqual([])
    expect(gameReducer(original, { type: 'RETRY_SAME_MAZE' })).toBe(original)
  })
})
