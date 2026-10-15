import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { ApiFailure, assertSameOriginJson, clearSession, requireSession, sessionDto } from './auth/session.js'
import { finishMicrosoftLogin, startMicrosoftLogin } from './auth/microsoft.js'
import { AzureConfigError, loadConfig, type AzureConfig } from './config.js'
import { createCosmosStore } from './cosmosStore.js'
import { getLeaderboard } from './game/leaderboard.js'
import { finishRun, startRun } from './game/runs.js'
import { errorResponse, toFunctionResponse, toWebRequest } from './http.js'
import type { AzureStore } from './model.js'

interface HandlerDependencies {
  config: (env: NodeJS.ProcessEnv) => AzureConfig
  store: (config: AzureConfig) => AzureStore
  now: () => number
  fetcher: typeof fetch
}

const defaults: HandlerDependencies = {
  config: loadConfig,
  store: createCosmosStore,
  now: Date.now,
  fetcher: fetch,
}

const routes = [
  ['health', 'GET'],
  ['auth/microsoft/start', 'GET'],
  ['auth/microsoft/callback', 'GET'],
  ['auth/logout', 'POST'],
  ['me', 'GET'],
  ['leaderboard', 'GET'],
  ['runs/start', 'POST'],
  ['runs/finish', 'POST'],
] as const

export function createApiHandler(overrides: Partial<HandlerDependencies> = {}) {
  const dependencies = { ...defaults, ...overrides }
  return async (req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    const method = req.method.toUpperCase()
    let path: string
    try {
      path = new URL(req.url).pathname
    } catch {
      return toFunctionResponse(errorResponse(400, 'invalid_request', 'Request URL is invalid.'))
    }
    const route = path.startsWith('/api/') ? path.slice('/api/'.length) : ''
    const known = routes.some(([registeredPath, registeredMethod]) =>
      route === registeredPath && method === registeredMethod)
    if (!known) {
      return toFunctionResponse(errorResponse(404, 'not_found', 'API route not found.'))
    }
    if (route === 'health') {
      return toFunctionResponse(Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } }))
    }
    try {
      const config = dependencies.config(process.env)
      const store = dependencies.store(config)
      const request = await toWebRequest(req, config.publicOrigin)
      if (method === 'POST') assertSameOriginJson(request, config.publicOrigin)
      const nowMs = dependencies.now()
      let response: Response
      switch (route) {
        case 'auth/microsoft/start':
          response = await startMicrosoftLogin(request, store, config, nowMs)
          break
        case 'auth/microsoft/callback':
          response = await finishMicrosoftLogin(request, store, config, nowMs, dependencies.fetcher)
          break
        case 'auth/logout':
          response = await clearSession(request, store)
          break
        case 'me': {
          const principal = await requireSession(request, store, nowMs)
          response = Response.json(await sessionDto(store, principal), { headers: { 'Cache-Control': 'no-store' } })
          break
        }
        case 'leaderboard': {
          const principal = await requireSession(request, store, nowMs)
          response = Response.json(await getLeaderboard(store, principal), { headers: { 'Cache-Control': 'no-store' } })
          break
        }
        case 'runs/start': {
          const principal = await requireSession(request, store, nowMs)
          response = await startRun(request, store, principal, nowMs)
          break
        }
        case 'runs/finish': {
          const principal = await requireSession(request, store, nowMs)
          response = await finishRun(request, store, principal, nowMs)
          break
        }
        default:
          response = errorResponse(404, 'not_found', 'API route not found.')
      }
      return toFunctionResponse(response)
    } catch (error) {
      if (error instanceof ApiFailure) {
        return toFunctionResponse(errorResponse(error.status, error.code, error.message))
      }
      if (error instanceof AzureConfigError) {
        return toFunctionResponse(errorResponse(503, 'service_unavailable', 'Service is unavailable.'))
      }
      return toFunctionResponse(errorResponse(500, 'internal_error', 'An unexpected error occurred.'))
    }
  }
}

export const handleApi = createApiHandler()

export function registerRoutes(register: typeof app.http = app.http): void {
  for (const [route, method] of routes) {
    register(`maze-${route.replaceAll('/', '-')}`, {
      route,
      methods: [method],
      authLevel: 'anonymous',
      handler: handleApi,
    })
  }

  register('maze-not-found', {
    route: '{*path}',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    authLevel: 'anonymous',
    handler: handleApi,
  })
}

registerRoutes()
