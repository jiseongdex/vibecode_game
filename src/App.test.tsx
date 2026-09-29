import { fireEvent, render, screen } from '@testing-library/react'

import { App } from './App'

describe('App', () => {
  it('renders the game shell', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: '미로 구출대' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('game-container')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2단계 잠김' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '1단계 도전 가능' }))
    expect(screen.getByRole('button', { name: '시작하기' })).toBeInTheDocument()
  })
})
