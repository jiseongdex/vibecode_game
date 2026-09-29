import { fireEvent, render, screen } from '@testing-library/react'

import { completeStage, createCampaignProgress } from '../../game/campaignProgress'
import { CampaignScreen } from './CampaignScreen'

describe('CampaignScreen', () => {
  it('locks future stages and creates a new game for an unlocked stage', () => {
    const onStartSession = vi.fn()
    render(
      <CampaignScreen
        progress={createCampaignProgress()}
        onStartSession={onStartSession}
      />,
    )

    expect(screen.getAllByRole('button')).toHaveLength(20)
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
    const progress = completeStage(initial, 1, 80, 50)
    const { rerender } = render(
      <CampaignScreen progress={progress} onStartSession={onStartSession} />,
    )

    expect(initial.unlockedStage).toBe(1)
    expect(progress.unlockedStage).toBe(2)
    expect(screen.getByText('최고 01:20 · 50회')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '1단계 완료, 재플레이 가능' }))
    fireEvent.click(screen.getByRole('button', { name: '2단계 도전 가능' }))
    expect(onStartSession.mock.calls.map(([session]) => session.stageConfig.stage)).toEqual([1, 2])

    const improved = completeStage(progress, 1, 95, 40)
    rerender(<CampaignScreen progress={improved} onStartSession={onStartSession} />)
    expect(improved.stageRecords[1]).toEqual({ bestTimeSeconds: 80, bestMoveCount: 40 })
    expect(screen.getByText('최고 01:20 · 40회')).toBeInTheDocument()
  })

  it('shows the final campaign result after all twenty stages', () => {
    let progress = createCampaignProgress()
    for (let stage = 1; stage <= 20; stage += 1) {
      progress = completeStage(progress, stage, stage * 10, stage * 20)
    }
    render(<CampaignScreen progress={progress} onStartSession={vi.fn()} />)

    expect(screen.getByRole('status')).toHaveTextContent('20단계 캠페인 완료!')
    expect(screen.getByText('완료 20/20단계 · 해금 20/20단계')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '20단계 완료, 재플레이 가능' })).toBeEnabled()
  })
})
