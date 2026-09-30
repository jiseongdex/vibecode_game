import { MAX_STAGE, MIN_STAGE } from './stageConfig'

export interface StageRecord {
  bestTimeSeconds: number
}

export interface CampaignProgress {
  unlockedStage: number
  stageRecords: Record<number, StageRecord>
}

export function createCampaignProgress(): CampaignProgress {
  return { unlockedStage: MIN_STAGE, stageRecords: {} }
}

export function completeStage(
  progress: CampaignProgress,
  stage: number,
  clearTimeSeconds: number,
): CampaignProgress {
  if (
    !Number.isInteger(stage) ||
    stage < MIN_STAGE ||
    stage > MAX_STAGE ||
    stage > progress.unlockedStage ||
    !Number.isInteger(clearTimeSeconds) ||
    clearTimeSeconds < 0
  ) {
    throw new RangeError('Invalid stage result.')
  }

  const previous = progress.stageRecords[stage]
  return {
    unlockedStage: Math.max(progress.unlockedStage, Math.min(MAX_STAGE, stage + 1)),
    stageRecords: {
      ...progress.stageRecords,
      [stage]: {
        bestTimeSeconds: Math.min(
          previous?.bestTimeSeconds ?? Infinity,
          clearTimeSeconds,
        ),
      },
    },
  }
}
