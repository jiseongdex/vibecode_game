import { fireEvent, render, screen } from '@testing-library/react'

import { DirectionControls } from './DirectionControls'

describe('DirectionControls', () => {
  it('provides labelled buttons that move once per pointer or touch activation', () => {
    const onMove = vi.fn()
    render(<DirectionControls onMove={onMove} />)

    const up = screen.getByRole('button', { name: '위로 이동' })
    const right = screen.getByRole('button', { name: '오른쪽으로 이동' })
    const down = screen.getByRole('button', { name: '아래로 이동' })
    const left = screen.getByRole('button', { name: '왼쪽으로 이동' })
    for (const button of [up, right, down, left]) {
      expect(button).toHaveAttribute('type', 'button')
    }

    fireEvent.pointerDown(up)
    fireEvent.click(up)
    fireEvent.touchStart(right)
    fireEvent.click(right)
    fireEvent.click(down)
    fireEvent.click(left)

    expect(onMove.mock.calls).toEqual([
      ['up'],
      ['right'],
      ['down'],
      ['left'],
    ])
  })

  it('blocks every direction while disabled', () => {
    const onMove = vi.fn()
    render(<DirectionControls disabled onMove={onMove} />)

    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled()
      fireEvent.click(button)
    }
    expect(onMove).not.toHaveBeenCalled()
  })
})
