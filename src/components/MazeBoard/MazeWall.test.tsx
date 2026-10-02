import { render } from '@testing-library/react'

import { mazeThemes } from '../../assets/assetManifest'
import { createSeededRandom, generateMaze } from '../../game/mazeGenerator'
import { WallLayer } from './MazeWall'

const maze = generateMaze(15, createSeededRandom(123))

describe('wide wall orientation', () => {
  it.each([
    ['candy', 1],
    ['ice', 2],
    ['desert', 2],
  ] as const)('rotates only vertical %s variant %i walls', (themeId, variant) => {
    const { container } = render(
      <WallLayer maze={maze} theme={mazeThemes[themeId]} />,
    )
    const walls = Array.from(container.querySelectorAll<HTMLElement>('[data-wall-side]'))
    const wide = walls.filter((wall) => Number(wall.dataset.wallVariant) === variant)
    const vertical = wide.filter((wall) => wall.dataset.wallSide === 'left' || wall.dataset.wallSide === 'right')
    const horizontal = wide.filter((wall) => wall.dataset.wallSide === 'up' || wall.dataset.wallSide === 'down')
    const junctions = Array.from(container.querySelectorAll<HTMLElement>('[data-junction="true"]'))

    expect(vertical.length).toBeGreaterThan(0)
    expect(horizontal.length).toBeGreaterThan(0)
    expect(junctions.length).toBeGreaterThan(0)
    expect(vertical.every((wall) =>
      wall.style.getPropertyValue('--wall-image-rotation') === '90deg' &&
      wall.style.getPropertyValue('--wall-image-size') === '135%',
    )).toBe(true)
    expect(horizontal.every((wall) => wall.style.getPropertyValue('--wall-image-rotation') === '0deg')).toBe(true)
    expect(junctions.every((wall) => wall.style.getPropertyValue('--wall-image-rotation') === '0deg')).toBe(true)
    expect(walls.filter((wall) => Number(wall.dataset.wallVariant) !== variant).every((wall) =>
      wall.style.getPropertyValue('--wall-image-rotation') === '0deg',
    )).toBe(true)
  })

  it('keeps every forest obstacle unrotated', () => {
    const { container } = render(
      <WallLayer maze={maze} theme={mazeThemes.forest} />,
    )
    const obstacles = Array.from(container.querySelectorAll<HTMLElement>('[data-wall-variant]'))
    expect(obstacles.length).toBeGreaterThan(0)
    expect(obstacles.every((wall) => wall.style.getPropertyValue('--wall-image-rotation') === '0deg')).toBe(true)
  })
})
