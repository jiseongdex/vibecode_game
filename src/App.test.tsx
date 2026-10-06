import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ApiClientError, getSession, startRun } from './api/client'
import type { SessionDto } from './api/contracts'
import { App } from './App'
import { accountSaveKey, loadAccountSave } from './persistence/accountSaveStore'
import { saveSave } from './persistence/saveStore'
import { SAVE_VERSION } from './persistence/saveSchema'

vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>()
  return { ...actual, getSession: vi.fn(), startRun: vi.fn(), logout: vi.fn() }
})

const account: SessionDto = {
  user: { id: 'user-1', authType: 'simple', displayName: '테스터' },
  progress: { unlockedStage: 1, stageRecords: {} },
}
const attemptId = '01234567-89ab-4cde-8fab-0123456789ab'
const mockedGetSession = vi.mocked(getSession)
const mockedStartRun = vi.mocked(startRun)

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

async function renderAccount(session: SessionDto = account) {
  window.history.replaceState({}, '', '/simple')
  mockedGetSession.mockResolvedValue(session)
  render(<App />)
  await screen.findByRole('heading', { name: '단계 선택' })
}

describe('App authentication and account game', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState({}, '', '/')
    vi.clearAllMocks()
    mockedStartRun.mockResolvedValue({ attemptId, stage: 1, startedAtMs: Date.now() })
  })

  afterEach(() => {
    window.localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('shows only route selection at the root address', () => {
    render(<App />)
    expect(screen.getByRole('link', { name: /Microsoft 계정/ })).toHaveAttribute('href', '/microsoft')
    expect(screen.getByRole('link', { name: /닉네임과 PIN/ })).toHaveAttribute('href', '/simple')
    expect(mockedGetSession).not.toHaveBeenCalled()
    expect(screen.queryByTestId('game-container')).not.toBeInTheDocument()
  })

  it('does not show the game to an anonymous visitor', async () => {
    window.history.replaceState({}, '', '/simple')
    mockedGetSession.mockRejectedValue(new ApiClientError(401, 'unauthorized', '로그인 필요'))
    render(<App />)
    expect(await screen.findByRole('heading', { name: '간편 로그인' })).toBeInTheDocument()
    expect(screen.queryByTestId('game-container')).not.toBeInTheDocument()
  })

  it('blocks a session from the other login route', async () => {
    window.history.replaceState({}, '', '/microsoft')
    mockedGetSession.mockResolvedValue(account)
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('다른 로그인 방식')
    expect(screen.queryByTestId('game-container')).not.toBeInTheDocument()
  })

  it('keeps the gate closed on a session API failure', async () => {
    window.history.replaceState({}, '', '/simple')
    mockedGetSession.mockRejectedValue(new ApiClientError(503, 'unavailable', '서버 오류'))
    render(<App />)
    expect(await screen.findByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    expect(screen.queryByTestId('game-container')).not.toBeInTheDocument()
  })

  it('starts gameplay only after a server attempt is issued', async () => {
    const request = deferred<Awaited<ReturnType<typeof startRun>>>()
    mockedStartRun.mockReturnValue(request.promise)
    await renderAccount()
    fireEvent.click(screen.getByRole('button', { name: '1단계 도전 가능' }))
    expect(mockedStartRun).toHaveBeenCalledWith(1)
    expect(screen.queryByTestId('intro-overlay')).not.toBeInTheDocument()
    await act(async () => request.resolve({ attemptId, stage: 1, startedAtMs: Date.now() }))
    expect(await screen.findByTestId('intro-overlay')).toBeInTheDocument()
  })

  it('keeps stage selection open when the start request fails', async () => {
    mockedStartRun.mockRejectedValue(new ApiClientError(503, 'unavailable', '서버 오류'))
    await renderAccount()
    fireEvent.click(screen.getByRole('button', { name: '1단계 도전 가능' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('새 도전을 시작하지 못했어요')
    expect(screen.getByRole('heading', { name: '단계 선택' })).toBeInTheDocument()
    expect(screen.queryByTestId('intro-overlay')).not.toBeInTheDocument()
  })

  it('uses server progress and ignores the old shared browser save', async () => {
    saveSave({
      version: SAVE_VERSION,
      unlockedStage: 3,
      stageRecords: { 1: { bestTimeSeconds: 20 }, 2: { bestTimeSeconds: 50 } },
      currentSession: null,
    })
    await renderAccount()
    expect(screen.getByRole('button', { name: '2단계 잠김' })).toBeDisabled()
    expect(screen.queryByText('최고 00:20')).not.toBeInTheDocument()
    expect(window.localStorage.getItem(accountSaveKey(account.user.id))).toBeNull()
  })

  it('restores the account paused maze without exposing it to another account', async () => {
    await renderAccount()
    fireEvent.click(screen.getByRole('button', { name: '1단계 도전 가능' }))
    await screen.findByTestId('intro-overlay')
    fireEvent(window, new Event('pagehide'))
    const saved = loadAccountSave(account.user.id, account.progress)
    expect(saved.currentSession?.state.status).toBe('paused')
    expect(saved.attemptId).toBe(attemptId)

    const other: SessionDto = {
      user: { id: 'user-2', authType: 'simple', displayName: '다른 사람' },
      progress: { unlockedStage: 1, stageRecords: {} },
    }
    expect(loadAccountSave(other.user.id, other.progress).currentSession).toBeNull()
  })

  it('refreshes unlocked stages and best times from the server', async () => {
    await renderAccount()
    mockedGetSession.mockResolvedValue({
      ...account,
      progress: { unlockedStage: 2, stageRecords: { 1: { bestTimeSeconds: 80 } } },
    })
    fireEvent.click(screen.getByRole('button', { name: '진행 새로고침' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '2단계 도전 가능' })).toBeEnabled())
    expect(screen.getByText('최고 01:20')).toBeInTheDocument()
  })
})
