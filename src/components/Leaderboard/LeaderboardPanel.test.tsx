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
const callbacks = { onBack: vi.fn(), onUnauthorized: vi.fn().mockResolvedValue(undefined) }

describe('LeaderboardPanel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows server order and tied ranks, highlighting the current Microsoft user once', async () => {
    mockedGetLeaderboard.mockResolvedValue({ top: [other, current], current })
    render(<LeaderboardPanel authType="microsoft" currentUserId="current" {...callbacks} />)
    expect(screen.getByRole('heading', { name: 'Microsoft 랭킹' })).toBeInTheDocument()
    expect(screen.getByText(/표시 이름이 랭킹에 공개됩니다/)).toBeInTheDocument()
    const topList = await screen.findByRole('list', { name: '상위 100명 랭킹' })
    const rows = within(topList).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('1위친구최고 8단계최단 01:15')
    expect(rows[1]).toHaveTextContent('1위나최고 8단계최단 01:15내 기록')
    expect(rows[1]).toHaveAttribute('data-current-user', 'true')
    expect(screen.queryByRole('heading', { name: '내 순위' })).not.toBeInTheDocument()
    expect(mockedGetLeaderboard).toHaveBeenCalledExactlyOnceWith()
  })

  it('shows an outside-top current rank separately without reordering the top 100', async () => {
    const top = Array.from({ length: 100 }, (_, index): LeaderboardEntry => ({
      rank: index + 1, userId: `user-${index}`, displayName: `사용자 ${index + 1}`,
      highestStage: 20, bestTimeSeconds: 30 + index,
    }))
    const outside = { ...current, rank: 101, highestStage: 4, bestTimeSeconds: 93 }
    mockedGetLeaderboard.mockResolvedValue({ top, current: outside })
    render(<LeaderboardPanel authType="simple" currentUserId="current" {...callbacks} />)
    expect(screen.getByRole('heading', { name: '간편 계정 랭킹' })).toBeInTheDocument()
    const topList = await screen.findByRole('list', { name: '상위 100명 랭킹' })
    const topRows = within(topList).getAllByRole('listitem')
    expect(topRows).toHaveLength(100)
    expect(topRows[0]).toHaveTextContent('1위사용자 1')
    const mine = within(screen.getByRole('list', { name: '내 순위' })).getByRole('listitem')
    expect(mine).toHaveTextContent('101위나최고 4단계최단 01:33')
    expect(mine).toHaveAttribute('data-current-user', 'true')
    expect(screen.queryByText(/실명일 수 있어요/)).not.toBeInTheDocument()
  })

  it('shows empty and unranked states and returns to stage selection', async () => {
    mockedGetLeaderboard.mockResolvedValue({ top: [], current: null })
    render(<LeaderboardPanel authType="simple" currentUserId="current" {...callbacks} />)
    expect(await screen.findByText(/아직 랭킹 기록이 없어요/)).toBeInTheDocument()
    expect(screen.getByText('아직 완료한 단계가 없어 순위가 없습니다.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '단계 선택으로 돌아가기' }))
    expect(callbacks.onBack).toHaveBeenCalledOnce()
  })

  it('retries a failed request without reusing previous rows', async () => {
    const data: LeaderboardDto = { top: [current], current }
    mockedGetLeaderboard.mockRejectedValueOnce(new ApiClientError(503, 'unavailable', '오류'))
      .mockResolvedValueOnce(data)
    render(<LeaderboardPanel authType="simple" currentUserId="current" {...callbacks} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('랭킹을 불러오지 못했어요')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(screen.getByRole('list', { name: '상위 100명 랭킹' })).toBeInTheDocument())
    expect(mockedGetLeaderboard).toHaveBeenCalledTimes(2)
  })

  it('passes an unauthorized response to the parent session gate', async () => {
    mockedGetLeaderboard.mockRejectedValue(new ApiClientError(401, 'unauthorized', '로그인 필요'))
    render(<LeaderboardPanel authType="simple" currentUserId="current" {...callbacks} />)
    await waitFor(() => expect(callbacks.onUnauthorized).toHaveBeenCalledOnce())
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('clears the previous account type list while loading another type', async () => {
    let resolveNext!: (data: LeaderboardDto) => void
    mockedGetLeaderboard.mockResolvedValueOnce({ top: [current], current })
      .mockReturnValueOnce(new Promise<LeaderboardDto>((resolve) => { resolveNext = resolve }))
    const { rerender } = render(
      <LeaderboardPanel authType="simple" currentUserId="current" {...callbacks} />,
    )
    expect(await screen.findByRole('list', { name: '상위 100명 랭킹' })).toBeInTheDocument()

    rerender(<LeaderboardPanel authType="microsoft" currentUserId="microsoft-user" {...callbacks} />)
    expect(screen.getByRole('heading', { name: 'Microsoft 랭킹' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('랭킹을 불러오는 중')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    await act(async () => resolveNext({ top: [], current: null }))
    expect(await screen.findByText(/아직 랭킹 기록이 없어요/)).toBeInTheDocument()
  })
})
