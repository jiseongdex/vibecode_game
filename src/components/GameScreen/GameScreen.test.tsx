import { act, fireEvent, render, screen } from '@testing-library/react'

import { createGameState } from '../../game/gameState'
import { createSeededRandom, generateMaze } from '../../game/mazeGenerator'
import type { Direction } from '../../game/types'
import { formatTime } from '../Hud/GameHud'
import { GameScreen } from './GameScreen'

describe('GameScreen', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('fits the frame to both width and remaining height without resetting the game', () => {
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
      expect(Number.parseFloat(board.style.getPropertyValue('--cell-size'))).toBeCloseTo(120 * 756 / 850)

      fireEvent.click(screen.getByRole('button', { name: '시작하기' }))
      width = 625
      fireEvent(window, new Event('resize'))
      expect(frame.style.width).toBe('625px')
      expect(frame.style.height).toBe('425px')
      expect(board.style.getPropertyValue('--cell-size')).toBe('60px')
      expect(screen.getByRole('button', { name: '일시정지' })).toBeEnabled()

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
      expect(Number.parseFloat(board.style.getPropertyValue('--cell-size'))).toBeCloseTo(120 * 956 / 850)
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
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }))
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

    fireEvent.click(screen.getByRole('button', { name: '일시정지' }))
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

  it('walks in place while a blocked key is held and stops on release, blur, or pause', () => {
    vi.useFakeTimers()
    const initialState = createGameState(1, generateMaze(15, createSeededRandom(123)))
    render(<GameScreen initialState={initialState} />)
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }))

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
    fireEvent.click(screen.getByRole('button', { name: '일시정지' }))
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

  it('reports a win once and offers the next stage', () => {
    const onStageComplete = vi.fn()
    const onNextStage = vi.fn()
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
        onStageComplete={onStageComplete}
        onNextStage={onNextStage}
      />,
    )

    expect(onStageComplete).toHaveBeenCalledTimes(1)
    expect(onStageComplete).toHaveBeenCalledWith(1, 45)
    rerender(
      <GameScreen
        initialState={won}
        onStageComplete={onStageComplete}
        onNextStage={onNextStage}
      />,
    )
    expect(onStageComplete).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }))
    expect(onNextStage).toHaveBeenCalledWith(2)
  })

  it('returns to the ready state after choosing a timeout retry', () => {
    const base = createGameState(1, generateMaze(15, createSeededRandom(89)))
    render(
      <GameScreen initialState={{ ...base, status: 'lost', remainingSeconds: 0 }} />,
    )

    expect(screen.getByRole('dialog', { name: '시간 초과!' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '같은 미로 재도전' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: '시작하기' })).toBeInTheDocument()
    expect(screen.getByText(`남은 시간: ${formatTime(base.remainingSeconds)}`)).toBeInTheDocument()
  })
})
