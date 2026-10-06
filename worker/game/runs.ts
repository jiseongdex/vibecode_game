import { MAX_STAGE, MIN_STAGE, getTimeLimitSeconds } from '../../src/game/stageConfig'
import type {
  FinishRunDto,
  ProgressDto,
  StartRunDto,
} from '../../src/api/contracts'
import { ApiFailure } from '../auth/session'
import type { Env, SessionPrincipal } from '../types'

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

export async function readProgress(db: D1Database, userId: string): Promise<ProgressDto> {
  const user = await db.prepare('SELECT unlocked_stage FROM users WHERE id = ?')
    .bind(userId).first<{ unlocked_stage: number }>()
  if (!user) throw new ApiFailure(401, 'unauthorized', 'Sign in to continue.')

  const records = await db.prepare(
    'SELECT stage, best_time_seconds FROM stage_records WHERE user_id = ? ORDER BY stage',
  ).bind(userId).all<{ stage: number; best_time_seconds: number }>()
  return {
    unlockedStage: user.unlocked_stage,
    stageRecords: Object.fromEntries(records.results.map((record) => [
      record.stage,
      { bestTimeSeconds: record.best_time_seconds },
    ])),
  }
}

export async function startRun(
  request: Request,
  env: Env,
  principal: SessionPrincipal,
  nowMs: number,
): Promise<Response> {
  const body = await jsonObject(request)
  const stage = body.stage
  if (typeof stage !== 'number' || !Number.isInteger(stage) || stage < MIN_STAGE || stage > MAX_STAGE) {
    throw new ApiFailure(400, 'invalid_stage', 'Stage must be an integer from 1 to 20.')
  }

  const user = await env.DB.prepare('SELECT unlocked_stage FROM users WHERE id = ?')
    .bind(principal.userId).first<{ unlocked_stage: number }>()
  if (!user) throw new ApiFailure(401, 'unauthorized', 'Sign in to continue.')
  if (stage > user.unlocked_stage) {
    throw new ApiFailure(403, 'stage_locked', 'Complete earlier stages first.')
  }

  const attemptId = crypto.randomUUID()
  const inserted = await env.DB.prepare(
    `INSERT INTO attempts (id, user_id, stage, started_at_ms, status)
     SELECT ?, id, ?, ?, 'active' FROM users
     WHERE id = ? AND unlocked_stage >= ?`,
  ).bind(attemptId, stage, nowMs, principal.userId, stage).run()
  if (inserted.meta.changes !== 1) {
    throw new ApiFailure(403, 'stage_locked', 'Complete earlier stages first.')
  }

  const dto: StartRunDto = { attemptId, stage, startedAtMs: nowMs }
  return response(dto, 201)
}

export async function finishRun(
  request: Request,
  env: Env,
  principal: SessionPrincipal,
  nowMs: number,
): Promise<Response> {
  const body = await jsonObject(request)
  const attemptId = body.attemptId
  const clearTimeSeconds = body.clearTimeSeconds
  if (typeof attemptId !== 'string' || !/^[0-9a-f-]{36}$/i.test(attemptId)) {
    throw new ApiFailure(400, 'invalid_attempt', 'A valid attempt ID is required.')
  }

  const attempt = await env.DB.prepare(
    'SELECT user_id, stage, started_at_ms, status FROM attempts WHERE id = ?',
  ).bind(attemptId).first<{
    user_id: string
    stage: number
    started_at_ms: number
    status: string
  }>()
  if (!attempt || attempt.user_id !== principal.userId) {
    throw new ApiFailure(404, 'attempt_not_found', 'Attempt not found.')
  }
  if (attempt.status !== 'active') {
    throw new ApiFailure(409, 'attempt_finished', 'Attempt has already finished.')
  }
  const elapsedMs = nowMs - attempt.started_at_ms
  if (
    typeof clearTimeSeconds !== 'number' || !Number.isInteger(clearTimeSeconds) ||
    clearTimeSeconds < 2 ||
    clearTimeSeconds > getTimeLimitSeconds(attempt.stage) ||
    elapsedMs < 2_000 ||
    clearTimeSeconds > elapsedMs / 1000 + 2
  ) {
    throw new ApiFailure(422, 'invalid_clear_time', 'Clear time is outside the allowed range.')
  }

  // D1 batch executes as one transaction. Every write is gated by the same active attempt.
  const activeAttempt = `EXISTS (
    SELECT 1 FROM attempts
    WHERE id = ? AND user_id = ? AND status = 'active'
  )`
  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO stage_records (user_id, stage, best_time_seconds, updated_at_ms)
       SELECT user_id, stage, ?, ? FROM attempts
       WHERE id = ? AND user_id = ? AND status = 'active'
       ON CONFLICT(user_id, stage) DO UPDATE SET
         best_time_seconds = MIN(stage_records.best_time_seconds, excluded.best_time_seconds),
         updated_at_ms = CASE
           WHEN excluded.best_time_seconds < stage_records.best_time_seconds
           THEN excluded.updated_at_ms ELSE stage_records.updated_at_ms END`,
    ).bind(clearTimeSeconds, nowMs, attemptId, principal.userId),
    env.DB.prepare(
      `UPDATE users SET
         unlocked_stage = MIN(20, MAX(unlocked_stage, ?)),
         highest_completed_stage = CASE
           WHEN highest_completed_stage IS NULL OR highest_completed_stage < ? THEN ?
           ELSE highest_completed_stage END,
         highest_stage_best_time_seconds = CASE
           WHEN highest_completed_stage IS NULL OR highest_completed_stage < ? THEN ?
           WHEN highest_completed_stage = ? THEN MIN(highest_stage_best_time_seconds, ?)
           ELSE highest_stage_best_time_seconds END,
         updated_at_ms = ?
       WHERE id = ? AND ${activeAttempt}`,
    ).bind(
      Math.min(MAX_STAGE, attempt.stage + 1),
      attempt.stage, attempt.stage,
      attempt.stage, clearTimeSeconds,
      attempt.stage, clearTimeSeconds,
      nowMs, principal.userId, attemptId, principal.userId,
    ),
    env.DB.prepare(
      `UPDATE attempts SET status = 'finished', finished_at_ms = ?
       WHERE id = ? AND user_id = ? AND status = 'active'`,
    ).bind(nowMs, attemptId, principal.userId),
  ])
  if (results[2].meta.changes !== 1) {
    throw new ApiFailure(409, 'attempt_finished', 'Attempt has already finished.')
  }

  const dto: FinishRunDto = { progress: await readProgress(env.DB, principal.userId) }
  return response(dto)
}
