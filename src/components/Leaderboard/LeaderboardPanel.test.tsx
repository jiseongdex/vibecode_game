import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import { ApiClientError, getLeaderboard } from '../../api/client'
import type { LeaderboardDto, LeaderboardEntry } from '../../api/contracts'
import { LeaderboardPanel } from './LeaderboardPanel'

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client')>()
  return { ...actual, getLeaderboard: vi.fn() }
})

const mockedGetLeaderboard = vi.mocked(getLeaderboard)
const current: LeaderboardEntry = {
  rank: 1, userId: 'current', displayName: '나', highestStage: 8, bestTimeSeconds: 75,
}
const other: LeaderboardEntry = {
  rank: 1, userId: 'other', displayName: '친구', highestStage: 8, bestTimeSeconds: 75,
}
const callbacks = { onUnauthorized: vi.fn().mockResolvedValue(undefined) }
const currentDisplayName = '나'
const topEntries = (count: number): LeaderboardEntry[] => Array.from({ length: count }, (_, index) => ({
  rank: index === 10 ? 10 : index + 1,
  userId: `user-${index}`,
  displayName: `사용자 ${index + 1}`,
  highestStage: 20,
  bestTimeSeconds: 30 + index,
}))

describe('LeaderboardPanel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows server order and tied ranks, highlighting the current Microsoft user once', async () => {
    mockedGetLeaderboard.mockResolvedValue({ top: [other, current], current })
    render(<LeaderboardPanel authType="microsoft" currentUserId="current" currentDisplayName={currentDisplayName} {...callbacks} />)
    expect(screen.getByRole('heading', { name: 'Microsoft 랭킹' })).toBeInTheDocument()
    expect(screen.getByText(/표시 이름이 랭킹에 공개됩니다/)).toBeInTheDocument()
    const topList = await screen.findByRole('list', { name: '상위 100명 랭킹' })
    const rows = within(topList).getAllByRole('listitem')
    expect(rows).toHaveLength(10)
    expect(rows[0]).toHaveTextContent('1위친구최고 8단계최단 01:15')
    expect(rows[1]).toHaveTextContent('1위나최고 8단계최단 01:15내 기록')
    expect(rows[1]).toHaveAttribute('data-current-user', 'true')
    expect(rows[2]).toHaveTextContent('3위')
    expect(rows[2].querySelector('strong')).toBeEmptyDOMElement()
    expect(rows[9]).toHaveAttribute('aria-label', '10위 기록 없음')
    expect(screen.getByRole('list', { name: '내 기록' })).toHaveTextContent('1위나최고 8단계최단 01:15')
    expect(screen.queryByText('전체 기간 · 최고 완료 단계 우선, 같은 단계에서는 최단 시간 우선')).not.toBeInTheDocument()
    expect(screen.getByText('1/1 페이지')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이전 페이지' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '다음 페이지' })).toBeDisabled()
    expect(mockedGetLeaderboard).toHaveBeenCalledExactlyOnceWith()
  })

  it('pages through 100 server-ordered entries without changing tied ranks or refetching', async () => {
    const top = topEntries(100)
    const outside = { ...current, rank: 101, highestStage: 4, bestTimeSeconds: 93 }
    mockedGetLeaderboard.mockResolvedValue({ top, current: outside })
    render(<LeaderboardPanel authType="simple" currentUserId="current" currentDisplayName={currentDisplayName} {...callbacks} />)
    expect(screen.getByRole('heading', { name: '간편 계정 랭킹' })).toBeInTheDocument()
    const topList = await screen.findByRole('list', { name: '상위 100명 랭킹' })
    expect(topList).toHaveAttribute('tabindex', '0')
    expect(within(topList).getAllByRole('listitem')).toHaveLength(10)
    expect(within(topList).getAllByRole('listitem')[0]).toHaveTextContent('1위사용자 1')
    expect(screen.getByText('1/10 페이지')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이전 페이지' })).toBeDisabled()

    topList.scrollTop = 120
    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
    expect(topList.scrollTop).toBe(0)
    expect(screen.getByText('2/10 페이지')).toBeInTheDocument()
    expect(within(topList).getAllByRole('listitem')).toHaveLength(10)
    expect(within(topList).getAllByRole('listitem')[0]).toHaveTextContent('10위사용자 11')
    expect(within(topList).getAllByRole('listitem')[9]).toHaveTextContent('20위사용자 20')
    expect(screen.getByRole('button', { name: '이전 페이지' })).toBeEnabled()

    for (let page = 3; page <= 10; page += 1) {
      fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
    }
    expect(screen.getByText('10/10 페이지')).toBeInTheDocument()
    expect(within(topList).getAllByRole('listitem')[0]).toHaveTextContent('91위사용자 91')
    expect(within(topList).getAllByRole('listitem')[9]).toHaveTextContent('100위사용자 100')
    expect(screen.getByRole('button', { name: '다음 페이지' })).toBeDisabled()
    const mine = within(screen.getByRole('list', { name: '내 기록' })).getByRole('listitem')
    expect(mine).toHaveTextContent('101위나최고 4단계최단 01:33')
    expect(mine).toHaveAttribute('data-current-user', 'true')
    expect(screen.queryByText(/실명일 수 있어요/)).not.toBeInTheDocument()
    expect(mockedGetLeaderboard).toHaveBeenCalledExactlyOnceWith()
  })

  it('keeps own rank above the list even when the same player is on the visible page', async () => {
    const top = topEntries(41)
    const mine = { ...top[25], userId: 'current', displayName: '나' }
    top[25] = mine
    mockedGetLeaderboard.mockResolvedValue({ top, current: mine })
    render(<LeaderboardPanel authType="simple" currentUserId="current" currentDisplayName={currentDisplayName} {...callbacks} />)
    const topList = await screen.findByRole('list', { name: '상위 100명 랭킹' })
    expect(screen.getByRole('list', { name: '내 기록' })).toHaveTextContent('26위나')
    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
    expect(screen.getByText('2/5 페이지')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: '내 기록' })).toHaveTextContent('26위나')
    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
    expect(screen.getByText('3/5 페이지')).toBeInTheDocument()
    expect(within(topList).getAllByRole('listitem')[5]).toHaveTextContent('26위나')
    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
    expect(screen.getByRole('list', { name: '내 기록' })).toHaveTextContent('26위나')
  })

  it('shows empty and unranked states without a return button', async () => {
    mockedGetLeaderboard.mockResolvedValue({ top: [], current: null })
    render(<LeaderboardPanel authType="simple" currentUserId="current" currentDisplayName={currentDisplayName} {...callbacks} />)
    const topList = await screen.findByRole('list', { name: '상위 100명 랭킹' })
    const rows = within(topList).getAllByRole('listitem')
    expect(rows).toHaveLength(10)
    rows.forEach((row, index) => {
      expect(row).toHaveAttribute('aria-label', `${index + 1}위 기록 없음`)
      expect(row.querySelector('strong')).toBeEmptyDOMElement()
    })
    expect(screen.getByRole('list', { name: '내 기록' })).toHaveTextContent('순위 없음나기록 없음')
    expect(screen.getByText('1/1 페이지')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이전 페이지' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '다음 페이지' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: '단계 선택으로 돌아가기' })).not.toBeInTheDocument()
  })

  it('shows a stage-zero account with its rank in the list and own record', async () => {
    const newcomer: LeaderboardEntry = {
      rank: 2, userId: 'current', displayName: '나', highestStage: 0, bestTimeSeconds: null,
    }
    mockedGetLeaderboard.mockResolvedValue({ top: [other, newcomer], current: newcomer })
    render(<LeaderboardPanel authType="simple" currentUserId="current" currentDisplayName={currentDisplayName} {...callbacks} />)

    const topList = await screen.findByRole('list', { name: '상위 100명 랭킹' })
    const stageZeroRow = within(topList).getAllByRole('listitem')[1]
    expect(stageZeroRow).toHaveTextContent('2위나최고 0단계기록 없음내 기록')
    expect(stageZeroRow).not.toHaveTextContent('최단 00:00')
    expect(screen.getByRole('list', { name: '내 기록' }))
      .toHaveTextContent('2위나최고 0단계기록 없음')
  })

  it('retries a failed request without reusing previous rows', async () => {
    const data: LeaderboardDto = { top: [current], current }
    mockedGetLeaderboard.mockRejectedValueOnce(new ApiClientError(503, 'unavailable', '오류'))
      .mockResolvedValueOnce(data)
    render(<LeaderboardPanel authType="simple" currentUserId="current" currentDisplayName={currentDisplayName} {...callbacks} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('랭킹을 불러오지 못했어요')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(screen.getByRole('list', { name: '상위 100명 랭킹' })).toBeInTheDocument())
    expect(mockedGetLeaderboard).toHaveBeenCalledTimes(2)
  })

  it('passes an unauthorized response to the parent session gate', async () => {
    mockedGetLeaderboard.mockRejectedValue(new ApiClientError(401, 'unauthorized', '로그인 필요'))
    render(<LeaderboardPanel authType="simple" currentUserId="current" currentDisplayName={currentDisplayName} {...callbacks} />)
    await waitFor(() => expect(callbacks.onUnauthorized).toHaveBeenCalledOnce())
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('clears the previous account type list while loading another type', async () => {
    let resolveNext!: (data: LeaderboardDto) => void
    mockedGetLeaderboard.mockResolvedValueOnce({ top: topEntries(24), current })
      .mockReturnValueOnce(new Promise<LeaderboardDto>((resolve) => { resolveNext = resolve }))
    const { rerender } = render(
      <LeaderboardPanel authType="simple" currentUserId="current" currentDisplayName={currentDisplayName} {...callbacks} />,
    )
    expect(await screen.findByRole('list', { name: '상위 100명 랭킹' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
    expect(screen.getByText('2/3 페이지')).toBeInTheDocument()

    rerender(<LeaderboardPanel authType="microsoft" currentUserId="microsoft-user" currentDisplayName="다른 계정" {...callbacks} />)
    expect(screen.getByRole('heading', { name: 'Microsoft 랭킹' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('랭킹을 불러오는 중')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    await act(async () => resolveNext({ top: topEntries(24), current: null }))
    expect(await screen.findByText('1/3 페이지')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: '상위 100명 랭킹' })).getAllByRole('listitem')[0]).toHaveTextContent('1위사용자 1')
  })
})
