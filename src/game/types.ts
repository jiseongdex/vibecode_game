export type Direction = 'up' | 'right' | 'down' | 'left'

export interface Position {
  row: number
  col: number
}

export interface EntityPosition extends Position {
  id: string
}

export interface CellWalls {
  top: boolean
  right: boolean
  bottom: boolean
  left: boolean
}

export interface Cell extends Position {
  walls: CellWalls
  visited: boolean
}

export interface Maze {
  size: number
  cells: Cell[][]
  seed: number
}

export interface StageConfig {
  stage: number
  size: number
  rescueCount: number
  timeLimitSeconds: number
}
