import { completeStage, createCampaignProgress } from './campaignProgress'

describe('completeStage', () => {
  it('unlocks the next stage and retains only the best clear time', () => {
    const initial = createCampaignProgress()
    const first = completeStage(initial, 1, 80)
    const faster = completeStage(first, 1, 65)
    const slower = completeStage(faster, 1, 90)

    expect(first.unlockedStage).toBe(2)
    expect(slower.stageRecords[1]).toEqual({ bestTimeSeconds: 65 })
    expect(slower.stageRecords[1]).not.toHaveProperty('bestMoveCount')
  })

  it.each([-1, 1.5])('rejects an invalid clear time: %s', (clearTime) => {
    expect(() => completeStage(createCampaignProgress(), 1, clearTime)).toThrow(RangeError)
  })
})
