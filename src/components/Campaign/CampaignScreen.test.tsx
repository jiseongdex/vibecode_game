import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { completeStage, createCampaignProgress } from '../../game/campaignProgress'
import { CampaignScreen } from './CampaignScreen'

describe('CampaignScreen', () => {
  it('keeps stage order while the visual route snakes across desktop and mobile columns', () => {
    render(<CampaignScreen progress={createCampaignProgress()} appearance="girl" onAppearanceChange={vi.fn()} onStartStage={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.queryByText('완료 0/20단계 · 해금 1/20단계')).not.toBeInTheDocument()

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

  it('locks future stages and creates a new game for an unlocked stage', async () => {
    const onStartStage = vi.fn().mockResolvedValue(undefined)
    const onAppearanceChange = vi.fn()
    render(
      <CampaignScreen
        progress={createCampaignProgress()}
        appearance="girl"
        onAppearanceChange={onAppearanceChange}
        onStartStage={onStartStage}
      />,
    )

    expect(screen.getAllByRole('button', { name: /단계/ })).toHaveLength(20)
    expect(screen.getByRole('button', { name: '여자 탐험가' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: '남자 탐험가' }))
    expect(onAppearanceChange).toHaveBeenCalledWith('boy')
    expect(screen.getByRole('button', { name: '2단계 잠김' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '1단계 도전 가능' }))
    expect(onStartStage).toHaveBeenCalledExactlyOnceWith(1)
    await waitFor(() => expect(screen.getByRole('button', { name: '1단계 도전 가능' })).toBeEnabled())
  })

  it('unlocks the next stage and lets completed stages start again', async () => {
    const onStartStage = vi.fn().mockResolvedValue(undefined)
    const initial = createCampaignProgress()
    const progress = completeStage(initial, 1, 80)
    const { rerender } = render(
      <CampaignScreen progress={progress} appearance="girl" onAppearanceChange={vi.fn()} onStartStage={onStartStage} />,
    )

    expect(initial.unlockedStage).toBe(1)
    expect(progress.unlockedStage).toBe(2)
    expect(screen.getByText('최고 01:20')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '1단계 완료, 재플레이 가능' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '2단계 도전 가능' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: '2단계 도전 가능' }))
    expect(onStartStage.mock.calls.map(([stage]) => stage)).toEqual([1, 2])
    await waitFor(() => expect(screen.getByRole('button', { name: '2단계 도전 가능' })).toBeEnabled())

    const improved = completeStage(progress, 1, 95)
    rerender(<CampaignScreen progress={improved} appearance="girl" onAppearanceChange={vi.fn()} onStartStage={onStartStage} />)
    expect(improved.stageRecords[1]).toEqual({ bestTimeSeconds: 80 })
    expect(screen.getByText('최고 01:20')).toBeInTheDocument()
  })

  it('shows the final campaign result after all twenty stages', () => {
    let progress = createCampaignProgress()
    for (let stage = 1; stage <= 20; stage += 1) {
      progress = completeStage(progress, stage, stage * 10)
    }
    render(<CampaignScreen progress={progress} appearance="girl" onAppearanceChange={vi.fn()} onStartStage={vi.fn().mockResolvedValue(undefined)} />)

    expect(screen.getByRole('status')).toHaveTextContent('20단계 캠페인 완료!')
    expect(screen.queryByText('완료 20/20단계 · 해금 20/20단계')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '20단계 완료, 재플레이 가능' })).toBeEnabled()
  })
})
