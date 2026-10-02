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
    const cellSize = Number.parseInt(
      screen.getByTestId('maze-board').style.getPropertyValue('--cell-size'),
      10,
    )
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
    const player = container.querySelector<HTMLElement>('[data-asset-slot="player"]')!
    expect(player.style.translate).toBe(
      `${Math.round((state.player.col - 0.3) * cellSize * 100) / 100}px ${Math.round((state.player.row - 0.3) * cellSize * 100) / 100}px`,
    )
    for (const target of targets) {
      expect(target.style.top).toBe(`${Math.round((Number(target.dataset.gridRow) - 0.2) * cellSize * 100) / 100}px`)
      expect(target.style.left).toBe(`${Math.round((Number(target.dataset.gridCol) - 0.2) * cellSize * 100) / 100}px`)
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
    expect(follower.style.top).toBe(`${Math.round((connector.row - 0.2) * cellSize * 100) / 100}px`)
    expect(follower.style.left).toBe(`${Math.round((connector.col - 0.2) * cellSize * 100) / 100}px`)
    expect(follower.parentElement).toBe(screen.getByTestId('maze-board'))
  })

  it('renders the player larger than rescue animals while keeping image proportions', () => {
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
    const player = container.querySelector<HTMLElement>('[data-asset-slot="player"]')!
    const animals = sprites.filter((sprite) => sprite !== player)
    expect(player.style.getPropertyValue('--sprite-size')).toBe('calc(var(--cell-size) * 1.6)')
    expect(animals.every((sprite) =>
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
    expect(startTransform).toBe('translate3d(0px, 0px, 0)')
    expect(board.style.getPropertyValue('--cell-size')).toBe('120px')
    expect(1240 / 120).toBeGreaterThan(10)
    expect(1240 / 120).toBeLessThan(11)
    expect(840 / 120).toBe(7)

    rerender(
      <MazeBoard
        state={{ ...state, player: { row: 12, col: 12 } }}
        onMove={vi.fn()}
      />,
    )
    expect(board.style.transform).not.toBe(startTransform)
    expect(board.style.transform).toBe('translate3d(-880px, -1080px, 0)')

    rerender(
      <MazeBoard
        state={{ ...state, player: { row: 13, col: 13 } }}
        onMove={vi.fn()}
      />,
    )
    expect(board.style.transform).toBe('translate3d(-1000px, -1200px, 0)')

    rerender(
      <MazeBoard
        state={{ ...state, player: { row: 29, col: 29 } }}
        onMove={vi.fn()}
      />,
    )
    expect(board.style.transform).toBe('translate3d(-2480px, -2880px, 0)')
  })

  it('scales the frame, tiles, player, and camera together', () => {
    const initial = stateFor(1, 15)
    const state = { ...initial, player: { row: 12, col: 12 } }
    const { container, rerender } = render(<MazeBoard state={state} onMove={vi.fn()} />)
    const board = screen.getByTestId('maze-board')
    const viewport = screen.getByTestId('maze-viewport')
    const player = container.querySelector<HTMLElement>('[data-asset-slot="player"]')!
    const originalTranslate = player.style.translate

    expect(viewport.style.width).toBe('1240px')
    expect(viewport.style.height).toBe('840px')
    expect(board.style.getPropertyValue('--cell-size')).toBe('120px')
    expect(board.style.transform).toBe('translate3d(-880px, -1080px, 0)')

    rerender(<MazeBoard state={state} onMove={vi.fn()} scale={0.5} />)
    expect(viewport.style.width).toBe('620px')
    expect(viewport.style.height).toBe('420px')
    expect(viewport.style.borderWidth).toBe('2.5px')
    expect(board.style.getPropertyValue('--cell-size')).toBe('60px')
    expect(board.style.transform).toBe('translate3d(-440px, -540px, 0)')
    expect(Number.parseFloat(player.style.translate)).toBe(Number.parseFloat(originalTranslate) / 2)
    expect(620 / 60).toBe(1240 / 120)
    expect(420 / 60).toBe(840 / 120)

    rerender(<MazeBoard state={state} onMove={vi.fn()} scale={1.28} />)
    expect(Number.parseFloat(viewport.style.width)).toBeCloseTo(1240 * 1.28)
    expect(Number.parseFloat(viewport.style.height)).toBeCloseTo(840 * 1.28)
    expect(Number.parseFloat(viewport.style.borderWidth)).toBeCloseTo(6.4)
    expect(Number.parseFloat(board.style.getPropertyValue('--cell-size'))).toBeCloseTo(153.6)
    const enlargedCamera = board.style.transform.match(/translate3d\(([-\d.]+)px, ([-\d.]+)px, 0\)/)
    expect(Number(enlargedCamera?.[1])).toBeCloseTo(-880 * 1.28)
    expect(Number(enlargedCamera?.[2])).toBeCloseTo(-1080 * 1.28)
    expect(Number.parseFloat(player.style.translate)).toBeCloseTo(Number.parseFloat(originalTranslate) * 1.28)

    rerender(<MazeBoard state={{ ...state, player: { row: 29, col: 29 } }} onMove={vi.fn()} scale={0.5} />)
    expect(board.style.transform).toBe('translate3d(-1240px, -1440px, 0)')
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

  it('animates blocked attempts in place and alternates walking feet for successful moves', () => {
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
      act(() => vi.advanceTimersByTime(55))
      expect(image()).toHaveAttribute('src', '/assets/players/player-boy-back-walk-b.png')
      act(() => vi.advanceTimersByTime(55))
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

  it.each([
    ['up', 'top', 'back'],
    ['left', 'left', 'left'],
    ['down', 'bottom', 'front'],
    ['right', 'right', 'right'],
  ] as const)('walks in place against a %s wall', (direction, wallSide, assetSide) => {
    vi.useFakeTimers()
    try {
      const initial = stateFor(1, 15)
      const cell = initial.maze.cells.flat().find((candidate) => candidate.walls[wallSide])!
      const state = {
        ...initial,
        player: { row: cell.row * 2 + 1, col: cell.col * 2 + 1 },
        playerFacing: direction,
        status: 'playing' as const,
      }
      const blocked = gameReducer(state, { type: 'MOVE', direction })
      expect(blocked.player).toEqual(state.player)

      const { container, rerender } = render(
        <MazeBoard state={state} onMove={vi.fn()} appearance="boy" />,
      )
      const player = container.querySelector<HTMLElement>('[data-asset-slot="player"]')!
      const image = player.querySelector('img')!
      const initialTranslate = player.style.translate
      const initialSize = player.style.getPropertyValue('--sprite-size')

      rerender(<MazeBoard state={blocked} onMove={vi.fn()} appearance="boy" movementAttempt={1} />)
      expect(player).toHaveAttribute('data-facing', direction)
      expect(player).toHaveAttribute('data-motion', 'walk')
      expect(image).toHaveAttribute('src', `/assets/players/player-boy-${assetSide}-walk-a.png`)
      act(() => vi.advanceTimersByTime(55))
      expect(image).toHaveAttribute('src', `/assets/players/player-boy-${assetSide}-walk-b.png`)

      rerender(<MazeBoard state={blocked} onMove={vi.fn()} appearance="boy" movementAttempt={2} />)
      expect(player).toHaveAttribute('data-motion', 'walk')
      expect(image).toHaveAttribute('src', `/assets/players/player-boy-${assetSide}-walk-b.png`)
      act(() => vi.advanceTimersByTime(55))
      expect(image).toHaveAttribute('src', `/assets/players/player-boy-${assetSide}-walk-a.png`)
      expect(container.querySelector('[data-asset-slot="player"]')).toBe(player)
      expect(player.querySelector('img')).toBe(image)
      expect(player.style.translate).toBe(initialTranslate)
      expect(player.style.getPropertyValue('--sprite-size')).toBe(initialSize)
      act(() => vi.advanceTimersByTime(55))
      expect(player).toHaveAttribute('data-motion', 'none')
      expect(image).toHaveAttribute('src', `/assets/players/player-boy-${assetSide}.png`)
    } finally {
      vi.useRealTimers()
    }
  })

  it('fades the previous facing on a blocked turn without restarting on repeated input', () => {
    vi.useFakeTimers()
    try {
      const state = { ...stateFor(1, 15), status: 'playing' as const }
      const { container, rerender } = render(<MazeBoard state={state} onMove={vi.fn()} appearance="boy" />)
      const player = () => container.querySelector('[data-asset-slot="player"]')!
      const overlay = () => player().querySelector('[data-turn-previous]')
      expect(overlay()).toBeNull()
      expect(player().querySelectorAll('img')).toHaveLength(1)

      const blocked = gameReducer(state, { type: 'MOVE', direction: 'up' })
      expect(blocked.player).toEqual(state.player)
      rerender(<MazeBoard state={blocked} onMove={vi.fn()} appearance="boy" movementAttempt={1} />)
      expect(player()).toHaveAttribute('data-facing', 'up')
      expect(player().querySelector('img')).toHaveAttribute('src', '/assets/players/player-boy-back-walk-a.png')
      expect(overlay()).toHaveAttribute('data-turn-previous', '/assets/players/player-boy-front.png')
      expect(overlay()).toHaveAttribute('aria-hidden', 'true')

      act(() => vi.advanceTimersByTime(100))
      expect(overlay()).toBeNull()

      rerender(<MazeBoard state={blocked} onMove={vi.fn()} appearance="boy" movementAttempt={2} />)
      expect(overlay()).toBeNull()
      expect(player()).toHaveAttribute('data-motion', 'walk')
      expect(player().querySelector('img')).toHaveAttribute('src', '/assets/players/player-boy-back-walk-b.png')
    } finally {
      vi.useRealTimers()
    }
  })

  it('restarts a turn from the latest image when the facing changes again quickly', () => {
    vi.useFakeTimers()
    try {
      const state = stateFor(1, 15)
      const { container, rerender } = render(<MazeBoard state={state} onMove={vi.fn()} />)
      const player = () => container.querySelector('[data-asset-slot="player"]')!
      const overlay = () => player().querySelector('[data-turn-previous]')

      rerender(<MazeBoard state={{ ...state, playerFacing: 'up' }} onMove={vi.fn()} />)
      const firstOverlay = overlay()
      expect(firstOverlay).toHaveAttribute('data-turn-previous', '/assets/players/player-girl-front.png')

      act(() => vi.advanceTimersByTime(40))
      rerender(<MazeBoard state={{ ...state, playerFacing: 'right' }} onMove={vi.fn()} />)
      expect(overlay()).not.toBe(firstOverlay)
      expect(overlay()).toHaveAttribute('data-turn-previous', '/assets/players/player-girl-back.png')
      expect(player().querySelector('img')).toHaveAttribute('src', '/assets/players/player-girl-right.png')

      act(() => vi.advanceTimersByTime(60))
      expect(overlay()).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(40))
      expect(overlay()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows a turn transition when a move succeeds in a new direction', () => {
    const state = { ...stateFor(1, 15), status: 'playing' as const }
    const direction = openDirection(state)
    const initial = { ...state, playerFacing: direction === 'down' ? 'up' as const : 'down' as const }
    const { container, rerender } = render(<MazeBoard state={initial} onMove={vi.fn()} />)
    const previousSrc = container.querySelector('[data-asset-slot="player"] img')?.getAttribute('src')
    const moved = gameReducer(initial, { type: 'MOVE', direction })
    expect(moved.player).not.toEqual(initial.player)

    rerender(<MazeBoard state={moved} onMove={vi.fn()} movementAttempt={1} />)
    expect(container.querySelector('[data-turn-previous]')).toHaveAttribute('data-turn-previous', previousSrc)
    expect(container.querySelector('[data-asset-slot="player"]')).toHaveAttribute('data-facing', direction)
  })

  it('keeps one player sprite and image while interpolating between cell centers', () => {
    const state = { ...stateFor(1, 15), status: 'playing' as const }
    const { container, rerender } = render(<MazeBoard state={state} onMove={vi.fn()} />)
    const player = container.querySelector<HTMLElement>('[data-asset-slot="player"]')!
    const cellSize = Number.parseInt(
      screen.getByTestId('maze-board').style.getPropertyValue('--cell-size'),
      10,
    )
    const image = player.querySelector('img')!
    const direction = openDirection(state)
    const moved = gameReducer(state, { type: 'MOVE', direction })
    const visualPosition = moved.player

    expect(container.querySelectorAll('[data-asset-slot="player"]')).toHaveLength(1)
    expect(player.parentElement).toBe(screen.getByTestId('maze-board'))
    expect(player.style.translate).toBe(
      `${Math.round((state.player.col - 0.3) * cellSize * 100) / 100}px ${Math.round((state.player.row - 0.3) * cellSize * 100) / 100}px`,
    )

    rerender(<MazeBoard state={moved} onMove={vi.fn()} movementAttempt={1} />)

    expect(container.querySelectorAll('[data-asset-slot="player"]')).toHaveLength(1)
    expect(container.querySelector('[data-asset-slot="player"]')).toBe(player)
    expect(player.querySelector('img')).toBe(image)
    const left = Math.round((visualPosition.col - 0.3) * cellSize * 100) / 100
    const top = Math.round((visualPosition.row - 0.3) * cellSize * 100) / 100
    expect(player.style.translate).toBe(`${left}px ${top}px`)
    expect(left + (1.6 * cellSize) / 2).toBe((visualPosition.col + 0.5) * cellSize)
    expect(top + (1.6 * cellSize) / 2).toBe((visualPosition.row + 0.5) * cellSize)
  })

  it('keeps the same element, size, and position when repeatedly blocked by a lower wall', () => {
    vi.useFakeTimers()
    try {
      const initial = stateFor(1, 15)
      const cell = initial.maze.cells.flat().find((candidate) => candidate.walls.bottom)!
      const state = {
        ...initial,
        player: { row: cell.row * 2 + 1, col: cell.col * 2 + 1 },
        playerFacing: 'down' as const,
        status: 'playing' as const,
      }
      const { container, rerender } = render(<MazeBoard state={state} onMove={vi.fn()} />)
      const blocked = gameReducer(state, { type: 'MOVE', direction: 'down' })
      expect(blocked.player).toEqual(state.player)

      const player = container.querySelector<HTMLElement>('[data-asset-slot="player"]')!
      const image = player.querySelector('img')!
      const initialSize = player.style.getPropertyValue('--sprite-size')
      const initialTranslate = player.style.translate
      rerender(<MazeBoard state={blocked} onMove={vi.fn()} movementAttempt={1} />)
      expect(player).toHaveAttribute('data-motion', 'walk')
      expect(player).toHaveAttribute('data-facing', 'down')
      expect(image).toHaveAttribute('src', '/assets/players/player-girl-front-walk-a.png')
      expect(player.style.getPropertyValue('--sprite-size')).toBe(initialSize)
      expect(player.style.translate).toBe(initialTranslate)

      act(() => vi.advanceTimersByTime(55))
      expect(image).toHaveAttribute('src', '/assets/players/player-girl-front-walk-b.png')
      rerender(<MazeBoard state={blocked} onMove={vi.fn()} movementAttempt={2} />)
      expect(container.querySelector('[data-asset-slot="player"]')).toBe(player)
      expect(player.querySelector('img')).toBe(image)
      expect(player).toHaveAttribute('data-motion', 'walk')
      expect(image).toHaveAttribute('src', '/assets/players/player-girl-front-walk-b.png')
      expect(player.style.getPropertyValue('--sprite-size')).toBe(initialSize)
      expect(player.style.translate).toBe(initialTranslate)
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
      const moved = gameReducer(state, { type: 'MOVE', direction: 'up' })
      rerender(<MazeBoard state={moved} onMove={vi.fn()} movementAttempt={1} />)
      const player = container.querySelector('[data-asset-slot="player"]')!
      expect(player).toHaveAttribute('data-motion', 'none')
      expect(player).toHaveAttribute('data-facing', 'up')
      expect(player.querySelector('img')).toHaveAttribute('src', '/assets/players/player-girl-back.png')
      expect(player.querySelector('[data-turn-previous]')).toBeNull()
    } finally {
      window.matchMedia = original
    }
  })
})
