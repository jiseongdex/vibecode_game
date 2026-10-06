import type { ApiError } from '../src/api/contracts'
import { loginSimple, registerSimple } from './auth/simple'
import { finishMicrosoftLogin, startMicrosoftLogin } from './auth/microsoft'
import {
  ApiFailure,
  assertSameOriginJson,
  clearSession,
  getSessionDto,
  purgeExpiredSessions,
  requireSession,
} from './auth/session'
import type { Env } from './types'
import { finishRun, startRun } from './game/runs'

const noStoreHeaders = { 'Cache-Control': 'no-store' }

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: noStoreHeaders })
}

export function errorResponse(status: number, code: string, message: string): Response {
  const body: ApiError = { error: { code, message } }
  return jsonResponse(body, status)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pathname = new URL(request.url).pathname

    try {
      if (pathname.startsWith('/api/') && request.method === 'POST') {
        assertSameOriginJson(request)
      }

      if (pathname === '/api/health' && request.method === 'GET') {
        return jsonResponse({ status: 'ok' })
      }

      if (pathname === '/api/auth/simple/register' && request.method === 'POST') {
        return await registerSimple(request, env)
      }

      if (pathname === '/api/auth/simple/login' && request.method === 'POST') {
        return await loginSimple(request, env)
      }

      if (pathname === '/api/auth/microsoft/start' && request.method === 'GET') {
        return await startMicrosoftLogin(request, env, Date.now())
      }

      if (pathname === '/api/auth/microsoft/callback' && request.method === 'GET') {
        return await finishMicrosoftLogin(request, env, Date.now())
      }

      if (pathname === '/api/auth/logout' && request.method === 'POST') {
        return await clearSession(request, env)
      }

      if (pathname === '/api/me' && request.method === 'GET') {
        const principal = await requireSession(request, env, Date.now())
        return jsonResponse(await getSessionDto(env, principal))
      }

      if (pathname === '/api/runs/start' && request.method === 'POST') {
        const nowMs = Date.now()
        const principal = await requireSession(request, env, nowMs)
        return await startRun(request, env, principal, nowMs)
      }

      if (pathname === '/api/runs/finish' && request.method === 'POST') {
        const nowMs = Date.now()
        const principal = await requireSession(request, env, nowMs)
        return await finishRun(request, env, principal, nowMs)
      }

      if (pathname.startsWith('/api/')) {
        return errorResponse(404, 'not_found', 'API route not found.')
      }

      return env.ASSETS.fetch(request)
    } catch (error) {
      if (error instanceof ApiFailure) {
        return errorResponse(error.status, error.code, error.message)
      }
      throw error
    }
  },
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    await purgeExpiredSessions(env, controller.scheduledTime)
  },
} satisfies ExportedHandler<Env>
