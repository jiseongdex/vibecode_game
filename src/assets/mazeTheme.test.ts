import { getFloorVariant, getMazeTheme, getWallVariant, MAZE_THEMES } from './mazeTheme'

describe('maze theme selection', () => {
  it('reproduces a theme and tile variants from the same seed', () => {
    const seed = 0x12345678
    expect(getMazeTheme(seed)).toBe(getMazeTheme(seed))
    expect(getFloorVariant(seed, 5, 7)).toBe(getFloorVariant(seed, 5, 7))
    expect(getWallVariant(seed, 5, 7, 'left')).toBe(getWallVariant(seed, 5, 7, 'left'))
  })

  it('selects all four themes over different seeds', () => {
    const selected = new Set(Array.from({ length: 256 }, (_, seed) => getMazeTheme(seed)))
    expect(selected).toEqual(new Set(MAZE_THEMES))
  })

  it('keeps floor and wall variants within their asset ranges', () => {
    for (const seed of [0, 1, 0x12345678, 0xffffffff]) {
      for (const [row, col] of [[0, 0], [7, 11], [32, 32]]) {
        expect([0, 1]).toContain(getFloorVariant(seed, row, col))
        for (const side of ['up', 'right', 'down', 'left'] as const) {
          expect([0, 1, 2]).toContain(getWallVariant(seed, row, col, side))
        }
      }
    }
  })
})
