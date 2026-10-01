export function wallDepth(visualRow: number): number {
  return visualRow * 2 + 1
}

export function playerDepth(visualRow: number): number {
  return visualRow * 2 + 2
}

export function foregroundDepth(boardTiles: number): number {
  return boardTiles * 2 + 3
}
