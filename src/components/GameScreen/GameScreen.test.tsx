import { act, fireEvent, render, screen } from '@testing-library/react'

import { createGameState } from '../../game/gameState'
import { createSeededRandom, generateMaze } from '../../game/mazeGenerator'
import type { Direction } from '../../game/types'
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
    expect(screen.getByText('이동: 1회')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: returnButton }))
    expect(screen.getByText('이동: 2회')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1000))
    expect(
      screen.getByText(`남은 시간: ${initialState.remainingSeconds - 1}초`),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '일시정지' }))
    act(() => vi.advanceTimersByTime(2000))
    expect(
      screen.getByText(`남은 시간: ${initialState.remainingSeconds - 1}초`),
    ).toBeInTheDocument()
    fireEvent.keyDown(window, { key: arrow })
    expect(screen.getByText('이동: 2회')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '이어하기' }))
    act(() => vi.advanceTimersByTime(1000))
    expect(
      screen.getByText(`남은 시간: ${initialState.remainingSeconds - 2}초`),
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
})
