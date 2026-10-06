import { act, fireEvent, render, screen } from '@testing-library/react'

import { createGameState } from '../../game/gameState'
import type { GameState } from '../../game/gameState'
import { createSeededRandom, generateMaze } from '../../game/mazeGenerator'
import { isWalkableGridPosition } from '../../game/mazeGrid'
import { getStageConfig } from '../../game/stageConfig'
import type { Direction, Maze, Position } from '../../game/types'
import { formatTime } from '../Hud/GameHud'
import { GameScreen } from './GameScreen'

function advanceIntro() {
  act(() => vi.advanceTimersByTime(3000))
  for (let count = 0; count < 3; count += 1) {
    act(() => vi.advanceTimersByTime(1000))
  }
}

const movementOffsets: Record<Direction, Position> = {
  up: { row: -1, col: 0 },
  right: { row: 0, col: 1 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
}

function step(position: Position, direction: Direction): Position {
  return {
    row: position.row + movementOffsets[direction].row,
    col: position.col + movementOffsets[direction].col,
  }
}

function findOneTileCorner(maze: Maze) {
  const directions: Direction[] = ['up', 'right', 'down', 'left']
  for (let row = 1; row < maze.size * 2; row += 1) {
    for (let col = 1; col < maze.size * 2; col += 1) {
      const start = { row, col }
      if (!isWalkableGridPosition(maze, start)) continue
      for (const approach of directions) {
        const beforeEntry = step(start, approach)
        const entry = step(beforeEntry, approach)
        if (!isWalkableGridPosition(maze, beforeEntry) || !isWalkableGridPosition(maze, entry)) continue
        for (const turn of directions) {
          if (
            movementOffsets[approach].row === movementOffsets[turn].row ||
            movementOffsets[approach].col === movementOffsets[turn].col
          ) continue
          const target = step(entry, turn)
          if (
            !isWalkableGridPosition(maze, step(beforeEntry, turn)) &&
            isWalkableGridPosition(maze, target)
          ) return { start, beforeEntry, entry, target, approach, turn }
        }
      }
    }
  }
  throw new Error('No one-tile corner found in deterministic maze.')
}

function expectPlayerAt(position: Position) {
  const player = document.querySelector('[data-asset-slot="player"]')
  expect(player).toHaveAttribute('data-grid-row', String(position.row))
  expect(player).toHaveAttribute('data-grid-col', String(position.col))
}

function besideRescue(base: GameState, rescueIndex: number) {
  const target = base.rescues[rescueIndex]
  const directions: Direction[] = ['up', 'right', 'down', 'left']
  for (const direction of directions) {
    const player = {
      row: target.row - movementOffsets[direction].row,
      col: target.col - movementOffsets[direction].col,
    }
    if (isWalkableGridPosition(base.maze, player)) {
      return { player, direction }
    }
  }
  throw new Error('Rescue target has no walkable neighbor.')
}

const arrowFor: Record<Direction, string> = {
  up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft',
}
const oppositeDirection: Record<Direction, Direction> = {
  up: 'down', right: 'left', down: 'up', left: 'right',
}

describe('GameScreen', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shows the last-rescue notice for exactly 1.5 seconds while the game keeps ticking', () => {
    vi.useFakeTimers()
    const base = createGameState(1, generateMaze(15, createSeededRandom(42)))
    const { player, direction } = besideRescue(base, 0)
    const onStateChange = vi.fn()
    render(<GameScreen initialState={{ ...base, player, status: 'playing' }} onStateChange={onStateChange} />)

    fireEvent.keyDown(window, { key: arrowFor[direction], code: arrowFor[direction] })
    fireEvent.keyUp(window, { key: arrowFor[direction], code: arrowFor[direction] })
    expect(screen.getByTestId('rescue-notice')).toHaveTextContent('동물 구출 완료! 탈출구를 찾자')
    expect(screen.getByTestId('rescue-notice').parentElement).toBe(screen.getByTestId('playfield'))
    expect(screen.getByRole('button', { name: '잠깐 쉬기' })).toBeEnabled()
    const returnArrow = arrowFor[oppositeDirection[direction]]
    fireEvent.keyDown(window, { key: returnArrow, code: returnArrow })
    fireEvent.keyUp(window, { key: returnArrow, code: returnArrow })
    expectPlayerAt(player)
    expect(screen.getByTestId('rescue-notice')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1000))
    expect(onStateChange.mock.lastCall?.[0].remainingSeconds).toBe(base.remainingSeconds - 1)
    expect(screen.getByTestId('rescue-notice')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(499))
    expect(screen.getByTestId('rescue-notice')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByTestId('rescue-notice')).not.toBeInTheDocument()
  })

  it('waits until every animal is rescued and clears the notice on pause', () => {
    vi.useFakeTimers()
    const base = createGameState(5, generateMaze(getStageConfig(5).size, createSeededRandom(43)))
    expect(base.rescues).toHaveLength(2)
    const first = besideRescue(base, 0)
    const firstRun = render(<GameScreen initialState={{ ...base, player: first.player, status: 'playing' }} />)
    fireEvent.keyDown(window, { key: arrowFor[first.direction], code: arrowFor[first.direction] })
    fireEvent.keyUp(window, { key: arrowFor[first.direction], code: arrowFor[first.direction] })
    expect(screen.queryByTestId('rescue-notice')).not.toBeInTheDocument()
    firstRun.unmount()

    const second = besideRescue(base, 1)
    render(<GameScreen initialState={{
      ...base,
      player: second.player,
      status: 'playing',
      rescues: base.rescues.map((target, index) => ({ ...target, rescued: index === 0 })),
    }} />)
    expect(screen.queryByTestId('rescue-notice')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: arrowFor[second.direction], code: arrowFor[second.direction] })
    fireEvent.keyUp(window, { key: arrowFor[second.direction], code: arrowFor[second.direction] })
    expect(screen.getByTestId('rescue-notice')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '잠깐 쉬기' }))
    expect(screen.queryByTestId('rescue-notice')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(2000))
    expect(screen.queryByTestId('rescue-notice')).not.toBeInTheDocument()
  })

  it('does not replay the notice for a restored game with all animals rescued', () => {
    vi.useFakeTimers()
    const base = createGameState(1, generateMaze(15, createSeededRandom(44)))
    render(<GameScreen initialState={{
      ...base,
      status: 'playing',
      rescues: base.rescues.map((target) => ({ ...target, rescued: true })),
    }} />)
    expect(screen.queryByTestId('rescue-notice')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(2000))
    expect(screen.queryByTestId('rescue-notice')).not.toBeInTheDocument()
  })

  it('fits the frame to both width and remaining height without resetting the game', () => {
    vi.useFakeTimers()
    vi.stubGlobal('ResizeObserver', undefined)
    vi.stubGlobal('innerHeight', 900)
    let width = 1408
    const originalMeasure = HTMLElement.prototype.getBoundingClientRect
    const measure = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.className?.includes?.('playfieldArea')) {
        return {
          width, height: 0, top: 86, left: 0, right: width, bottom: 86,
          x: 0, y: 86, toJSON: () => ({}),
        }
      }
      if (this.className?.includes?.('controlsArea')) {
        return {
          width: 0, height: 50, top: 0, left: 0, right: 0, bottom: 50,
          x: 0, y: 0, toJSON: () => ({}),
        }
      }
      if (this.className?.includes?.('screen')) {
        return {
          width: 0, height: 900, top: 0, left: 0, right: 0, bottom: 900,
          x: 0, y: 0, toJSON: () => ({}),
        }
      }
      return originalMeasure.call(this)
    })

    try {
      const initialState = createGameState(1, generateMaze(15, createSeededRandom(123)))
      const onStateChange = vi.fn()
      const { container } = render(<GameScreen initialState={initialState} onStateChange={onStateChange} />)
      const gameScreen = container.firstElementChild as HTMLElement
      gameScreen.style.paddingBottom = '8px'
      fireEvent(window, new Event('resize'))
      const frame = screen.getByTestId('playfield')
      const board = screen.getByTestId('maze-board')
      expect(Number.parseFloat(frame.style.width)).toBeCloseTo(1250 * 756 / 850)
      expect(frame.style.height).toBe('756px')
      expect(Number.parseFloat(board.style.getPropertyValue('--cell-size'))).toBeCloseTo(80 * 756 / 850)

      advanceIntro()
      width = 625
      fireEvent(window, new Event('resize'))
      expect(frame.style.width).toBe('625px')
      expect(frame.style.height).toBe('425px')
      expect(board.style.getPropertyValue('--cell-size')).toBe('40px')
      expect(screen.getByRole('button', { name: '잠깐 쉬기' })).toBeEnabled()

      const opening = initialState.maze.cells[0][0].walls.right ? 'ArrowDown' : 'ArrowRight'
      fireEvent.keyDown(window, { key: opening })
      expect(document.querySelector('[data-asset-slot="player"]')).toHaveAttribute(
        'data-grid-row', opening === 'ArrowDown' ? '2' : '1',
      )

      const player = document.querySelector<HTMLElement>('[data-asset-slot="player"]')!
      const position = [player.dataset.gridRow, player.dataset.gridCol]
      const stateChanges = onStateChange.mock.calls.length
      width = 1600
      vi.stubGlobal('innerHeight', 1100)
      fireEvent(window, new Event('resize'))
      expect(Number.parseFloat(frame.style.width)).toBeCloseTo(1250 * 956 / 850)
      expect(frame.style.height).toBe('956px')
      expect(Number.parseFloat(board.style.getPropertyValue('--cell-size'))).toBeCloseTo(80 * 956 / 850)
      expect([player.dataset.gridRow, player.dataset.gridCol]).toEqual(position)
      expect(onStateChange).toHaveBeenCalledTimes(stateChanges)

      vi.stubGlobal('innerHeight', 650)
      fireEvent(window, new Event('resize'))
      expect(Number.parseFloat(frame.style.width)).toBeCloseTo(1250 * 506 / 850)
      expect(Number.parseFloat(frame.style.height)).toBeCloseTo(506)
      expect(onStateChange).toHaveBeenCalledTimes(stateChanges)
    } finally {
      measure.mockRestore()
    }
  })

  it('shares movement between keyboard and buttons without a movement counter', () => {
    vi.useFakeTimers()
    const initialState = createGameState(1, generateMaze(15, createSeededRandom(123)))
    render(<GameScreen initialState={initialState} />)

    const opening: Direction = initialState.maze.cells[0][0].walls.right
      ? 'down'
      : 'right'
    const returnDirection = opening === 'right' ? 'left' : 'up'
    const arrow = opening === 'right' ? 'ArrowRight' : 'ArrowDown'
    const returnButton =
      returnDirection === 'left' ? '왼쪽으로 이동' : '위로 이동'

    for (const button of screen.getAllByRole('button', { name: /이동/ })) {
      expect(button).toBeDisabled()
    }
    advanceIntro()
    fireEvent.keyDown(window, { key: arrow })
    const playerSprite = document.querySelector<HTMLElement>('[data-asset-slot="player"]')!
    const cellSize = Number.parseInt(
      screen.getByTestId('maze-board').style.getPropertyValue('--cell-size'),
      10,
    )
    const expectedRow = opening === 'down' ? 2 : 1
    const expectedCol = opening === 'down' ? 1 : 2
    expect(playerSprite).toHaveAttribute('data-grid-row', opening === 'down' ? '2' : '1')
    expect(playerSprite).toHaveAttribute('data-grid-col', opening === 'down' ? '1' : '2')
    expect(playerSprite.style.translate).toBe(
      `${Math.round((expectedCol - 0.3) * cellSize * 100) / 100}px ${Math.round((expectedRow - 0.3) * cellSize * 100) / 100}px`,
    )
    fireEvent.keyDown(window, { key: arrow, repeat: true })
    expect(document.querySelector('[data-asset-slot="player"]')).toHaveAttribute('data-motion', 'walk')
    const repeatedPosition = playerSprite.style.translate
    fireEvent.keyUp(window, { key: arrow })
    act(() => vi.advanceTimersByTime(200))
    const playerAfterRelease = document.querySelector<HTMLElement>('[data-asset-slot="player"]')!
    expect(playerAfterRelease.style.translate).toBe(repeatedPosition)

    fireEvent.click(screen.getByRole('button', { name: returnButton }))

    act(() => vi.advanceTimersByTime(1000))
    expect(
      screen.getByText(`남은 시간: ${formatTime(initialState.remainingSeconds - 1)}`),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '잠깐 쉬기' }))
    act(() => vi.advanceTimersByTime(2000))
    expect(
      screen.getByText(`남은 시간: ${formatTime(initialState.remainingSeconds - 1)}`),
    ).toBeInTheDocument()
    fireEvent.keyDown(window, { key: arrow })

    fireEvent.click(screen.getByRole('button', { name: '이어하기' }))
    act(() => vi.advanceTimersByTime(1000))
    expect(
      screen.getByText(`남은 시간: ${formatTime(initialState.remainingSeconds - 2)}`),
    ).toBeInTheDocument()
  })

  it('turns through a one-tile opening with two held keys and keeps button movement direct', () => {
    vi.useFakeTimers()
    const base = createGameState(1, generateMaze(15, createSeededRandom(321)))
    const corner = findOneTileCorner(base.maze)
    const keyFor: Record<Direction, string> = {
      up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft',
    }
    const reverse: Record<Direction, Direction> = {
      up: 'down', right: 'left', down: 'up', left: 'right',
    }
    const buttonFor: Record<Direction, string> = {
      up: '위로 이동', right: '오른쪽으로 이동',
      down: '아래로 이동', left: '왼쪽으로 이동',
    }

    render(<GameScreen initialState={{
      ...base,
      player: corner.start,
      status: 'playing',
      startedAt: 0,
    }} />)

    fireEvent.keyDown(window, { key: keyFor[corner.approach], code: keyFor[corner.approach] })
    expectPlayerAt(corner.beforeEntry)
    fireEvent.keyDown(window, { key: keyFor[corner.turn], code: keyFor[corner.turn] })
    expectPlayerAt(corner.beforeEntry)

    act(() => vi.advanceTimersByTime(110))
    expectPlayerAt(corner.entry)
    act(() => vi.advanceTimersByTime(110))
    expectPlayerAt(corner.target)

    fireEvent.keyUp(window, { key: keyFor[corner.turn], code: keyFor[corner.turn] })
    fireEvent.keyUp(window, { key: keyFor[corner.approach], code: keyFor[corner.approach] })
    act(() => vi.advanceTimersByTime(110))
    expectPlayerAt(corner.target)

    fireEvent.click(screen.getByRole('button', { name: buttonFor[reverse[corner.turn]] }))
    expectPlayerAt(corner.entry)
  })

  it('walks in place while a blocked key is held and stops on release, blur, or pause', () => {
    vi.useFakeTimers()
    const initialState = createGameState(1, generateMaze(15, createSeededRandom(123)))
    render(<GameScreen initialState={initialState} />)
    advanceIntro()

    const player = document.querySelector<HTMLElement>('[data-asset-slot="player"]')!
    const image = player.querySelector('img')!
    const startPosition = player.style.translate
    fireEvent.keyDown(window, { key: 'ArrowUp', code: 'ArrowUp' })
    expect(player).toHaveAttribute('data-motion', 'walk')
    expect(image).toHaveAttribute('src', '/assets/players/player-girl-back-walk-a.png')
    act(() => vi.advanceTimersByTime(110))
    expect(player).toHaveAttribute('data-motion', 'walk')
    expect(image).toHaveAttribute('src', '/assets/players/player-girl-back-walk-b.png')
    expect(player.style.translate).toBe(startPosition)

    fireEvent.keyUp(window, { key: 'ArrowUp', code: 'ArrowUp' })
    expect(player).toHaveAttribute('data-motion', 'none')
    expect(image).toHaveAttribute('src', '/assets/players/player-girl-back.png')

    fireEvent.keyDown(window, { key: 'ArrowUp', code: 'ArrowUp' })
    expect(player).toHaveAttribute('data-motion', 'walk')
    fireEvent.blur(window)
    expect(player).toHaveAttribute('data-motion', 'none')

    fireEvent.click(screen.getByRole('button', { name: '위로 이동' }))
    expect(player).toHaveAttribute('data-motion', 'walk')
    act(() => vi.advanceTimersByTime(110))
    expect(player).toHaveAttribute('data-motion', 'none')

    fireEvent.keyDown(window, { key: 'ArrowUp', code: 'ArrowUp' })
    expect(player).toHaveAttribute('data-motion', 'walk')
    fireEvent.click(screen.getByRole('button', { name: '잠깐 쉬기' }))
    expect(player).toHaveAttribute('data-motion', 'none')
    expect(player.style.translate).toBe(startPosition)
  })

  it.each(['paused', 'won', 'lost'] as const)(
    'disables keyboard and direction buttons when %s',
    (status) => {
      const initialState = {
        ...createGameState(1, generateMaze(15, createSeededRandom(321))),
        status,
      }
      render(<GameScreen initialState={initialState} />)

      for (const button of screen.getAllByRole('button', { name: /이동/ })) {
        expect(button).toBeDisabled()
      }
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      expect(screen.queryByText(/이동:/)).not.toBeInTheDocument()
    },
  )

  it('reports a win once and offers the next stage after saving', async () => {
    let resolveSave!: () => void
    const onStageComplete = vi.fn().mockReturnValue(new Promise<void>((resolve) => { resolveSave = resolve }))
    const onNextStage = vi.fn().mockResolvedValue(undefined)
    const attemptId = '01234567-89ab-4cde-8fab-0123456789ab'
    const base = createGameState(1, generateMaze(15, createSeededRandom(88)))
    const won = {
      ...base,
      status: 'won' as const,
      remainingSeconds: base.remainingSeconds - 45,
      rescues: base.rescues.map((target) => ({ ...target, rescued: true })),
    }
    const { rerender } = render(
      <GameScreen
        initialState={won}
        attemptId={attemptId}
        onStageComplete={onStageComplete}
        onNextStage={onNextStage}
      />,
    )

    expect(onStageComplete).toHaveBeenCalledTimes(1)
    expect(onStageComplete).toHaveBeenCalledWith(1, 45, attemptId)
    expect(screen.getByRole('button', { name: '다음 단계' })).toBeDisabled()
    await act(async () => resolveSave())
    expect(screen.getByText('기록이 저장됐어요.')).toBeInTheDocument()
    rerender(
      <GameScreen
        initialState={won}
        attemptId={attemptId}
        onStageComplete={onStageComplete}
        onNextStage={onNextStage}
      />,
    )
    expect(onStageComplete).toHaveBeenCalledTimes(1)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '다음 단계' })) })
    expect(onNextStage).toHaveBeenCalledWith(2)
  })

  it('keeps a failed result pending and retries the same attempt', async () => {
    const attemptId = '01234567-89ab-4cde-8fab-0123456789ab'
    const base = createGameState(1, generateMaze(15, createSeededRandom(88)))
    let rejectSave!: (error: Error) => void
    let resolveRetry!: () => void
    const onStageComplete = vi.fn()
      .mockReturnValueOnce(new Promise<void>((_, reject) => { rejectSave = reject }))
      .mockReturnValueOnce(new Promise<void>((resolve) => { resolveRetry = resolve }))
    render(<GameScreen initialState={{ ...base, status: 'won', remainingSeconds: base.remainingSeconds - 45 }}
      attemptId={attemptId} onStageComplete={onStageComplete} onNextStage={vi.fn()} />)

    expect(screen.getByRole('button', { name: '다음 단계' })).toBeDisabled()
    await act(async () => rejectSave(new Error('network')))
    expect(screen.getByRole('alert')).toHaveTextContent('기록을 확인하지 못했어요')
    fireEvent.click(screen.getByRole('button', { name: '기록 다시 보내기' }))
    expect(onStageComplete).toHaveBeenCalledTimes(2)
    expect(onStageComplete).toHaveBeenLastCalledWith(1, 45, attemptId)
    await act(async () => resolveRetry())
    expect(screen.getByRole('button', { name: '다음 단계' })).toBeEnabled()
  })

  it('keeps the result visible when starting another server run fails', async () => {
    const base = createGameState(1, generateMaze(15, createSeededRandom(89)))
    const onRetryStage = vi.fn().mockRejectedValue(new Error('network'))
    render(<GameScreen initialState={{ ...base, status: 'lost', remainingSeconds: 0 }}
      onRetryStage={onRetryStage} />)
    fireEvent.click(screen.getByRole('button', { name: '같은 미로 재도전' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('새 도전을 시작하지 못했어요')
    expect(screen.getByRole('dialog', { name: '시간 초과!' })).toBeInTheDocument()
  })

  it('requests a new server run before retrying the same maze', () => {
    vi.useFakeTimers()
    const base = createGameState(1, generateMaze(15, createSeededRandom(89)))
    const onRetryStage = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(
      <GameScreen key="lost" initialState={{ ...base, status: 'lost', remainingSeconds: 0 }}
        onRetryStage={onRetryStage} />,
    )

    expect(screen.getByRole('dialog', { name: '시간 초과!' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '같은 미로 재도전' }))
    expect(onRetryStage).toHaveBeenCalledWith(1, base.maze)
    expect(screen.getByRole('dialog', { name: '시간 초과!' })).toBeInTheDocument()
    rerender(<GameScreen key="retry" initialState={createGameState(1, base.maze)}
      skipIntroMessage onRetryStage={onRetryStage} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('intro-overlay')).toHaveTextContent('3')
    expect(screen.queryByText('동물을 구출해서 탈출해줘!')).not.toBeInTheDocument()
    expect(screen.getByText(`남은 시간: ${formatTime(base.remainingSeconds)}`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '잠깐 쉬기' })).toBeDisabled()
    expect(document.querySelectorAll('[data-asset-slot^="rescue-"]')).toHaveLength(base.rescues.length)
    for (let count = 0; count < 3; count += 1) act(() => vi.advanceTimersByTime(1000))
    expect(screen.queryByTestId('intro-overlay')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '잠깐 쉬기' })).toBeEnabled()
  })

  it('shows the message and each countdown number before starting without moving or ticking', () => {
    vi.useFakeTimers()
    const base = createGameState(1, generateMaze(15, createSeededRandom(123)))
    const onStateChange = vi.fn()
    render(<GameScreen initialState={base} onStateChange={onStateChange} />)

    expect(screen.getByTestId('maze-board')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '시작하기' })).not.toBeInTheDocument()
    expect(screen.getByTestId('intro-overlay')).toHaveTextContent('동물을 구출해서 탈출해줘!')
    const opening = base.maze.cells[0][0].walls.right ? 'ArrowDown' : 'ArrowRight'
    fireEvent.keyDown(window, { key: opening })
    expect(document.querySelector('[data-asset-slot="player"]')).toHaveAttribute('data-grid-row', '1')
    expect(screen.getByRole('button', { name: '잠깐 쉬기' })).toBeDisabled()
    act(() => vi.advanceTimersByTime(2999))
    expect(screen.getByTestId('intro-overlay')).toHaveTextContent('동물을 구출해서 탈출해줘!')
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByTestId('intro-overlay')).toHaveTextContent('3')
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByTestId('intro-overlay')).toHaveTextContent('2')
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByTestId('intro-overlay')).toHaveTextContent('1')
    expect(screen.getByText(`남은 시간: ${formatTime(base.remainingSeconds)}`)).toBeInTheDocument()
    expect(onStateChange.mock.lastCall?.[0].status).toBe('ready')
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.queryByTestId('intro-overlay')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '잠깐 쉬기' })).toBeEnabled()
    expect(onStateChange.mock.lastCall?.[0].status).toBe('playing')
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByText(`남은 시간: ${formatTime(base.remainingSeconds - 1)}`)).toBeInTheDocument()
  })

  it('requests a new server run before starting a different maze', () => {
    vi.useFakeTimers()
    const base = createGameState(1, generateMaze(15, createSeededRandom(89)))
    const onStateChange = vi.fn()
    const onRetryStage = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(<GameScreen key="lost" initialState={{ ...base, status: 'lost', remainingSeconds: 0 }}
      onStateChange={onStateChange} onRetryStage={onRetryStage} />)

    fireEvent.click(screen.getByRole('button', { name: '새 미로로 재시작' }))
    expect(onRetryStage).toHaveBeenCalledWith(1, undefined)
    expect(screen.getByRole('dialog', { name: '시간 초과!' })).toBeInTheDocument()
    const newMaze = generateMaze(15, createSeededRandom(90))
    rerender(<GameScreen key="retry" initialState={createGameState(1, newMaze)}
      onStateChange={onStateChange} skipIntroMessage onRetryStage={onRetryStage} />)
    expect(screen.getByTestId('intro-overlay')).toHaveTextContent('3')
    expect(screen.queryByText('동물을 구출해서 탈출해줘!')).not.toBeInTheDocument()
    expect(onStateChange.mock.lastCall?.[0].maze.seed).toBe(newMaze.seed)
    for (let count = 0; count < 3; count += 1) act(() => vi.advanceTimersByTime(1000))
    expect(onStateChange.mock.lastCall?.[0].status).toBe('playing')
  })

  it('freezes the intro while the tab is hidden and resumes the current step when visible', () => {
    vi.useFakeTimers()
    const original = Object.getOwnPropertyDescriptor(document, 'visibilityState')
    let visibility = 'visible'
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
    try {
      const onStateChange = vi.fn()
      render(<GameScreen onStateChange={onStateChange} />)
      act(() => vi.advanceTimersByTime(3000))
      expect(screen.getByTestId('intro-overlay')).toHaveTextContent('3')
      act(() => vi.advanceTimersByTime(400))
      visibility = 'hidden'
      fireEvent(document, new Event('visibilitychange'))
      act(() => vi.advanceTimersByTime(10000))
      expect(screen.getByTestId('intro-overlay')).toHaveTextContent('3')
      expect(onStateChange.mock.lastCall?.[0].status).toBe('ready')
      visibility = 'visible'
      fireEvent(document, new Event('visibilitychange'))
      act(() => vi.advanceTimersByTime(999))
      expect(screen.getByTestId('intro-overlay')).toHaveTextContent('3')
      act(() => vi.advanceTimersByTime(1))
      act(() => vi.advanceTimersByTime(1000))
      expect(screen.getByTestId('intro-overlay')).toHaveTextContent('1')
      act(() => vi.advanceTimersByTime(1000))
      expect(onStateChange.mock.lastCall?.[0].status).toBe('playing')
    } finally {
      if (original) Object.defineProperty(document, 'visibilityState', original)
      else Reflect.deleteProperty(document, 'visibilityState')
    }
  })
})
