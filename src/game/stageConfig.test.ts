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
    [5, 19, 2],
    [16, 29, 4],
    [17, 31, 5],
    [20, 33, 5],
  ])(
    'calculates stage %i as a %ix%i maze with %i rescue band',
    (stage, expectedSize, expectedRescueCount) => {
      expect(getMazeSize(stage)).toBe(expectedSize)
      expect(getRescueCount(stage)).toBe(expectedRescueCount)
    },
  )

  it('calculates the time limit from maze size and rescue count', () => {
    expect(getTimeLimitSeconds(1)).toBe(122)
    expect(getTimeLimitSeconds(20)).toBe(755)
    expect(getStageConfig(17)).toEqual({
      stage: 17,
      size: 31,
      rescueCount: 5,
      timeLimitSeconds: 683,
    })
  })

  it.each([0, 21, 1.5, Number.NaN])(
    'rejects invalid stage value %s',
    (stage) => {
      expect(() => getStageConfig(stage)).toThrow(RangeError)
    },
  )
})
