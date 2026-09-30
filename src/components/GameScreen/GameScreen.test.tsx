import { act, fireEvent, render, screen } from '@testing-library/react'

import { createGameState } from '../../game/gameState'
import { createSeededRandom, generateMaze } from '../../game/mazeGenerator'
import type { Direction } from '../../game/types'
import { formatTime } from '../Hud/GameHud'
import { GameScreen } from './GameScreen'

describe('GameScreen', () => {
  afterEach(() => vi.useRealTimers())

  it('shares movement between keyboard and buttons, and ticks only while playing', () => {
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
    const playerCell = document.querySelector('[data-asset-slot="player"]')!.parentElement!
    expect(playerCell).toHaveAttribute('data-row', opening === 'down' ? '1' : '0')
    expect(playerCell).toHaveAttribute('data-col', opening === 'right' ? '1' : '0')
    expect(playerCell).toHaveAttribute('data-visual-row', opening === 'down' ? '3' : '1')
    expect(playerCell).toHaveAttribute('data-visual-col', opening === 'right' ? '3' : '1')
    fireEvent.keyDown(window, { key: arrow, repeat: true })
    expect(screen.getByText('이동: 1회')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: returnButton }))
    expect(screen.getByText('이동: 2회')).toBeInTheDocument()

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
    expect(screen.getByText('이동: 2회')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '이어하기' }))
    act(() => vi.advanceTimersByTime(1000))
    expect(
      screen.getByText(`남은 시간: ${formatTime(initialState.remainingSeconds - 2)}`),
    ).toBeInTheDocument()
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
      expect(screen.getByText('이동: 0회')).toBeInTheDocument()
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
      moveCount: 61,
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
    expect(onStageComplete).toHaveBeenCalledWith(1, 45, 61)
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
