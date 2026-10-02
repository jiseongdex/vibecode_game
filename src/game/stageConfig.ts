import type { StageConfig } from './types'

export const MIN_STAGE = 1
export const MAX_STAGE = 20

function getTimeBudgetSize(stage: number): number {
  return 15 + Math.floor((stage - 1) / 2) * 2
}

function assertValidStage(stage: number): void {
  if (!Number.isInteger(stage) || stage < MIN_STAGE || stage > MAX_STAGE) {
    throw new RangeError(
      `Stage must be an integer between ${MIN_STAGE} and ${MAX_STAGE}.`,
    )
  }
}

export function getMazeSize(stage: number): number {
  assertValidStage(stage)
  return getTimeBudgetSize(stage) + Math.floor((stage - 1) / 4)
}

export function getRescueCount(stage: number): number {
  assertValidStage(stage)
  return Math.floor((stage - 1) / 4) + 1
}

export function getTimeLimitSeconds(stage: number): number {
  assertValidStage(stage)
  // Extra maze growth does not add time to the previous stage budget.
  const size = getTimeBudgetSize(stage)
  const rescueCount = getRescueCount(stage)
  const calculatedSeconds = Math.ceil(
    size * size * 0.42 + rescueCount * size * 1.8,
  )

  return Math.max(90, Math.ceil(calculatedSeconds * 0.75))
}

export function getStageConfig(stage: number): StageConfig {
  return {
    stage,
    size: getMazeSize(stage),
    rescueCount: getRescueCount(stage),
    timeLimitSeconds: getTimeLimitSeconds(stage),
  }
}
