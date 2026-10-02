import { createSeededRandom, generateMaze } from '../../game/mazeGenerator'
import type { CellWalls, Maze } from '../../game/types'
import { closedWallSlots, visualSize } from './boardGeometry'
import {
  getMinimapViewportBounds,
  getMinimapWallSegments,
  projectGridCenter,
} from './minimapGeometry'

const twoByTwoWalls: CellWalls[][] = [
  [
    { top: true, right: false, bottom: false, left: true },
    { top: true, right: true, bottom: true, left: false },
  ],
  [
    { top: false, right: false, bottom: true, left: true },
    { top: true, right: true, bottom: true, left: false },
  ],
]

const twoByTwoMaze: Maze = {
  size: 2,
  seed: 1,
  cells: twoByTwoWalls.map((row, rowIndex) =>
    row.map((walls, colIndex) => ({
      row: rowIndex,
      col: colIndex,
      walls,
      visited: true,
    })),
  ),
}

describe('minimapGeometry', () => {
  it('draws each closed wall once and leaves open connectors blank', () => {
    const segments = getMinimapWallSegments(twoByTwoMaze)
    const byKey = new Map(segments.map((segment) => [segment.key, segment]))

    expect(segments).toHaveLength(9)
    expect(byKey.size).toBe(segments.length)
    expect(byKey.get('0:1')).toEqual({
      key: '0:1', x1: 0.5, y1: 0.5, x2: 2.5, y2: 0.5,
    })
    expect(byKey.get('1:0')).toEqual({
      key: '1:0', x1: 0.5, y1: 0.5, x2: 0.5, y2: 2.5,
    })
    expect(byKey.get('2:3')).toEqual({
      key: '2:3', x1: 2.5, y1: 2.5, x2: 4.5, y2: 2.5,
    })
    expect(byKey.has('1:2')).toBe(false)
    expect(byKey.has('2:1')).toBe(false)
    expect(byKey.get('3:4')).toEqual({
      key: '3:4', x1: 4.5, y1: 2.5, x2: 4.5, y2: 4.5,
    })
    expect(byKey.get('4:3')).toEqual({
      key: '4:3', x1: 2.5, y1: 4.5, x2: 4.5, y2: 4.5,
    })
  })

  it('keeps generated maze wall segments inside the whole-map viewBox', () => {
    const maze = generateMaze(15, createSeededRandom(15))
    const segments = getMinimapWallSegments(maze)
    const size = visualSize(maze.size)

    expect(segments).toHaveLength(closedWallSlots(maze).length)
    expect(new Set(segments.map(({ key }) => key)).size).toBe(segments.length)
    for (const segment of segments) {
      expect([segment.x1, segment.x2, segment.y1, segment.y2]
        .every((coordinate) => coordinate >= 0 && coordinate <= size)).toBe(true)
    }
  })

  it('projects expanded-grid cell centers to map percentages', () => {
    expect(projectGridCenter({ row: 1, col: 1 }, 31)).toEqual({
      leftPercent: 1.5 / 31 * 100,
      topPercent: 1.5 / 31 * 100,
    })
    expect(projectGridCenter({ row: 29, col: 27 }, 31)).toEqual({
      leftPercent: 27.5 / 31 * 100,
      topPercent: 29.5 / 31 * 100,
    })
    expect(() => projectGridCenter({ row: 1, col: 1 }, 0)).toThrow(RangeError)
    expect(() => projectGridCenter({ row: -1, col: 1 }, 31)).toThrow(RangeError)
    expect(() => projectGridCenter({ row: 31, col: 1 }, 31)).toThrow(RangeError)
    expect(() => projectGridCenter({ row: 1.5, col: 1 }, 31)).toThrow(RangeError)
  })

  it('projects the real camera viewport at the start, middle, and far edge', () => {
    const frame = {
      boardTiles: 31,
      cellSize: 108,
      viewWidth: 1240,
      viewHeight: 840,
      offsetX: 0,
      offsetY: 0,
    }
    const boardPixels = 31 * 108

    const start = getMinimapViewportBounds(frame)
    expect(start.left).toBe(0)
    expect(start.top).toBe(0)
    expect(start.right).toBeCloseTo(1240 / boardPixels)
    expect(start.bottom).toBeCloseTo(840 / boardPixels)

    const middle = getMinimapViewportBounds({ ...frame, offsetX: -730, offsetY: -930 })
    expect(middle.left).toBeCloseTo(730 / boardPixels)
    expect(middle.top).toBeCloseTo(930 / boardPixels)
    expect(middle.right).toBeCloseTo(1970 / boardPixels)
    expect(middle.bottom).toBeCloseTo(1770 / boardPixels)

    const end = getMinimapViewportBounds({ ...frame, offsetX: -2108, offsetY: -2508 })
    expect(end.left).toBeCloseTo(2108 / boardPixels)
    expect(end.top).toBeCloseTo(2508 / boardPixels)
    expect(end.right).toBe(1)
    expect(end.bottom).toBe(1)

    expect(getMinimapViewportBounds({
      ...frame,
      cellSize: 54,
      viewWidth: 620,
      viewHeight: 420,
      offsetX: -365,
      offsetY: -465,
    })).toEqual(middle)
  })

  it('clamps a centered small board and rejects invalid camera dimensions', () => {
    expect(getMinimapViewportBounds({
      boardTiles: 3,
      cellSize: 108,
      viewWidth: 1240,
      viewHeight: 840,
      offsetX: 458,
      offsetY: 258,
    })).toEqual({ left: 0, top: 0, right: 1, bottom: 1 })

    const frame = {
      boardTiles: 31,
      cellSize: 108,
      viewWidth: 1240,
      viewHeight: 840,
      offsetX: 0,
      offsetY: 0,
    }
    expect(() => getMinimapViewportBounds({ ...frame, boardTiles: 0 })).toThrow(RangeError)
    expect(() => getMinimapViewportBounds({ ...frame, cellSize: 0 })).toThrow(RangeError)
    expect(() => getMinimapViewportBounds({ ...frame, viewWidth: Infinity })).toThrow(RangeError)
    expect(() => getMinimapViewportBounds({ ...frame, offsetY: Number.NaN })).toThrow(RangeError)
  })
})
