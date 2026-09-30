import { act, fireEvent, render, screen } from '@testing-library/react'

import { getMazeTheme } from '../../assets/mazeTheme'
import { createGameState, gameReducer } from '../../game/gameState'
import { createSeededRandom, generateMaze } from '../../game/mazeGenerator'
import type { CellWalls, Direction } from '../../game/types'
import { MazeBoard } from './MazeBoard'

function stateFor(stage: number, size: number) {
  return createGameState(stage, generateMaze(size, createSeededRandom(stage)))
}

function openDirection(state: ReturnType<typeof stateFor>): Direction {
  const walls = state.maze.cells[state.player.row][state.player.col].walls
  const wallName: Record<Direction, keyof CellWalls> = {
    up: 'top', right: 'right', down: 'bottom', left: 'left',
  }
  return (['up', 'right', 'down', 'left'] as const).find((direction) =>
    !walls[wallName[direction]],
  )!
}

describe('MazeBoard', () => {
  it.each([
    [1, 15],
    [20, 33],
  ])('renders stage %i as a %ix%i board', (stage, size) => {
    const state = stateFor(stage, size)
    const { container } = render(<MazeBoard state={state} onMove={vi.fn()} />)

    expect(container.querySelectorAll('[data-row][data-col]')).toHaveLength(
      size * size,
    )
    expect(screen.getByRole('img', { name: '탐험가' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '잠긴 탈출구' })).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: '구출 대상' })).toHaveLength(
      state.stageConfig.rescueCount,
    )
    expect(screen.queryByRole('region', { name: /미니맵/ })).toBeNull()
  })

  it('renders walls and changes rescued targets into visible followers', () => {
    const state = stateFor(1, 15)
    const { container, rerender } = render(
      <MazeBoard state={state} onMove={vi.fn()} />,
    )
    const firstCell = container.querySelector('[data-row="0"][data-col="0"]')

    expect(firstCell).toHaveAttribute('data-cell-type', 'player')
    expect(firstCell?.className).toContain('wallTop')
    expect(firstCell?.className).toContain('wallLeft')

    const rescuedState = {
      ...state,
      rescues: state.rescues.map((target) => ({ ...target, rescued: true })),
      followers: [{ row: 0, col: 0 }],
      followerFacings: ['down' as const],
    }
    rerender(<MazeBoard state={rescuedState} onMove={vi.fn()} />)

    expect(screen.queryByRole('img', { name: '구출 대상' })).toBeNull()
    expect(screen.getByRole('img', { name: '구출한 동료 1' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '열린 탈출구' })).toBeInTheDocument()
  })

  it('follows the player while clamping the camera at board edges', () => {
    const state = stateFor(1, 15)
    const { rerender } = render(<MazeBoard state={state} onMove={vi.fn()} />)
    const board = screen.getByTestId('maze-board')
    const startTransform = board.style.transform

    rerender(
      <MazeBoard
        state={{ ...state, player: { row: 7, col: 7 } }}
        onMove={vi.fn()}
      />,
    )
    expect(board.style.transform).not.toBe(startTransform)
    expect(board.style.transform).toBe('translate3d(-70px, -150px, 0)')

    rerender(
      <MazeBoard
        state={{ ...state, player: { row: 14, col: 14 } }}
        onMove={vi.fn()}
      />,
    )
    expect(board.style.transform).toBe('translate3d(-140px, -300px, 0)')
  })

  it('keeps the minimum cell size on a narrow viewport', () => {
    const measure = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 320, height: 220, top: 0, right: 320, bottom: 220, left: 0,
      x: 0, y: 0, toJSON: () => ({}),
    })
    try {
      render(<MazeBoard state={stateFor(1, 15)} onMove={vi.fn()} />)
      expect(screen.getByTestId('maze-board').style.getPropertyValue('--cell-size')).toBe('36px')
    } finally {
      measure.mockRestore()
    }
  })

  it('uses five distinct local animal images and keeps the animal in the follower line', () => {
    const state = stateFor(20, 33)
    const { container, rerender } = render(<MazeBoard state={state} onMove={vi.fn()} />)
    const waiting = Array.from(container.querySelectorAll('[data-asset-slot="rescue-target"]'))
    expect(waiting.map((element) => element.getAttribute('data-animal'))).toEqual([
      '토끼', '여우', '곰', '흰 고양이', '강아지',
    ])
    expect(new Set(waiting.map((element) => element.querySelector('img')?.getAttribute('src'))).size).toBe(5)

    const rescued = state.rescues[4]
    rerender(<MazeBoard state={{
      ...state,
      rescues: [{ ...rescued, rescued: true }, ...state.rescues.slice(0, 4)],
      followers: [{ row: 0, col: 0 }],
      followerFacings: ['down'],
    }} onMove={vi.fn()} />)
    const follower = container.querySelector('[data-asset-slot="follower"]')
    expect(follower).toHaveAttribute('data-animal', '강아지')
    expect(follower?.querySelector('img')).toHaveAttribute('src', '/assets/animals/rescue-dog-front.png')
  })

  it('keeps emoji fallback visible when a local image fails to load', () => {
    const { container } = render(<MazeBoard state={stateFor(1, 15)} onMove={vi.fn()} />)
    const image = container.querySelector('[data-asset-slot="player"] img')!
    fireEvent.error(image)
    expect(image).toHaveAttribute('hidden')
    expect(container.querySelector('[data-asset-slot="player"]')).toHaveTextContent('🧙‍♀️')
  })

  it('uses directional sprites and alternates walking feet only for real moves', () => {
    vi.useFakeTimers()
    try {
      const state = { ...stateFor(1, 15), status: 'playing' as const }
      const { container, rerender } = render(<MazeBoard state={state} onMove={vi.fn()} appearance="boy" />)
      const player = () => container.querySelector('[data-asset-slot="player"]')!
      const image = () => player().querySelector('img')!
      expect(player()).toHaveAttribute('data-motion', 'none')
      expect(image()).toHaveAttribute('src', '/assets/players/player-boy-front.png')

      const blocked = gameReducer(state, { type: 'MOVE', direction: 'up' })
      rerender(<MazeBoard state={blocked} onMove={vi.fn()} appearance="boy" />)
      expect(player()).toHaveAttribute('data-facing', 'up')
      expect(player()).toHaveAttribute('data-motion', 'none')
      expect(image()).toHaveAttribute('src', '/assets/players/player-boy-back.png')

      const direction = openDirection(blocked)
      const moved = gameReducer(blocked, { type: 'MOVE', direction })
      const assetSide = { up: 'back', right: 'right', down: 'front', left: 'left' }[direction]
      rerender(<MazeBoard state={moved} onMove={vi.fn()} appearance="boy" />)
      expect(player()).toHaveAttribute('data-motion', 'walk')
      expect(image()).toHaveAttribute('src', `/assets/players/player-boy-${assetSide}-walk-a.png`)
      act(() => vi.advanceTimersByTime(80))
      expect(image()).toHaveAttribute('src', `/assets/players/player-boy-${assetSide}-walk-b.png`)
      act(() => vi.advanceTimersByTime(80))
      expect(player()).toHaveAttribute('data-motion', 'none')
      expect(image()).toHaveAttribute('src', `/assets/players/player-boy-${assetSide}.png`)

      const nextDirection = openDirection(moved)
      const next = gameReducer(moved, { type: 'MOVE', direction: nextDirection })
      const nextSide = { up: 'back', right: 'right', down: 'front', left: 'left' }[nextDirection]
      rerender(<MazeBoard state={next} onMove={vi.fn()} appearance="boy" />)
      expect(image()).toHaveAttribute('src', `/assets/players/player-boy-${nextSide}-walk-b.png`)
      act(() => vi.advanceTimersByTime(80))
      expect(image()).toHaveAttribute('src', `/assets/players/player-boy-${nextSide}-walk-a.png`)
      act(() => vi.advanceTimersByTime(80))
      expect(image()).toHaveAttribute('src', `/assets/players/player-boy-${nextSide}.png`)
    } finally {
      vi.useRealTimers()
    }
  })

  it('hops only existing followers that changed cells', () => {
    vi.useFakeTimers()
    try {
      const state = {
        ...stateFor(1, 15),
        rescues: [{ ...stateFor(1, 15).rescues[0], rescued: true }],
        followers: [{ row: 0, col: 0 }],
        followerFacings: ['down' as const],
      }
      const { container, rerender } = render(<MazeBoard state={state} onMove={vi.fn()} />)
      expect(container.querySelector('[data-asset-slot="follower"]')).toHaveAttribute('data-motion', 'none')

      const moved = {
        ...state,
        player: { row: 0, col: 1 },
        moveCount: 1,
        followers: [{ row: 0, col: 1 }, { row: 0, col: 2 }],
        followerFacings: ['right' as const, 'down' as const],
      }
      rerender(<MazeBoard state={moved} onMove={vi.fn()} />)
      const followers = container.querySelectorAll('[data-asset-slot="follower"]')
      expect(followers[0]).toHaveAttribute('data-motion', 'hop')
      expect(followers[0]).toHaveAttribute('data-facing', 'right')
      expect(followers[0].querySelector('img')).toHaveAttribute('src', '/assets/animals/rescue-rabbit-right.png')
      expect(followers[1]).toHaveAttribute('data-motion', 'none')
      act(() => vi.advanceTimersByTime(220))
      expect(container.querySelector('[data-asset-slot="follower"]')).toHaveAttribute('data-motion', 'none')
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows stable themed floors and one obstacle per closed boundary', () => {
    const state = stateFor(1, 15)
    const { container, rerender } = render(<MazeBoard state={state} onMove={vi.fn()} />)
    const board = screen.getByTestId('maze-board')
    expect(board).toHaveAttribute('data-theme', getMazeTheme(state.maze.seed))
    const cells = Array.from(container.querySelectorAll<HTMLElement>('[data-row][data-col]'))
    const firstFloor = cells[0].style.backgroundImage
    const firstWalls = Array.from(cells[0].querySelectorAll('[data-wall-side]')).map((wall) => [wall.getAttribute('data-wall-side'), wall.getAttribute('data-wall-variant')])
    const boundaryCount = state.maze.cells.flat().reduce((count, cell) =>
      count + Number(cell.walls.top) + Number(cell.walls.left)
        + Number(cell.col === state.maze.size - 1 && cell.walls.right)
        + Number(cell.row === state.maze.size - 1 && cell.walls.bottom), 0)
    expect(container.querySelectorAll('[data-wall-side]')).toHaveLength(boundaryCount)
    expect(firstWalls.map(([side]) => side)).toContain('up')
    expect(firstWalls.map(([side]) => side)).toContain('left')
    expect(cells[0].style.backgroundColor).not.toBe('')

    rerender(<MazeBoard state={{ ...state }} onMove={vi.fn()} />)
    expect(board).toHaveAttribute('data-theme', getMazeTheme(state.maze.seed))
    expect(cells[0].style.backgroundImage).toBe(firstFloor)
    expect(Array.from(cells[0].querySelectorAll('[data-wall-side]')).map((wall) => [wall.getAttribute('data-wall-side'), wall.getAttribute('data-wall-variant')])).toEqual(firstWalls)
  })

  it('keeps neutral images when reduced motion is requested', () => {
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    try {
      const state = { ...stateFor(1, 15), status: 'playing' as const }
      const { container, rerender } = render(<MazeBoard state={state} onMove={vi.fn()} />)
      const direction = openDirection(state)
      const moved = gameReducer(state, { type: 'MOVE', direction })
      rerender(<MazeBoard state={moved} onMove={vi.fn()} />)
      const player = container.querySelector('[data-asset-slot="player"]')!
      expect(player).toHaveAttribute('data-motion', 'none')
      expect(player.querySelector('img')?.getAttribute('src')).not.toContain('walk')
    } finally {
      window.matchMedia = original
    }
  })
})
