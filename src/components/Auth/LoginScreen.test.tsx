import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError, loginSimple, registerSimple } from '../../api/client'
import type { SessionDto } from '../../api/contracts'
import { getAuthRoute, getDeploymentTarget, LoginScreen, RouteChoice } from './LoginScreen'

vi.mock('../../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api/client')>()
  return { ...original, loginSimple: vi.fn(), registerSimple: vi.fn() }
})

const session: SessionDto = {
  user: { id: 'simple-user', authType: 'simple', displayName: 'Otter' },
  progress: { unlockedStage: 1, stageRecords: {} },
}

beforeEach(() => vi.resetAllMocks())
afterEach(() => {
  window.history.replaceState(null, '', '/')
  vi.unstubAllEnvs()
})

function fillSimple(nickname = 'Otter', pin = '0042'): void {
  fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: nickname } })
  fireEvent.change(screen.getByLabelText('숫자 4자리 PIN'), { target: { value: pin } })
}

function submitSimple(): void {
  fireEvent.submit(screen.getByRole('button', { name: /로그인하기|가입하기/ }).closest('form')!)
}

describe('login screens', () => {
  it('uses Microsoft routes only for the Azure target and defaults other flags to Cloudflare', () => {
    expect(getAuthRoute('/', 'azure')).toBe('microsoft')
    expect(getAuthRoute('/microsoft', 'azure')).toBeNull()
    expect(getAuthRoute('/microsoft/', 'azure')).toBeNull()
    expect(getAuthRoute('/simple', 'azure')).toBeNull()
    expect(getAuthRoute('/unknown', 'azure')).toBeNull()
    vi.stubEnv('VITE_DEPLOY_TARGET', 'azure')
    expect(getDeploymentTarget()).toBe('azure')
    expect(getAuthRoute('/')).toBe('microsoft')
    vi.stubEnv('VITE_DEPLOY_TARGET', 'other')
    expect(getDeploymentTarget()).toBe('cloudflare')
    expect(getAuthRoute('/')).toBeNull()
  })

  it('shows no simple account link or PIN form in Azure route guidance', () => {
    const { rerender } = render(<RouteChoice target="azure" />)
    expect(screen.getByRole('link', { name: 'Microsoft 계정' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('link', { name: '닉네임과 PIN' })).not.toBeInTheDocument()
    rerender(<LoginScreen authType="simple" target="azure" onAuthenticated={vi.fn()} />)
    expect(screen.queryByLabelText('닉네임')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('숫자 4자리 PIN')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '닉네임과 PIN' })).not.toBeInTheDocument()
  })

  it('matches only the two dedicated paths and offers a route choice elsewhere', () => {
    expect(getAuthRoute('/microsoft')).toBe('microsoft')
    expect(getAuthRoute('/microsoft/')).toBe('microsoft')
    expect(getAuthRoute('/simple')).toBe('simple')
    expect(getAuthRoute('/simple/')).toBe('simple')
    expect(getAuthRoute('/')).toBeNull()
    expect(getAuthRoute('/simple/other')).toBeNull()
    expect(getAuthRoute('/unknown')).toBeNull()
    render(<RouteChoice />)
    expect(screen.getByRole('link', { name: 'Microsoft 계정' })).toHaveAttribute('href', '/microsoft')
    expect(screen.getByRole('link', { name: '닉네임과 PIN' })).toHaveAttribute('href', '/simple')
  })

  it('shows only Microsoft sign-in and a generic OAuth failure', () => {
    window.history.replaceState(null, '', '/microsoft?error=login_failed&token=do-not-display')
    render(<LoginScreen authType="microsoft" onAuthenticated={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Microsoft 로그인' })).toBeInTheDocument()
    const form = screen.getByRole('button', { name: 'Microsoft 계정으로 로그인' }).closest('form')!
    expect(form).toHaveAttribute('action', '/api/auth/microsoft/start')
    expect(form).toHaveAttribute('method', 'get')
    expect(screen.getByRole('alert')).toHaveTextContent('Microsoft 로그인에 실패')
    expect(screen.queryByText('do-not-display')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('닉네임')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('숫자 4자리 PIN')).not.toBeInTheDocument()
  })

  it('labels the Azure Microsoft screen navigation as home', () => {
    render(<LoginScreen authType="microsoft" target="azure" onAuthenticated={vi.fn()} />)
    expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('link', { name: '로그인 방식 선택으로' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('숫자 4자리 PIN')).not.toBeInTheDocument()
  })

  it('accepts nickname and a masked four-digit PIN without mixing Microsoft controls', async () => {
    const onAuthenticated = vi.fn()
    vi.mocked(loginSimple).mockResolvedValue(session)
    render(<LoginScreen authType="simple" onAuthenticated={onAuthenticated} />)
    const pin = screen.getByLabelText('숫자 4자리 PIN')
    expect(pin).toHaveAttribute('type', 'password')
    expect(pin).toHaveAttribute('inputmode', 'numeric')
    expect(screen.queryByRole('button', { name: 'Microsoft 계정으로 로그인' })).not.toBeInTheDocument()
    expect(screen.getByText(/새 닉네임으로 다시 가입/)).toBeInTheDocument()
    fillSimple()
    submitSimple()
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(session))
    expect(loginSimple).toHaveBeenCalledWith('Otter', '0042')
    expect(pin).toHaveValue('')
  })

  it('uses registration tab and explains duplicate names, wrong credentials and rate limits', async () => {
    vi.mocked(registerSimple).mockRejectedValueOnce(new ApiClientError(409, 'nickname_taken', 'taken'))
    vi.mocked(loginSimple).mockRejectedValueOnce(new ApiClientError(401, 'invalid_credentials', 'wrong'))
      .mockRejectedValueOnce(new ApiClientError(429, 'rate_limited', 'wait'))
    render(<LoginScreen authType="simple" onAuthenticated={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '가입' }))
    fillSimple()
    submitSimple()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('이미 사용 중인 닉네임'))
    expect(registerSimple).toHaveBeenCalledWith('Otter', '0042')

    fireEvent.click(screen.getByRole('button', { name: '로그인' }))
    fillSimple()
    submitSimple()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('올바르지 않아요'))
    submitSimple()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('시도 횟수가 많아요'))
  })

  it('blocks duplicate submits while a login request is pending', async () => {
    let resolve!: (value: SessionDto) => void
    vi.mocked(loginSimple).mockReturnValue(new Promise((done) => { resolve = done }))
    const onAuthenticated = vi.fn()
    render(<LoginScreen authType="simple" onAuthenticated={onAuthenticated} />)
    fillSimple()
    submitSimple()
    expect(screen.getByRole('button', { name: '처리 중…' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('button', { name: '처리 중…' }).closest('form')!)
    expect(loginSimple).toHaveBeenCalledTimes(1)
    resolve(session)
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1))
  })
})
