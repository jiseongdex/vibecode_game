import { act, fireEvent, render, screen } from '@testing-library/react'

import { getMazeTheme } from '../../assets/mazeTheme'
import { createGameState, gameReducer } from '../../game/gameState'
import { createSeededRandom, generateMaze } from '../../game/mazeGenerator'
import { isWalkableGridPosition } from '../../game/mazeGrid'
import type { Direction, Position } from '../../game/types'
import { MazeBoard } from './MazeBoard'

function stateFor(stage: number, size: number) {
  return createGameState(stage, generateMaze(size, createSeededRandom(stage)))
}

function openDirection(state: ReturnType<typeof stateFor>): Direction {
  const delta: Record<Direction, Position> = {
    up: { row: -1, col: 0 },
    right: { row: 0, col: 1 },
    down: { row: 1, col: 0 },
    left: { row: 0, col: -1 },
  }
  return (['up', 'right', 'down', 'left'] as const).find((direction) =>
    isWalkableGridPosition(state.maze, {
      row: state.player.row + delta[direction].row,
      col: state.player.col + delta[direction].col,
    }),
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
    expect((container.querySelector('[data-asset-slot="exit"]') as HTMLElement).style.backgroundColor)
      .toBe('transparent')
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
      followers: [{ row: 1, col: 1 }],
      followerFacings: ['down' as const],
    }
    rerender(<MazeBoard state={rescuedState} onMove={vi.fn()} />)

    expect(screen.queryByRole('img', { name: '구출 대상' })).toBeNull()
    expect(screen.getByRole('img', { name: '구출한 동료 1' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '열린 탈출구' })).toBeInTheDocument()
    expect((container.querySelector('[data-asset-slot="exit"]') as HTMLElement).style.backgroundColor)
      .toBe('transparent')
  })

  it('renders open connectors as floor and positions followers directly on them', () => {
    const state = stateFor(1, 15)
    const direction = openDirection(state)
    const delta: Record<Direction, Position> = {
      up: { row: -1, col: 0 },
      right: { row: 0, col: 1 },
      down: { row: 1, col: 0 },
      left: { row: 0, col: -1 },
    }
    const connector = {
      row: state.player.row + delta[direction].row,
      col: state.player.col + delta[direction].col,
    }
    const { container, rerender } = render(<MazeBoard state={state} onMove={vi.fn()} />)
    const tile = container.querySelector<HTMLElement>(
      `[data-open-passage="true"][data-visual-row="${connector.row}"][data-visual-col="${connector.col}"]`,
    )
    expect(tile).toBeInTheDocument()
    expect(tile?.style.backgroundColor).not.toBe('')
    expect(tile?.style.backgroundImage).not.toBe('')
    expect(container.querySelector(
      `[data-wall-side][data-visual-row="${connector.row}"][data-visual-col="${connector.col}"]`,
    )).toBeNull()
    const targets = Array.from(container.querySelectorAll<HTMLElement>('[data-asset-slot="rescue-target"]'))
    expect(targets.every((target) =>
      Number(target.dataset.gridRow) % 2 === 1 && Number(target.dataset.gridCol) % 2 === 1,
    )).toBe(true)
    for (const target of targets) {
      expect(target.style.top).toBe(`${Math.round((Number(target.dataset.gridRow) - 0.2) * 26 * 100) / 100}px`)
      expect(target.style.left).toBe(`${Math.round((Number(target.dataset.gridCol) - 0.2) * 26 * 100) / 100}px`)
    }

    rerender(<MazeBoard
      state={{
        ...state,
        rescues: state.rescues.map((target) => ({ ...target, rescued: true })),
        followers: [connector],
        followerFacings: ['down'],
      }}
      onMove={vi.fn()}
    />)
    const follower = container.querySelector<HTMLElement>('[data-asset-slot="follower"]')!
    expect(follower.dataset.gridRow).toBe(String(connector.row))
    expect(follower.dataset.gridCol).toBe(String(connector.col))
    expect(follower.style.top).toBe(`${Math.round((connector.row - 0.2) * 26 * 100) / 100}px`)
    expect(follower.style.left).toBe(`${Math.round((connector.col - 0.2) * 26 * 100) / 100}px`)
    expect(follower.parentElement).toBe(screen.getByTestId('maze-board'))
  })

  it('uses the same 70-percent logical-cell sprite box for players and rescue animals', () => {
    const state = stateFor(1, 15)
    const { container, rerender } = render(<MazeBoard state={state} onMove={vi.fn()} />)
    const rescued = state.rescues[0]
    rerender(
      <MazeBoard
        state={{
          ...state,
          rescues: [{ ...rescued, rescued: true }, ...state.rescues.slice(1)],
          followers: [{ row: 1, col: 1 }],
          followerFacings: ['down'],
        }}
        onMove={vi.fn()}
      />,
    )

    const sprites = Array.from(
      container.querySelectorAll<HTMLElement>(
        '[data-asset-slot="player"], [data-asset-slot="rescue-target"], [data-asset-slot="follower"]',
      ),
    )
    expect(sprites.length).toBe(state.stageConfig.rescueCount + 1)
    expect(sprites.every((sprite) =>
      sprite.style.getPropertyValue('--sprite-size') === 'calc(var(--cell-size) * 1.4)',
    )).toBe(true)
    expect(
      Array.from(container.querySelectorAll('[data-asset-slot="player"] img, [data-asset-slot="rescue-target"] img, [data-asset-slot="follower"] img'))
        .every((image) => (image as HTMLImageElement).style.objectFit === 'contain'),
    ).toBe(true)
  })

  it('follows the player while clamping the camera at board edges', () => {
    const state = stateFor(1, 15)
    const { rerender } = render(<MazeBoard state={state} onMove={vi.fn()} />)
    const board = screen.getByTestId('maze-board')
    const startTransform = board.style.transform

    rerender(
      <MazeBoard
        state={{ ...state, player: { row: 12, col: 12 } }}
        onMove={vi.fn()}
      />,
    )
    expect(board.style.transform).not.toBe(startTransform)
    expect(board.style.transform).toBe('translate3d(-5px, -85px, 0)')

    rerender(
      <MazeBoard
        state={{ ...state, player: { row: 13, col: 13 } }}
        onMove={vi.fn()}
      />,
    )
    expect(board.style.transform).toBe('translate3d(-31px, -111px, 0)')
  })

  it('keeps the minimum cell size on a narrow viewport', () => {
    const measure = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 320, height: 220, top: 0, right: 320, bottom: 220, left: 0,
      x: 0, y: 0, toJSON: () => ({}),
    })
    try {
      render(<MazeBoard state={stateFor(1, 15)} onMove={vi.fn()} />)
      expect(screen.getByTestId('maze-board').style.getPropertyValue('--cell-size')).toBe('18px')
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
          followers: [{ row: 1, col: 1 }],
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
    expect(image.nextElementSibling?.className).toContain('spriteFallback')
    expect(container.querySelector('[data-asset-slot="player"]')).toHaveTextContent('🧙‍♀️')

    const animal = container.querySelector('[data-asset-slot="rescue-target"] img')!
    fireEvent.error(animal)
    expect(animal).toHaveAttribute('hidden')
    expect(animal.nextElementSibling?.className).toContain('spriteFallback')
  })

  it('animates blocked attempts and alternates walking feet for movement inputs', () => {
    vi.useFakeTimers()
    try {
      const state = { ...stateFor(1, 15), status: 'playing' as const }
      const { container, rerender } = render(<MazeBoard state={state} onMove={vi.fn()} appearance="boy" />)
      const player = () => container.querySelector('[data-asset-slot="player"]')!
      const image = () => player().querySelector('img')!
      const playerNode = player()
      const imageNode = image()
      expect(player()).toHaveAttribute('data-motion', 'none')
      expect(image()).toHaveAttribute('src', '/assets/players/player-boy-front.png')

      const blocked = gameReducer(state, { type: 'MOVE', direction: 'up' })
      rerender(<MazeBoard state={blocked} onMove={vi.fn()} appearance="boy" movementAttempt={1} />)
      expect(player()).toBe(playerNode)
      expect(image()).toBe(imageNode)
      expect(player()).toHaveAttribute('data-facing', 'up')
      expect(player()).toHaveAttribute('data-motion', 'walk')
      expect(image()).toHaveAttribute('src', '/assets/players/player-boy-back-walk-a.png')
      act(() => vi.advanceTimersByTime(110))
      expect(player()).toHaveAttribute('data-motion', 'none')
      expect(image()).toHaveAttribute('src', '/assets/players/player-boy-back.png')

      const direction = openDirection(blocked)
      const moved = gameReducer(blocked, { type: 'MOVE', direction })
      const assetSide = { up: 'back', right: 'right', down: 'front', left: 'left' }[direction]
      rerender(<MazeBoard state={moved} onMove={vi.fn()} appearance="boy" movementAttempt={2} />)
      expect(player()).toBe(playerNode)
      expect(image()).toBe(imageNode)
      expect(player()).toHaveAttribute('data-motion', 'walk')
      expect(image()).toHaveAttribute('src', `/assets/players/player-boy-${assetSide}-walk-b.png`)
      act(() => vi.advanceTimersByTime(55))
      expect(image()).toHaveAttribute('src', `/assets/players/player-boy-${assetSide}-walk-a.png`)
      act(() => vi.advanceTimersByTime(55))
      expect(player()).toHaveAttribute('data-motion', 'none')
      expect(image()).toHaveAttribute('src', `/assets/players/player-boy-${assetSide}.png`)

      const nextDirection = openDirection(moved)
      const next = gameReducer(moved, { type: 'MOVE', direction: nextDirection })
      const nextSide = { up: 'back', right: 'right', down: 'front', left: 'left' }[nextDirection]
      rerender(<MazeBoard state={next} onMove={vi.fn()} appearance="boy" movementAttempt={3} />)
      expect(image()).toHaveAttribute('src', `/assets/players/player-boy-${nextSide}-walk-a.png`)
      act(() => vi.advanceTimersByTime(55))
      expect(image()).toHaveAttribute('src', `/assets/players/player-boy-${nextSide}-walk-b.png`)
      act(() => vi.advanceTimersByTime(55))
      expect(image()).toHaveAttribute('src', `/assets/players/player-boy-${nextSide}.png`)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps one player sprite and image while interpolating between cell centers', () => {
    const state = { ...stateFor(1, 15), status: 'playing' as const }
    const { container, rerender } = render(<MazeBoard state={state} onMove={vi.fn()} />)
    const player = container.querySelector<HTMLElement>('[data-asset-slot="player"]')!
    const image = player.querySelector('img')!
    const direction = openDirection(state)
    const moved = gameReducer(state, { type: 'MOVE', direction })
    const visualPosition = moved.player

    expect(container.querySelectorAll('[data-asset-slot="player"]')).toHaveLength(1)
    expect(player.parentElement).toBe(screen.getByTestId('maze-board'))
    expect(player.style.translate).toBe('20.8px 20.8px')

    rerender(<MazeBoard state={moved} onMove={vi.fn()} movementAttempt={1} />)

    expect(container.querySelectorAll('[data-asset-slot="player"]')).toHaveLength(1)
    expect(container.querySelector('[data-asset-slot="player"]')).toBe(player)
    expect(player.querySelector('img')).toBe(image)
    const left = Math.round((visualPosition.col - 0.2) * 26 * 100) / 100
    const top = Math.round((visualPosition.row - 0.2) * 26 * 100) / 100
    expect(player.style.translate).toBe(`${left}px ${top}px`)
  })

  it('restarts the directional walk animation on consecutive blocked attempts without moving', () => {
    vi.useFakeTimers()
    try {
      const state = { ...stateFor(1, 15), status: 'playing' as const }
      const { container, rerender } = render(<MazeBoard state={state} onMove={vi.fn()} />)
      const blocked = gameReducer(state, { type: 'MOVE', direction: 'up' })
      expect(blocked.player).toEqual(state.player)

      rerender(<MazeBoard state={blocked} onMove={vi.fn()} movementAttempt={1} />)
      const player = container.querySelector('[data-asset-slot="player"]')!
      expect(player).toHaveAttribute('data-motion', 'walk')
      expect(player).toHaveAttribute('data-facing', 'up')
      expect(player.querySelector('img')).toHaveAttribute('src', '/assets/players/player-girl-back-walk-a.png')

      act(() => vi.advanceTimersByTime(55))
      rerender(<MazeBoard state={blocked} onMove={vi.fn()} movementAttempt={2} />)
      expect(container.querySelector('[data-asset-slot="player"]')).toHaveAttribute('data-motion', 'walk')
      expect(container.querySelector('[data-asset-slot="player"] img')).toHaveAttribute('src', '/assets/players/player-girl-back-walk-b.png')
      expect(blocked.player).toEqual(state.player)
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
        followers: [{ row: 1, col: 1 }],
        followerFacings: ['down' as const],
      }
      const { container, rerender } = render(<MazeBoard state={state} onMove={vi.fn()} />)
      expect(container.querySelector('[data-asset-slot="follower"]')).toHaveAttribute('data-motion', 'none')

      const moved = {
        ...state,
        player: { row: 1, col: 2 },
        followers: [{ row: 1, col: 2 }, { row: 1, col: 3 }],
        followerFacings: ['right' as const, 'down' as const],
      }
      rerender(<MazeBoard state={moved} onMove={vi.fn()} movementAttempt={1} />)
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
    const firstWalls = Array.from(container.querySelectorAll('[data-wall-side]')).map((wall) => [wall.getAttribute('data-visual-row'), wall.getAttribute('data-visual-col'), wall.getAttribute('data-wall-variant')])
    const boundaryCount = state.maze.cells.flat().reduce((count, cell) =>
      count + Number(cell.walls.top) + Number(cell.walls.left)
        + Number(cell.col === state.maze.size - 1 && cell.walls.right)
        + Number(cell.row === state.maze.size - 1 && cell.walls.bottom), 0)
    expect(container.querySelectorAll('[data-wall-side]')).toHaveLength(boundaryCount)
    const junctions = Array.from(container.querySelectorAll('[data-junction="true"]'))
    expect(junctions.length).toBeGreaterThan(0)
    expect(junctions.every((junction) =>
      Number(junction.getAttribute('data-visual-row')) % 2 === 0 &&
      Number(junction.getAttribute('data-visual-col')) % 2 === 0,
    )).toBe(true)
    const obstacles = Array.from(container.querySelectorAll('[data-wall-side] img'))
    const theme = getMazeTheme(state.maze.seed)
    expect(obstacles.every((image) => image.getAttribute('src')?.startsWith(`/assets/maps/maze-${theme}-wall-`))).toBe(true)
    expect(new Set(obstacles.map((image) => image.getAttribute('src'))).size).toBe(3)
    expect(container.querySelector('[data-wall-side="up"][data-visual-row="0"][data-visual-col="1"]')).toBeInTheDocument()
    expect(container.querySelector('[data-wall-side="left"][data-visual-row="1"][data-visual-col="0"]')).toBeInTheDocument()
    expect(cells[0].style.backgroundColor).not.toBe('')

    rerender(<MazeBoard state={{ ...state }} onMove={vi.fn()} />)
    expect(board).toHaveAttribute('data-theme', getMazeTheme(state.maze.seed))
    expect(cells[0].style.backgroundImage).toBe(firstFloor)
    expect(Array.from(container.querySelectorAll('[data-wall-side]')).map((wall) => [wall.getAttribute('data-visual-row'), wall.getAttribute('data-visual-col'), wall.getAttribute('data-wall-variant')])).toEqual(firstWalls)

    const obstacle = container.querySelector('[data-wall-side] img')!
    fireEvent.error(obstacle)
    expect(obstacle).toHaveAttribute('hidden')
    expect(obstacle.nextElementSibling?.className).toContain('wallFallback')
  })

  it('places obstacles only in blocked tiles between reachable player cells', () => {
    const state = { ...stateFor(1, 15), status: 'playing' as const }
    const { container, rerender } = render(<MazeBoard state={state} onMove={vi.fn()} />)
    const board = screen.getByTestId('maze-board')
    expect(board.style.getPropertyValue('--visual-size')).toBe('31')
    const occupied = new Set(
      Array.from(container.querySelectorAll('[data-wall-side]')).map((wall) =>
        `${wall.getAttribute('data-visual-row')}:${wall.getAttribute('data-visual-col')}`,
      ),
    )
    expect(occupied.size).toBe(container.querySelectorAll('[data-wall-side]').length)
    const junctions = new Set(
      Array.from(container.querySelectorAll('[data-junction="true"]')).map((junction) =>
        `${junction.getAttribute('data-visual-row')}:${junction.getAttribute('data-visual-col')}`,
      ),
    )
    expect(junctions.size).toBe(container.querySelectorAll('[data-junction="true"]').length)
    for (const slot of occupied) {
      const [row, col] = slot.split(':').map(Number)
      const neighbors = row % 2 === 0
        ? [`${row}:${col - 1}`, `${row}:${col + 1}`]
        : [`${row - 1}:${col}`, `${row + 1}:${col}`]
      expect(neighbors.every((neighbor) => junctions.has(neighbor))).toBe(true)
    }

    for (const cell of state.maze.cells.flat()) {
      const centerRow = cell.row * 2 + 1
      const centerCol = cell.col * 2 + 1
      const center = container.querySelector<HTMLElement>(`[data-row="${cell.row}"][data-col="${cell.col}"]`)!
      expect(center.style.gridRow).toBe(String(centerRow + 1))
      expect(center.style.gridColumn).toBe(String(centerCol + 1))
      expect(occupied.has(`${centerRow}:${centerCol}`)).toBe(false)
      expect(junctions.has(`${centerRow}:${centerCol}`)).toBe(false)
      if (cell.col < state.maze.size - 1) {
        expect(occupied.has(`${centerRow}:${centerCol + 1}`)).toBe(cell.walls.right)
      }
      if (cell.row < state.maze.size - 1) {
        expect(occupied.has(`${centerRow + 1}:${centerCol}`)).toBe(cell.walls.bottom)
      }
    }

    const direction = openDirection(state)
    const blocked = gameReducer(state, { type: 'MOVE', direction: 'up' })
    expect(blocked.player).toEqual(state.player)
    expect(occupied.has('0:1')).toBe(true)
    const moved = gameReducer(state, { type: 'MOVE', direction })
    rerender(<MazeBoard state={moved} onMove={vi.fn()} />)
    const player = container.querySelector('[data-asset-slot="player"]')!
    expect(player.parentElement).toBe(board)
    expect(container.querySelectorAll('[data-asset-slot="player"]')).toHaveLength(1)
  })

  it('keeps neutral images when reduced motion is requested', () => {
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    try {
      const state = { ...stateFor(1, 15), status: 'playing' as const }
      const { container, rerender } = render(<MazeBoard state={state} onMove={vi.fn()} />)
      const direction = openDirection(state)
      const moved = gameReducer(state, { type: 'MOVE', direction })
      rerender(<MazeBoard state={moved} onMove={vi.fn()} movementAttempt={1} />)
      const player = container.querySelector('[data-asset-slot="player"]')!
      expect(player).toHaveAttribute('data-motion', 'none')
      expect(player.querySelector('img')?.getAttribute('src')).not.toContain('walk')
    } finally {
      window.matchMedia = original
    }
  })
})
