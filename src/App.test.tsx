import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import { ApiClientError, getLeaderboard, getSession, startRun } from './api/client'
import type { SessionDto } from './api/contracts'
import { App } from './App'
import { accountSaveKey, loadAccountSave } from './persistence/accountSaveStore'
import { saveSave } from './persistence/saveStore'
import { SAVE_VERSION } from './persistence/saveSchema'

vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>()
  return { ...actual, getSession: vi.fn(), getLeaderboard: vi.fn(), startRun: vi.fn(), logout: vi.fn() }
})

const account: SessionDto = {
  user: { id: 'user-1', authType: 'simple', displayName: '테스터' },
  progress: { unlockedStage: 1, stageRecords: {} },
}
const attemptId = '01234567-89ab-4cde-8fab-0123456789ab'
const mockedGetSession = vi.mocked(getSession)
const mockedGetLeaderboard = vi.mocked(getLeaderboard)
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
    mockedGetLeaderboard.mockResolvedValue({ top: [], current: null })
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
    expect(screen.queryByRole('heading', { name: '단계 선택' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '간편 계정 랭킹' })).not.toBeInTheDocument()
  })

  it('keeps stage selection open when the start request fails', async () => {
    mockedStartRun.mockRejectedValue(new ApiClientError(503, 'unavailable', '서버 오류'))
    await renderAccount()
    fireEvent.click(screen.getByRole('button', { name: '1단계 도전 가능' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('새 도전을 시작하지 못했어요')
    expect(screen.getByRole('heading', { name: '단계 선택' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '간편 계정 랭킹' })).toBeInTheDocument()
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

  it('groups the title beside the display name and logout', async () => {
    await renderAccount()
    const header = screen.getByRole('heading', { name: '동물 구출 대작전' }).closest('header')
    expect(header).not.toBeNull()
    const title = header!.querySelector('.header-title')
    const toolbar = header!.querySelector('.account-toolbar')
    expect(title).not.toBeNull()
    expect(toolbar).not.toBeNull()
    expect(title?.nextElementSibling).toBe(toolbar)
    expect(within(title as HTMLElement).getByText('동물들을 구하러 탐험을 떠나자!')).toBeInTheDocument()
    expect(within(header!).getByText('테스터')).toBeInTheDocument()
    expect(within(header!).getByRole('button', { name: '로그아웃' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '로그아웃' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: '진행 새로고침' })).not.toBeInTheDocument()
  })

  it('shows the simple leaderboard beside stage selection without navigation buttons', async () => {
    mockedGetLeaderboard.mockResolvedValue({
      top: [{ rank: 2, userId: account.user.id, displayName: '테스터',
        highestStage: 3, bestTimeSeconds: 80 }],
      current: { rank: 2, userId: account.user.id, displayName: '테스터',
        highestStage: 3, bestTimeSeconds: 80 },
    })
    await renderAccount()
    expect(await screen.findByRole('heading', { name: '간편 계정 랭킹' })).toBeInTheDocument()
    const myRecord = await screen.findByRole('list', { name: '내 기록' })
    expect(myRecord).toHaveTextContent('2위테스터3단계최단 01:20')
    expect(screen.getByRole('heading', { name: '단계 선택' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '랭킹 보기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '단계 선택으로 돌아가기' })).not.toBeInTheDocument()
    expect(mockedGetLeaderboard).toHaveBeenCalledExactlyOnceWith()
    expect(screen.getByTestId('leaderboard-pane').compareDocumentPosition(screen.getByTestId('stages-pane')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows the signed-in nickname above empty leaderboard slots', async () => {
    await renderAccount()
    const myRecord = await screen.findByRole('list', { name: '내 기록' })
    expect(myRecord).toHaveTextContent('순위 없음테스터기록 없음')
    const slots = within(screen.getByRole('list', { name: '상위 100명 랭킹' })).getAllByRole('listitem')
    expect(slots).toHaveLength(10)
    expect(slots[0]).toHaveAttribute('aria-label', '1위 기록 없음')
    expect(slots[9]).toHaveAttribute('aria-label', '10위 기록 없음')
  })

  it('defaults to stages and switches mobile tabs without refetching the ranking', async () => {
    await renderAccount()
    await waitFor(() => expect(mockedGetLeaderboard).toHaveBeenCalledTimes(1))
    const workspace = screen.getByTestId('campaign-workspace')
    const tabs = screen.getByRole('group', { name: '화면 선택' })
    const stages = within(tabs).getByRole('button', { name: '단계 선택' })
    const leaderboard = within(tabs).getByRole('button', { name: '랭킹' })

    expect(workspace).toHaveAttribute('data-active-tab', 'stages')
    expect(stages).toHaveAttribute('aria-pressed', 'true')
    expect(leaderboard).toHaveAttribute('aria-pressed', 'false')
    expect(stages).toHaveAttribute('aria-controls', 'campaign-stages-panel')
    expect(leaderboard).toHaveAttribute('aria-controls', 'campaign-leaderboard-panel')

    fireEvent.click(leaderboard)
    expect(workspace).toHaveAttribute('data-active-tab', 'leaderboard')
    expect(stages).toHaveAttribute('aria-pressed', 'false')
    expect(leaderboard).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('stages-pane')).toBeInTheDocument()
    expect(screen.getByTestId('leaderboard-pane')).toBeInTheDocument()

    fireEvent.click(stages)
    expect(workspace).toHaveAttribute('data-active-tab', 'stages')
    expect(mockedGetLeaderboard).toHaveBeenCalledTimes(1)
  })

  it('fetches the ranking again after leaving a game', async () => {
    await renderAccount()
    await waitFor(() => expect(mockedGetLeaderboard).toHaveBeenCalledTimes(1))
    fireEvent.click(within(screen.getByRole('group', { name: '화면 선택' })).getByRole('button', { name: '랭킹' }))
    expect(screen.getByTestId('campaign-workspace')).toHaveAttribute('data-active-tab', 'leaderboard')
    fireEvent.click(within(screen.getByRole('group', { name: '화면 선택' })).getByRole('button', { name: '단계 선택' }))
    fireEvent.click(screen.getByRole('button', { name: '1단계 도전 가능' }))
    await screen.findByTestId('intro-overlay')
    expect(screen.queryByRole('group', { name: '화면 선택' })).not.toBeInTheDocument()
    const pause = screen.getByRole('button', { name: '잠깐 쉬기' })
    await waitFor(() => expect(pause).toBeEnabled(), { timeout: 7500 })
    fireEvent.click(pause)
    fireEvent.click(screen.getByRole('button', { name: '게임 버리고 단계 선택' }))
    expect(await screen.findByRole('heading', { name: '단계 선택' })).toBeInTheDocument()
    expect(screen.getByTestId('campaign-workspace')).toHaveAttribute('data-active-tab', 'stages')
    await waitFor(() => expect(mockedGetLeaderboard).toHaveBeenCalledTimes(2))
  }, 12000)

  it('shows the Microsoft ranking only on its matching authenticated route', async () => {
    window.history.replaceState({}, '', '/microsoft')
    mockedGetSession.mockResolvedValue({ ...account, user: {
      id: 'microsoft-user', authType: 'microsoft', displayName: 'Microsoft 사용자',
    } })
    render(<App />)
    await screen.findByRole('heading', { name: '단계 선택' })
    expect(await screen.findByRole('heading', { name: 'Microsoft 랭킹' })).toBeInTheDocument()
    expect(screen.getByText(/실명일 수 있어요/)).toBeInTheDocument()
    expect(mockedGetLeaderboard).toHaveBeenCalledExactlyOnceWith()
  })

  it('closes the leaderboard when its request finds an expired session', async () => {
    const request = deferred<Awaited<ReturnType<typeof getLeaderboard>>>()
    mockedGetLeaderboard.mockReturnValue(request.promise)
    await renderAccount()
    mockedGetSession.mockRejectedValue(new ApiClientError(401, 'unauthorized', '로그인 필요'))
    await act(async () => request.reject(new ApiClientError(401, 'unauthorized', '로그인 필요')))
    expect(await screen.findByRole('heading', { name: '간편 로그인' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '간편 계정 랭킹' })).not.toBeInTheDocument()
  })
})
