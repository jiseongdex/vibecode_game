import { randomUUID } from 'node:crypto'
import { ApiFailure, type AzurePrincipal } from '../auth/session.js'
import { MICROSOFT_SCOPE, UNRANKED_TIME_SECONDS, type AzureStore, type UserDoc } from '../model.js'

const MIN_STAGE = 1
const MAX_STAGE = 20
const ACTIVE_ATTEMPT_MS = 24 * 60 * 60 * 1000
const ACTIVE_ATTEMPT_TTL = 86_400
const FINISHED_ATTEMPT_TTL = 2_592_000
const ATTEMPT_ID_PATTERN = /^a_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface ProgressDto {
  unlockedStage: number
  stageRecords: Record<number, { bestTimeSeconds: number }>
}

function timeLimitSeconds(stage: number): number {
  // Keep this calculation in sync with src/game/stageConfig.ts; the API builds independently.
  const size = stage <= 5
    ? 15 + Math.round((stage - 1) * 15 / 4)
    : 30 + Math.round((stage - 5) * 70 / (MAX_STAGE - 5))
  const rescueCount = Math.floor((stage - 1) / 4) + 1
  return Math.max(90, Math.ceil(Math.ceil(size * size * 0.42 + rescueCount * size * 1.8) * 0.75))
}

async function jsonObject(request: Request): Promise<Record<string, unknown>> {
  let value: unknown
  try {
    value = await request.json()
  } catch {
    throw new ApiFailure(400, 'invalid_request', 'A JSON object is required.')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiFailure(400, 'invalid_request', 'A JSON object is required.')
  }
  return value as Record<string, unknown>
}

function response(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function progressOf(user: UserDoc): ProgressDto {
  return {
    unlockedStage: user.unlockedStage,
    stageRecords: Object.fromEntries(Object.entries(user.stageRecords).map(([stage, record]) => [
      Number(stage), { bestTimeSeconds: record.bestTimeSeconds },
    ])),
  }
}

export async function readProgress(store: AzureStore, userId: string): Promise<ProgressDto> {
  const user = await store.getUser(userId)
  if (!user) throw new ApiFailure(401, 'unauthorized', 'Sign in to continue.')
  return progressOf(user)
}

export async function startRun(
  request: Request,
  store: AzureStore,
  principal: AzurePrincipal,
  nowMs: number,
): Promise<Response> {
  const body = await jsonObject(request)
  const stage = body.stage
  if (typeof stage !== 'number' || !Number.isInteger(stage) || stage < MIN_STAGE || stage > MAX_STAGE) {
    throw new ApiFailure(400, 'invalid_stage', 'Stage must be an integer from 1 to 20.')
  }
  const user = await store.getUser(principal.userId)
  if (!user) throw new ApiFailure(401, 'unauthorized', 'Sign in to continue.')
  if (stage > user.unlockedStage) {
    throw new ApiFailure(403, 'stage_locked', 'Complete earlier stages first.')
  }
  const attemptId = `a_${randomUUID()}`
  await store.createAttempt({
    id: attemptId,
    scope: MICROSOFT_SCOPE,
    type: 'attempt',
    userId: user.id,
    stage,
    startedAtMs: nowMs,
    status: 'active',
    ttl: ACTIVE_ATTEMPT_TTL,
  })
  return response({ attemptId, stage, startedAtMs: nowMs }, 201)
}

function updatedUser(user: UserDoc, stage: number, seconds: number, nowMs: number): UserDoc {
  const previous = user.stageRecords[String(stage)]?.bestTimeSeconds
  const stageRecords = previous === undefined || seconds < previous
    ? { ...user.stageRecords, [stage]: { bestTimeSeconds: seconds } }
    : user.stageRecords
  const highestStage = Math.max(user.highestStage, stage)
  const bestTimeSeconds = stage > user.highestStage
    ? seconds
    : stage === user.highestStage
      ? Math.min(user.bestTimeSeconds ?? seconds, seconds)
      : user.bestTimeSeconds
  return {
    ...user,
    unlockedStage: Math.max(user.unlockedStage, Math.min(MAX_STAGE, stage + 1)),
    stageRecords,
    highestStage,
    bestTimeSeconds,
    rankTimeSeconds: bestTimeSeconds ?? UNRANKED_TIME_SECONDS,
    updatedAtMs: nowMs,
  }
}

export async function finishRun(
  request: Request,
  store: AzureStore,
  principal: AzurePrincipal,
  nowMs: number,
): Promise<Response> {
  const body = await jsonObject(request)
  const attemptId = body.attemptId
  const clearTimeSeconds = body.clearTimeSeconds
  if (typeof attemptId !== 'string' || !ATTEMPT_ID_PATTERN.test(attemptId)) {
    throw new ApiFailure(400, 'invalid_attempt', 'A valid attempt ID is required.')
  }
  for (let retry = 0; retry < 3; retry += 1) {
    const attempt = await store.getAttempt(attemptId)
    if (!attempt || attempt.userId !== principal.userId ||
      (attempt.status === 'active' && attempt.startedAtMs + ACTIVE_ATTEMPT_MS <= nowMs)) {
      throw new ApiFailure(404, 'attempt_not_found', 'Attempt not found.')
    }
    if (attempt.status !== 'active') {
      throw new ApiFailure(409, 'attempt_finished', 'Attempt has already finished.')
    }
    const elapsedMs = nowMs - attempt.startedAtMs
    if (
      typeof clearTimeSeconds !== 'number' || !Number.isInteger(clearTimeSeconds) ||
      clearTimeSeconds < 2 || clearTimeSeconds > timeLimitSeconds(attempt.stage) ||
      elapsedMs < 2_000 || clearTimeSeconds > elapsedMs / 1000 + 2
    ) {
      throw new ApiFailure(422, 'invalid_clear_time', 'Clear time is outside the allowed range.')
    }
    const user = await store.getUser(principal.userId)
    if (!user) throw new ApiFailure(401, 'unauthorized', 'Sign in to continue.')
    const result = await store.finishAttemptAndUser(
      { ...attempt, status: 'finished', finishedAtMs: nowMs, ttl: FINISHED_ATTEMPT_TTL },
      updatedUser(user, attempt.stage, clearTimeSeconds, nowMs),
    )
    if (result === 'ok') {
      return response({ progress: await readProgress(store, principal.userId) })
    }
  }
  throw new ApiFailure(409, 'conflict', 'The run changed. Please retry.')
}
