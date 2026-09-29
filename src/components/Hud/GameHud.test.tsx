import { fireEvent, render, screen } from '@testing-library/react'

import { PauseOverlay } from '../Overlays/PauseOverlay'
import { ResultOverlay } from '../Overlays/ResultOverlay'
import { formatTime, GameHud } from './GameHud'

describe('GameHud and overlays', () => {
  it('shows stage, formatted timer, rescue progress, and move count', () => {
    const onPause = vi.fn()
    render(
      <GameHud
        stage={5}
        remainingSeconds={125}
        rescuedCount={1}
        rescueCount={2}
        moveCount={34}
        onPause={onPause}
      />,
    )

    expect(screen.getByText('5단계')).toBeInTheDocument()
    expect(screen.getByText('남은 시간: 02:05')).toBeInTheDocument()
    expect(screen.getByText('구출: 1/2')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('status')).toHaveTextContent('구출: 1/2')
    expect(screen.getByText('이동: 34회')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '일시정지' }))
    expect(onPause).toHaveBeenCalledTimes(1)
    expect(formatTime(0)).toBe('00:00')
  })

  it('marks the last ten seconds urgent and can disable pause', () => {
    render(
      <GameHud
        stage={1}
        remainingSeconds={10}
        rescuedCount={0}
        rescueCount={1}
        moveCount={0}
        onPause={vi.fn()}
        canPause={false}
      />,
    )

    expect(screen.getByText('남은 시간: 00:10')).toHaveAttribute('data-urgent', 'true')
    expect(screen.getByText('⚠️ 시간 부족')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '일시정지' })).toBeDisabled()
  })

  it('resumes from pause and offers both timeout retry choices', () => {
    const onResume = vi.fn()
    const onRetrySameMaze = vi.fn()
    const onRestartNewMaze = vi.fn()
    const { rerender } = render(<PauseOverlay onResume={onResume} />)

    fireEvent.click(screen.getByRole('button', { name: '이어하기' }))
    expect(onResume).toHaveBeenCalledTimes(1)

    rerender(
      <ResultOverlay
        status="lost"
        stage={3}
        clearTimeSeconds={200}
        moveCount={55}
        onRetrySameMaze={onRetrySameMaze}
        onRestartNewMaze={onRestartNewMaze}
      />,
    )
    expect(screen.getByRole('dialog', { name: '시간 초과!' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '같은 미로 재도전' }))
    fireEvent.click(screen.getByRole('button', { name: '새 미로로 재시작' }))
    expect(onRetrySameMaze).toHaveBeenCalledTimes(1)
    expect(onRestartNewMaze).toHaveBeenCalledTimes(1)
  })

  it('shows clear records, next stage, and the final stage result', () => {
    const onNextStage = vi.fn()
    const onCampaign = vi.fn()
    const { rerender } = render(
      <ResultOverlay
        status="won"
        stage={2}
        clearTimeSeconds={78}
        moveCount={47}
        onRetrySameMaze={vi.fn()}
        onRestartNewMaze={vi.fn()}
        onNextStage={onNextStage}
        onCampaign={onCampaign}
      />,
    )

    expect(screen.getByText('클리어 시간 01:18 · 이동 47회')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '같은 미로 재도전' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }))
    fireEvent.click(screen.getByRole('button', { name: '단계 선택' }))
    expect(onNextStage).toHaveBeenCalledTimes(1)
    expect(onCampaign).toHaveBeenCalledTimes(1)

    rerender(
      <ResultOverlay
        status="won"
        stage={20}
        clearTimeSeconds={300}
        moveCount={100}
        onRetrySameMaze={vi.fn()}
        onRestartNewMaze={vi.fn()}
        onNextStage={onNextStage}
        onCampaign={onCampaign}
      />,
    )
    expect(screen.getByRole('dialog', { name: '20단계 완료!' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다음 단계' })).toBeNull()
  })
})
