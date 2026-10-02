import {
  getMazeSize,
  getRescueCount,
  getStageConfig,
  getTimeLimitSeconds,
} from './stageConfig'

describe('stageConfig', () => {
  it.each([
    [1, 15, 1],
    [4, 26, 1],
    [5, 30, 2],
    [16, 81, 4],
    [17, 86, 5],
    [20, 100, 5],
  ])(
    'calculates stage %i as a %ix%i maze with %i rescue band',
    (stage, expectedSize, expectedRescueCount) => {
      expect(getMazeSize(stage)).toBe(expectedSize)
      expect(getRescueCount(stage)).toBe(expectedRescueCount)
    },
  )

  it('scales the reduced time budget with the larger maze', () => {
    expect(getTimeLimitSeconds(1)).toBe(92)
    expect(getTimeLimitSeconds(5)).toBe(365)
    expect(getTimeLimitSeconds(20)).toBe(3825)
    expect(getStageConfig(17)).toEqual({
      stage: 17,
      size: 86,
      rescueCount: 5,
      timeLimitSeconds: 2911,
    })
  })

  it.each([0, 21, 1.5, Number.NaN])(
    'rejects invalid stage value %s',
    (stage) => {
      expect(() => getStageConfig(stage)).toThrow(RangeError)
    },
  )
})
