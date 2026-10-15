import type { Cookie, HttpRequest, HttpResponseInit } from '@azure/functions'
import { ApiFailure } from './auth/session.js'

const MAX_BODY_BYTES = 4096

async function requestBody(req: HttpRequest): Promise<Uint8Array | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined
  const contentLength = req.headers.get('Content-Length')
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    throw new ApiFailure(413, 'payload_too_large', 'Request body is too large.')
  }
  if (!req.body) return undefined
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_BODY_BYTES) {
        await reader.cancel()
        throw new ApiFailure(413, 'payload_too_large', 'Request body is too large.')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const body = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

export async function toWebRequest(req: HttpRequest, publicOrigin: string): Promise<Request> {
  let incoming: URL
  try {
    incoming = new URL(req.url)
  } catch {
    throw new ApiFailure(400, 'invalid_request', 'Request URL is invalid.')
  }
  const url = new URL(publicOrigin)
  url.pathname = incoming.pathname
  url.search = incoming.search
  const headers = new Headers()
  for (const name of ['Cookie', 'Content-Type', 'Origin']) {
    const value = req.headers.get(name)
    if (value !== null) headers.set(name, value)
  }
  const body = await requestBody(req)
  const payload = body?.byteLength ? new ArrayBuffer(body.byteLength) : undefined
  if (body && payload) new Uint8Array(payload).set(body)
  return new Request(url, {
    method: req.method,
    headers,
    body: payload,
  })
}

function parseCookie(value: string): Cookie {
  const [pair, ...attributes] = value.split(';').map((part) => part.trim())
  const equals = pair.indexOf('=')
  if (equals <= 0) throw new Error('Invalid response cookie.')
  const cookie: Cookie = { name: pair.slice(0, equals), value: pair.slice(equals + 1) }
  for (const attribute of attributes) {
    const [name, ...parts] = attribute.split('=')
    const setting = parts.join('=')
    switch (name.toLowerCase()) {
      case 'httponly': cookie.httpOnly = true; break
      case 'secure': cookie.secure = true; break
      case 'path': cookie.path = setting; break
      case 'domain': cookie.domain = setting; break
      case 'samesite':
        if (setting === 'Lax' || setting === 'Strict' || setting === 'None') cookie.sameSite = setting
        break
      case 'max-age': cookie.maxAge = Number(setting); break
    }
  }
  return cookie
}

export async function toFunctionResponse(response: Response): Promise<HttpResponseInit> {
  const headers = new Headers(response.headers)
  headers.delete('Set-Cookie')
  const cookies = response.headers.getSetCookie().map(parseCookie)
  return {
    status: response.status,
    headers,
    ...(cookies.length ? { cookies } : {}),
    ...(response.body ? { body: await response.text() } : {}),
  }
}

export function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
