import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError, getSession, logout } from '../api/client'
import type { SessionDto } from '../api/contracts'
import { useAuthSession } from './useAuthSession'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, getSession: vi.fn(), logout: vi.fn() }
})

const session: SessionDto = {
  user: { id: 'user-1', authType: 'simple', displayName: 'Otter' },
  progress: { unlockedStage: 2, stageRecords: { 1: { bestTimeSeconds: 30 } } },
}

beforeEach(() => vi.resetAllMocks())

describe('useAuthSession', () => {
  it('starts loading and accepts a verified server session', async () => {
    let resolve!: (value: SessionDto) => void
    vi.mocked(getSession).mockReturnValue(new Promise((done) => { resolve = done }))
    const { result } = renderHook(() => useAuthSession())
    expect(result.current.status).toBe('loading')
    expect(result.current.session).toBeNull()
    act(() => resolve(session))
    await waitFor(() => expect(result.current.status).toBe('authenticated'))
    expect(result.current.session).toEqual(session)
  })

  it('treats only 401 as anonymous and retries server or network errors', async () => {
    vi.mocked(getSession).mockRejectedValueOnce(new ApiClientError(401, 'unauthorized', 'Sign in'))
      .mockRejectedValueOnce(new ApiClientError(503, 'unavailable', 'Server down'))
      .mockRejectedValueOnce(new ApiClientError(0, 'network_error', 'Disconnected'))
      .mockResolvedValueOnce(session)
    const { result } = renderHook(() => useAuthSession())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))
    await act(async () => result.current.refresh())
    expect(result.current).toMatchObject({ status: 'error', session: null })
    expect(result.current.error).toMatch(/다시 시도/)
    await act(async () => result.current.refresh())
    expect(result.current).toMatchObject({ status: 'error', session: null })
    await act(async () => result.current.refresh())
    expect(result.current).toMatchObject({ status: 'authenticated', session })
  })

  it('does not allow an old bootstrap response to overwrite accepted login', async () => {
    let resolve!: (value: SessionDto) => void
    vi.mocked(getSession).mockReturnValue(new Promise((done) => { resolve = done }))
    const { result } = renderHook(() => useAuthSession())
    const accepted = { ...session, user: { ...session.user, id: 'new-user' } }
    act(() => result.current.accept(accepted))
    act(() => resolve(session))
    await waitFor(() => expect(result.current.session?.user.id).toBe('new-user'))
  })

  it('closes the game on logout success or failure', async () => {
    vi.mocked(getSession).mockResolvedValue(session)
    vi.mocked(logout).mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ApiClientError(503, 'unavailable', 'Unavailable'))
    const { result } = renderHook(() => useAuthSession())
    await waitFor(() => expect(result.current.status).toBe('authenticated'))
    await act(async () => result.current.signOut())
    expect(result.current).toMatchObject({ status: 'anonymous', session: null })

    act(() => result.current.accept(session))
    await act(async () => result.current.signOut())
    expect(result.current).toMatchObject({ status: 'error', session: null })
  })
})
