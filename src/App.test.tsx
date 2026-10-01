import { act, fireEvent, render, screen } from '@testing-library/react'

import { App } from './App'
import { formatTime } from './components/Hud/GameHud'
import { loadSave, saveSave } from './persistence/saveStore'
import { SAVE_VERSION } from './persistence/saveSchema'

describe('App', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => {
    vi.useRealTimers()
    window.localStorage.clear()
  })

  it('renders the game shell', () => {
    render(<App />)
    expect(document.querySelector('main')).not.toHaveAttribute('data-game-active')

    expect(
      screen.getByRole('heading', { name: '동물 구출 대작전' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('game-container')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2단계 잠김' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '1단계 도전 가능' }))
    expect(document.querySelector('main')).toHaveAttribute('data-game-active', 'true')
    expect(screen.getByRole('button', { name: '시작하기' })).toBeInTheDocument()
  })

  it('sets the explorer on stage selection and hides the picker during a game', () => {
    const { unmount } = render(<App />)
    const girl = screen.getByRole('button', { name: '여자 탐험가' })
    const boy = screen.getByRole('button', { name: '남자 탐험가' })
    expect(girl).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(boy)
    expect(boy).toHaveAttribute('aria-pressed', 'true')
    expect(window.localStorage.getItem('maze-rescue-game.appearance.v1')).toBe('boy')

    unmount()
    render(<App />)
    expect(screen.getByRole('button', { name: '남자 탐험가' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: '1단계 도전 가능' }))
    expect(screen.queryByRole('button', { name: '여자 탐험가' })).toBeNull()
    expect(screen.queryByRole('button', { name: '남자 탐험가' })).toBeNull()
    expect(document.querySelector('[data-asset-slot="player"] img'))
      .toHaveAttribute('src', '/assets/players/player-boy-front.png')
  })

  it('restores the same maze and position in a paused state after leaving', () => {
    const { unmount } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '1단계 도전 가능' }))
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }))

    const startCell = document.querySelector('[data-row="0"][data-col="0"]')
    const direction = startCell?.className.includes('wallRight') ? 'ArrowDown' : 'ArrowRight'
    fireEvent.keyDown(window, { key: direction })

    fireEvent(window, new Event('pagehide'))
    const saved = loadSave().currentSession
    expect(saved?.state.status).toBe('paused')
    expect(saved?.state.player).not.toEqual({ row: 0, col: 0 })
    const savedMaze = saved?.state.maze
    const remaining = saved?.state.remainingSeconds
    unmount()

    render(<App />)
    expect(screen.getByRole('dialog', { name: '일시정지' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '탐험가' })).toHaveAttribute(
      'data-grid-row',
      String(saved?.state.player.row),
    )
    expect(screen.getByRole('img', { name: '탐험가' })).toHaveAttribute(
      'data-grid-col',
      String(saved?.state.player.col),
    )
    expect(loadSave().currentSession?.state.maze).toEqual(savedMaze)
    expect(loadSave().currentSession?.state.remainingSeconds).toBe(remaining)

    fireEvent.click(screen.getByRole('button', { name: '이어하기' }))
    expect(screen.queryByRole('dialog', { name: '일시정지' })).toBeNull()
  })

  it('can discard a restored session without losing campaign records', () => {
    const { unmount } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '1단계 도전 가능' }))
    fireEvent(window, new Event('pagehide'))
    unmount()

    render(<App />)
    expect(screen.getByRole('button', { name: '게임 버리고 단계 선택' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '게임 버리고 단계 선택' }))
    expect(document.querySelector('main')).not.toHaveAttribute('data-game-active')
    expect(screen.getByRole('button', { name: '1단계 도전 가능' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '여자 탐험가' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '남자 탐험가' })).toBeInTheDocument()
    expect(loadSave().currentSession).toBeNull()
  })

  it('saves a new session after the debounce interval', () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '1단계 도전 가능' }))

    expect(loadSave().currentSession).toBeNull()
    act(() => vi.advanceTimersByTime(250))
    expect(loadSave().currentSession?.state.status).toBe('paused')
    expect(loadSave().currentSession?.state.stageConfig.stage).toBe(1)
  })

  it('restores unlocked stages and best records on startup', () => {
    saveSave({
      version: SAVE_VERSION,
      unlockedStage: 2,
      stageRecords: { 1: { bestTimeSeconds: 80 } },
      currentSession: null,
    })
    render(<App />)

    expect(screen.getByRole('button', { name: '2단계 도전 가능' })).toBeEnabled()
    expect(screen.getByText('최고 01:20')).toBeInTheDocument()
  })

  it('pauses on a hidden tab and waits for an explicit resume', () => {
    vi.useFakeTimers()
    const original = Object.getOwnPropertyDescriptor(document, 'visibilityState')
    let visibility = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    })

    try {
      render(<App />)
      fireEvent.click(screen.getByRole('button', { name: '1단계 도전 가능' }))
      fireEvent.click(screen.getByRole('button', { name: '시작하기' }))
      act(() => vi.advanceTimersByTime(1000))

      visibility = 'hidden'
      fireEvent(document, new Event('visibilitychange'))
      const savedTime = loadSave().currentSession?.state.remainingSeconds
      expect(screen.getByRole('dialog', { name: '일시정지' })).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(5000))
      expect(screen.getByText(`남은 시간: ${formatTime(savedTime ?? 0)}`)).toBeInTheDocument()

      visibility = 'visible'
      fireEvent(document, new Event('visibilitychange'))
      expect(screen.getByRole('dialog', { name: '일시정지' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '이어하기' }))
      expect(screen.queryByRole('dialog')).toBeNull()
    } finally {
      if (original) Object.defineProperty(document, 'visibilityState', original)
      else Reflect.deleteProperty(document, 'visibilityState')
    }
  })
})
