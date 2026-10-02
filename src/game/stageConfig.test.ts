import {
  getMazeSize,
  getRescueCount,
  getStageConfig,
  getTimeLimitSeconds,
} from './stageConfig'

describe('stageConfig', () => {
  it.each([
    [1, 15, 1],
    [4, 17, 1],
    [5, 20, 2],
    [16, 32, 4],
    [17, 35, 5],
    [20, 37, 5],
  ])(
    'calculates stage %i as a %ix%i maze with %i rescue band',
    (stage, expectedSize, expectedRescueCount) => {
      expect(getMazeSize(stage)).toBe(expectedSize)
      expect(getRescueCount(stage)).toBe(expectedRescueCount)
    },
  )

  it('shortens the time budget despite the larger maze', () => {
    expect(getTimeLimitSeconds(1)).toBe(92)
    expect(getTimeLimitSeconds(5)).toBe(166)
    expect(getTimeLimitSeconds(20)).toBe(567)
    expect(getStageConfig(17)).toEqual({
      stage: 17,
      size: 35,
      rescueCount: 5,
      timeLimitSeconds: 513,
    })
  })

  it.each([0, 21, 1.5, Number.NaN])(
    'rejects invalid stage value %s',
    (stage) => {
      expect(() => getStageConfig(stage)).toThrow(RangeError)
    },
  )
})
