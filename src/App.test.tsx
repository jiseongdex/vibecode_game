import { render, screen } from '@testing-library/react'

import { App } from './App'

describe('App', () => {
  it('renders the game shell', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: '미로 구출대' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('game-container')).toBeInTheDocument()
  })
})
