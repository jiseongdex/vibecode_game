import { fireEvent, render, screen } from '@testing-library/react'

import { createGameState } from '../../game/gameState'
import { createSeededRandom, generateMaze } from '../../game/mazeGenerator'
import { MazeBoard } from './MazeBoard'

function stateFor(stage: number, size: number) {
  return createGameState(stage, generateMaze(size, createSeededRandom(stage)))
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
    }} onMove={vi.fn()} />)
    const follower = container.querySelector('[data-asset-slot="follower"]')
    expect(follower).toHaveAttribute('data-animal', '강아지')
    expect(follower?.querySelector('img')).toHaveAttribute('src', '/assets/rescue-dog.png')
  })

  it('keeps emoji fallback visible when a local image fails to load', () => {
    const { container } = render(<MazeBoard state={stateFor(1, 15)} onMove={vi.fn()} />)
    const image = container.querySelector('[data-asset-slot="player"] img')!
    fireEvent.error(image)
    expect(image).toHaveAttribute('hidden')
    expect(container.querySelector('[data-asset-slot="player"]')).toHaveTextContent('🧙‍♀️')
  })
})
