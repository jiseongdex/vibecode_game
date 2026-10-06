import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionDto } from './contracts'
import {
  ApiClientError,
  finishRun,
  getLeaderboard,
  getSession,
  loginSimple,
  logout,
  registerSimple,
  startRun,
} from './client'

const session: SessionDto = {
  user: { id: 'test-user', authType: 'simple', displayName: 'Otter' },
  progress: { unlockedStage: 1, stageRecords: {} },
}

afterEach(() => vi.unstubAllGlobals())

describe('API client', () => {
  it('uses relative same-origin Cookie requests and typed JSON bodies', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => Response.json(session))
    vi.stubGlobal('fetch', fetchMock)

    expect(await getSession()).toEqual(session)
    expect(await registerSimple('Otter', '0042')).toEqual(session)
    await loginSimple('Otter', '0042')
    await startRun(1)
    await finishRun('attempt-id', 25)
    await getLeaderboard()

    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      '/api/me', '/api/auth/simple/register', '/api/auth/simple/login',
      '/api/runs/start', '/api/runs/finish', '/api/leaderboard',
    ])
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toMatchObject({ credentials: 'same-origin', cache: 'no-store' })
    }
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Otter', pin: '0042' }),
    })
    expect(fetchMock.mock.calls[3][1].body).toBe(JSON.stringify({ stage: 1 }))
    expect(fetchMock.mock.calls[4][1].body)
      .toBe(JSON.stringify({ attemptId: 'attempt-id', clearTimeSeconds: 25 }))
  })

  it('handles a no-content logout response with a JSON POST', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(logout()).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({
      method: 'POST', credentials: 'same-origin', body: '{}',
    }))
  })

  it.each([
    [401, 'unauthorized'], [429, 'rate_limited'], [503, 'auth_unavailable'],
  ])('preserves API status %i and error code %s', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      error: { code, message: 'Server explanation' },
    }, { status })))
    await expect(getSession()).rejects.toMatchObject({
      status, code, message: 'Server explanation',
    })
  })

  it('uses safe fallbacks for malformed errors, invalid success JSON and network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>failed</html>', { status: 500 })))
    await expect(getSession()).rejects.toMatchObject({ status: 500, code: 'request_failed' })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 200 })))
    await expect(getSession()).rejects.toMatchObject({ status: 200, code: 'invalid_response' })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('secret URL or token')))
    await expect(getSession()).rejects.toEqual(new ApiClientError(
      0, 'network_error', '서버에 연결하지 못했습니다. 다시 시도해주세요.',
    ))
  })
})
