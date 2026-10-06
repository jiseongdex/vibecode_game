import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiClientError, getSession, logout } from '../api/client'
import type { SessionDto } from '../api/contracts'

type AuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'error'

interface AuthState {
  status: AuthStatus
  session: SessionDto | null
  error: string | null
}

const LOADING: AuthState = { status: 'loading', session: null, error: null }
const ANONYMOUS: AuthState = { status: 'anonymous', session: null, error: null }

export function useAuthSession(): AuthState & {
  refresh: () => Promise<void>
  accept: (session: SessionDto) => void
  signOut: () => Promise<void>
} {
  const [state, setState] = useState<AuthState>(LOADING)
  const requestId = useRef(0)

  const refresh = useCallback(async () => {
    const id = ++requestId.current
    setState(LOADING)
    try {
      const session = await getSession()
      if (id === requestId.current) {
        setState({ status: 'authenticated', session, error: null })
      }
    } catch (error) {
      if (id !== requestId.current) return
      if (error instanceof ApiClientError && error.status === 401) {
        setState(ANONYMOUS)
      } else {
        setState({ status: 'error', session: null, error: '로그인 상태를 확인하지 못했습니다. 다시 시도해주세요.' })
      }
    }
  }, [])

  useEffect(() => {
    void refresh()
    return () => { requestId.current += 1 }
  }, [refresh])

  const accept = useCallback((session: SessionDto) => {
    requestId.current += 1
    setState({ status: 'authenticated', session, error: null })
  }, [])

  const signOut = useCallback(async () => {
    const id = ++requestId.current
    setState(LOADING)
    try {
      await logout()
      if (id === requestId.current) setState(ANONYMOUS)
    } catch {
      if (id === requestId.current) {
        setState({ status: 'error', session: null, error: '로그아웃 상태를 확인하지 못했습니다. 다시 시도해주세요.' })
      }
    }
  }, [])

  return { ...state, refresh, accept, signOut }
}
