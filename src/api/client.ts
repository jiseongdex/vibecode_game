import type {
  ApiError,
  FinishRunDto,
  FinishRunRequest,
  LeaderboardDto,
  SessionDto,
  StartRunDto,
  StartRunRequest,
} from './contracts'

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

function serverError(value: unknown): ApiError['error'] | null {
  if (!value || typeof value !== 'object' || !('error' in value)) return null
  const error = value.error
  if (!error || typeof error !== 'object' || !('code' in error) || !('message' in error)) return null
  return typeof error.code === 'string' && typeof error.message === 'string'
    ? { code: error.code, message: error.message }
    : null
}

export async function requestJson<T>(
  path: `/api/${string}`,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<T> {
  const method = options.method ?? 'GET'
  let response: Response
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      ...(method === 'POST'
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options.body ?? {}) }
        : {}),
    })
  } catch {
    throw new ApiClientError(0, 'network_error', '서버에 연결하지 못했습니다. 다시 시도해주세요.')
  }

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null)
    const apiError = serverError(payload)
    throw new ApiClientError(
      response.status,
      apiError?.code ?? 'request_failed',
      apiError?.message ?? '요청을 처리하지 못했습니다. 다시 시도해주세요.',
    )
  }
  if (response.status === 204) return undefined as T
  try {
    return await response.json() as T
  } catch {
    throw new ApiClientError(response.status, 'invalid_response', '서버 응답을 읽지 못했습니다.')
  }
}

export function getSession(): Promise<SessionDto> {
  return requestJson('/api/me')
}

export function registerSimple(nickname: string, pin: string): Promise<SessionDto> {
  return requestJson('/api/auth/simple/register', {
    method: 'POST', body: { nickname, pin },
  })
}

export function loginSimple(nickname: string, pin: string): Promise<SessionDto> {
  return requestJson('/api/auth/simple/login', {
    method: 'POST', body: { nickname, pin },
  })
}

export function logout(): Promise<void> {
  return requestJson('/api/auth/logout', { method: 'POST', body: {} })
}

export function startRun(stage: number): Promise<StartRunDto> {
  const body: StartRunRequest = { stage }
  return requestJson('/api/runs/start', { method: 'POST', body })
}

export function finishRun(attemptId: string, clearTimeSeconds: number): Promise<FinishRunDto> {
  const body: FinishRunRequest = { attemptId, clearTimeSeconds }
  return requestJson('/api/runs/finish', { method: 'POST', body })
}

export function getLeaderboard(): Promise<LeaderboardDto> {
  return requestJson('/api/leaderboard')
}
