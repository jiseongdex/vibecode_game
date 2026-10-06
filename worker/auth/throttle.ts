import type { Env } from '../types'

export interface ThrottlePolicy {
  limit: number
  windowMs: number
}

export const SIGNUP_POLICY: ThrottlePolicy = { limit: 5, windowMs: 60 * 60 * 1000 }
export const NICKNAME_LOGIN_POLICY: ThrottlePolicy = { limit: 5, windowMs: 15 * 60 * 1000 }
export const IP_LOGIN_POLICY: ThrottlePolicy = { limit: 30, windowMs: 15 * 60 * 1000 }

export async function ipBucket(request: Request, pepper: string, prefix: string): Promise<string> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'missing-ip'
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip))
  const value = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${prefix}:${value}`
}

export async function checkThrottle(
  env: Env,
  bucketKey: string,
  policy: ThrottlePolicy,
  nowMs: number,
): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT failures, window_started_at_ms, blocked_until_ms FROM auth_throttle WHERE bucket_key = ?',
  ).bind(bucketKey).first<{
    failures: number
    window_started_at_ms: number
    blocked_until_ms: number
  }>()
  return !!row && row.window_started_at_ms + policy.windowMs > nowMs &&
    (row.failures >= policy.limit || row.blocked_until_ms > nowMs)
}

export async function recordFailure(
  env: Env,
  bucketKey: string,
  policy: ThrottlePolicy,
  nowMs: number,
): Promise<boolean> {
  const resetBeforeMs = nowMs - policy.windowMs
  const row = await env.DB.prepare(
    `INSERT INTO auth_throttle (bucket_key, failures, window_started_at_ms, blocked_until_ms)
     VALUES (?, 1, ?, ?)
     ON CONFLICT(bucket_key) DO UPDATE SET
       failures = CASE WHEN window_started_at_ms <= ? THEN 1 ELSE failures + 1 END,
       window_started_at_ms = CASE WHEN window_started_at_ms <= ? THEN ? ELSE window_started_at_ms END,
       blocked_until_ms = CASE
         WHEN window_started_at_ms <= ? THEN ?
          WHEN failures + 1 >= ? THEN window_started_at_ms + ?
         ELSE 0 END
     WHERE window_started_at_ms <= ? OR failures < ?
     RETURNING failures`,
  ).bind(
    bucketKey, nowMs, policy.limit === 1 ? nowMs + policy.windowMs : 0,
    resetBeforeMs, resetBeforeMs, nowMs,
    resetBeforeMs, policy.limit === 1 ? nowMs + policy.windowMs : 0,
    policy.limit, policy.windowMs,
    resetBeforeMs, policy.limit,
  ).first<{ failures: number }>()
  return row !== null
}

export async function recordSignup(env: Env, bucketKey: string, nowMs: number): Promise<boolean> {
  return recordFailure(env, bucketKey, SIGNUP_POLICY, nowMs)
}

export async function releaseReservation(
  env: Env,
  bucketKey: string,
  policy: ThrottlePolicy,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE auth_throttle SET
       failures = MAX(failures - 1, 0),
       blocked_until_ms = CASE WHEN failures - 1 < ? THEN 0 ELSE blocked_until_ms END
     WHERE bucket_key = ?`,
  ).bind(policy.limit, bucketKey).run()
}

export async function clearThrottle(env: Env, bucketKey: string): Promise<void> {
  await env.DB.prepare('DELETE FROM auth_throttle WHERE bucket_key = ?').bind(bucketKey).run()
}
