import type { ApiError } from '../src/api/contracts'
import type { Env } from './types'

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

    if (pathname === '/api/health' && request.method === 'GET') {
      return jsonResponse({ status: 'ok' })
    }

    if (pathname.startsWith('/api/')) {
      return errorResponse(404, 'not_found', 'API route not found.')
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
