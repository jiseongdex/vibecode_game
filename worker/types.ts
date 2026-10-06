import type { AuthType } from '../src/api/contracts'

export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  MICROSOFT_CLIENT_ID?: string
  MICROSOFT_CLIENT_SECRET?: string
  PIN_PEPPER?: string
}

export interface DbUser {
  id: string
  auth_type: AuthType
  display_name: string
  nickname_key: string | null
  microsoft_tid: string | null
  microsoft_sub: string | null
  pin_salt: string | null
  pin_hash: string | null
  unlocked_stage: number
  highest_completed_stage: number | null
  highest_stage_best_time_seconds: number | null
  created_at_ms: number
  updated_at_ms: number
}

export interface SessionPrincipal {
  userId: string
  authType: AuthType
  displayName: string
}
