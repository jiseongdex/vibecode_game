import { fireEvent, render, screen } from '@testing-library/react'

import { completeStage, createCampaignProgress } from '../../game/campaignProgress'
import { CampaignScreen } from './CampaignScreen'

describe('CampaignScreen', () => {
  it('keeps stage order while the visual route snakes across desktop and mobile columns', () => {
    render(<CampaignScreen progress={createCampaignProgress()} appearance="girl" onAppearanceChange={vi.fn()} onStartSession={vi.fn()} />)

    const stages = screen.getAllByRole('button', { name: /단계/ })
    expect(stages.map((button) => button.getAttribute('aria-label')?.split('단계')[0])).toEqual(
      Array.from({ length: 20 }, (_, index) => String(index + 1)),
    )

    const routeNode = (stage: number) => stages[stage - 1].parentElement!
    expect(routeNode(1).style.getPropertyValue('--desktop-col')).toBe('1')
    expect(routeNode(5).style.getPropertyValue('--desktop-col')).toBe('5')
    expect(routeNode(5)).toHaveAttribute('data-desktop-next', 'down')
    expect(routeNode(6).style.getPropertyValue('--desktop-col')).toBe('5')
    expect(routeNode(10).style.getPropertyValue('--desktop-col')).toBe('1')
    expect(routeNode(2).style.getPropertyValue('--mobile-col')).toBe('2')
    expect(routeNode(2)).toHaveAttribute('data-mobile-next', 'down')
    expect(routeNode(3).style.getPropertyValue('--mobile-col')).toBe('2')
    expect(routeNode(4).style.getPropertyValue('--mobile-col')).toBe('1')
    expect(routeNode(20)).toHaveAttribute('data-desktop-next', 'end')
    expect(routeNode(20)).toHaveAttribute('data-mobile-next', 'end')
  })

  it('locks future stages and creates a new game for an unlocked stage', () => {
    const onStartSession = vi.fn()
    const onAppearanceChange = vi.fn()
    render(
      <CampaignScreen
        progress={createCampaignProgress()}
        appearance="girl"
        onAppearanceChange={onAppearanceChange}
        onStartSession={onStartSession}
      />,
    )

    expect(screen.getAllByRole('button', { name: /단계/ })).toHaveLength(20)
    expect(screen.getByRole('button', { name: '여자 탐험가' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: '남자 탐험가' }))
    expect(onAppearanceChange).toHaveBeenCalledWith('boy')
    expect(screen.getByRole('button', { name: '2단계 잠김' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '1단계 도전 가능' }))
    expect(onStartSession).toHaveBeenCalledTimes(1)
    expect(onStartSession.mock.calls[0][0]).toMatchObject({
      stageConfig: { stage: 1, size: 15, rescueCount: 1 },
      maze: { size: 15 },
      status: 'ready',
    })
  })

  it('unlocks the next stage and lets completed stages start again', () => {
    const onStartSession = vi.fn()
    const initial = createCampaignProgress()
    const progress = completeStage(initial, 1, 80)
    const { rerender } = render(
      <CampaignScreen progress={progress} appearance="girl" onAppearanceChange={vi.fn()} onStartSession={onStartSession} />,
    )

    expect(initial.unlockedStage).toBe(1)
    expect(progress.unlockedStage).toBe(2)
    expect(screen.getByText('최고 01:20')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '1단계 완료, 재플레이 가능' }))
    fireEvent.click(screen.getByRole('button', { name: '2단계 도전 가능' }))
    expect(onStartSession.mock.calls.map(([session]) => session.stageConfig.stage)).toEqual([1, 2])

    const improved = completeStage(progress, 1, 95)
    rerender(<CampaignScreen progress={improved} appearance="girl" onAppearanceChange={vi.fn()} onStartSession={onStartSession} />)
    expect(improved.stageRecords[1]).toEqual({ bestTimeSeconds: 80 })
    expect(screen.getByText('최고 01:20')).toBeInTheDocument()
  })

  it('shows the final campaign result after all twenty stages', () => {
    let progress = createCampaignProgress()
    for (let stage = 1; stage <= 20; stage += 1) {
      progress = completeStage(progress, stage, stage * 10)
    }
    render(<CampaignScreen progress={progress} appearance="girl" onAppearanceChange={vi.fn()} onStartSession={vi.fn()} />)

    expect(screen.getByRole('status')).toHaveTextContent('20단계 캠페인 완료!')
    expect(screen.getByText('완료 20/20단계 · 해금 20/20단계')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '20단계 완료, 재플레이 가능' })).toBeEnabled()
  })
})
