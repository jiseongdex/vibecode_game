import { useRef, useState, type FormEvent, type ReactElement } from 'react'
import { ApiClientError, loginSimple, registerSimple } from '../../api/client'
import type { AuthType, SessionDto } from '../../api/contracts'
import styles from './LoginScreen.module.css'

export type AuthRoute = AuthType | null
export type DeploymentTarget = 'cloudflare' | 'azure'

export function getDeploymentTarget(): DeploymentTarget {
  return import.meta.env.VITE_DEPLOY_TARGET === 'azure' ? 'azure' : 'cloudflare'
}

export function getAuthRoute(pathname: string, target: DeploymentTarget = getDeploymentTarget()): AuthRoute {
  if (target === 'azure') {
    return pathname === '/' ? 'microsoft' : null
  }
  if (/^\/microsoft\/?$/.test(pathname)) return 'microsoft'
  if (/^\/simple\/?$/.test(pathname)) return 'simple'
  return null
}

function simpleError(error: unknown, mode: 'login' | 'register'): string {
  if (!(error instanceof ApiClientError)) return '요청을 처리하지 못했어요. 다시 시도해주세요.'
  if (error.status === 429) return '시도 횟수가 많아요. 잠시 후 다시 시도해주세요.'
  if (mode === 'register' && error.status === 409) return '이미 사용 중인 닉네임이에요. 다른 이름을 선택해주세요.'
  if (mode === 'login' && error.status === 401) return '닉네임 또는 PIN이 올바르지 않아요.'
  if (error.code === 'invalid_nickname') return '닉네임은 2~20자의 글자, 숫자, _ 또는 -로 입력해주세요.'
  if (error.code === 'invalid_pin') return 'PIN은 숫자 4자리로 입력해주세요.'
  return error.status === 0 || error.status >= 500
    ? '서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.'
    : '요청을 처리하지 못했어요. 입력 내용을 확인해주세요.'
}

export function LoginScreen({
  authType,
  onAuthenticated,
  target = getDeploymentTarget(),
}: {
  authType: AuthType
  onAuthenticated: (session: SessionDto) => void
  target?: DeploymentTarget
}): ReactElement {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [nickname, setNickname] = useState('')
  const [pin, setPin] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pendingRef = useRef(false)

  if (target === 'azure' && authType === 'simple') {
    return <RouteChoice target="azure" />
  }

  async function submitSimple(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (pendingRef.current) return
    if (!/^[0-9]{4}$/.test(pin)) {
      setError('PIN은 숫자 4자리로 입력해주세요.')
      return
    }
    pendingRef.current = true
    setPending(true)
    setError(null)
    try {
      const session = mode === 'login'
        ? await loginSimple(nickname.trim(), pin)
        : await registerSimple(nickname.trim(), pin)
      setPin('')
      onAuthenticated(session)
    } catch (cause) {
      setError(simpleError(cause, mode))
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  return (
    <section className={styles.page} aria-labelledby="auth-heading">
      <div className={styles.card}>
        <span className={styles.eyebrow}>동물구조탐험대</span>
        <h1 id="auth-heading">{authType === 'microsoft' ? 'Microsoft 로그인' : '간편 로그인'}</h1>
        <p className={styles.intro}>로그인하고 동물 친구들을 구하러 떠나요!</p>

        {authType === 'microsoft' ? (
          <>
            <p className={styles.note}>Microsoft 표시 이름과 기록은 Microsoft 사용자 랭킹에 보일 수 있어요.</p>
            {new URLSearchParams(window.location.search).has('error') && (
              <p role="alert" className={styles.error}>Microsoft 로그인에 실패했어요. 다시 시도해주세요.</p>
            )}
            <form action="/api/auth/microsoft/start" method="get">
              <button className={styles.primary} type="submit">Microsoft 계정으로 로그인</button>
            </form>
          </>
        ) : (
          <>
            <div className={styles.tabs} aria-label="간편 계정 방식">
              <button type="button" aria-pressed={mode === 'login'} disabled={pending}
                onClick={() => { setMode('login'); setPin(''); setError(null) }}>로그인</button>
              <button type="button" aria-pressed={mode === 'register'} disabled={pending}
                onClick={() => { setMode('register'); setPin(''); setError(null) }}>가입</button>
            </div>
            <form className={styles.form} onSubmit={(event) => { void submitSimple(event) }}>
              <label htmlFor="auth-nickname">닉네임</label>
              <input id="auth-nickname" name="nickname" autoComplete="username" required
                minLength={2} maxLength={20} value={nickname} disabled={pending}
                onChange={(event) => setNickname(event.target.value)} />
              <label htmlFor="auth-pin">숫자 4자리 PIN</label>
              <input id="auth-pin" name="pin" type="password" inputMode="numeric" pattern="[0-9]{4}"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required minLength={4} maxLength={4} value={pin} disabled={pending}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} />
              {error && <p role="alert" className={styles.error}>{error}</p>}
              <button className={styles.primary} type="submit" disabled={pending}>
                {pending ? '처리 중…' : mode === 'login' ? '로그인하기' : '가입하기'}
              </button>
            </form>
            <p className={styles.note}>PIN을 잊었다면 새 닉네임으로 다시 가입해야 해요. 이전 기록은 복구되지 않아요.</p>
          </>
        )}
        <a className={styles.back} href="/">{target === 'azure' ? '홈으로' : '로그인 방식 선택으로'}</a>
      </div>
    </section>
  )
}

export function RouteChoice({ target = getDeploymentTarget() }: { target?: DeploymentTarget }): ReactElement {
  return (
    <section className={styles.page} aria-labelledby="route-heading">
      <div className={styles.card}>
        <span className={styles.eyebrow}>동물구조탐험대</span>
        <h1 id="route-heading">{target === 'azure' ? 'Microsoft 로그인' : '로그인 방식 선택'}</h1>
        <p className={styles.intro}>{target === 'azure' ? 'Microsoft 계정으로 로그인해 모험을 시작해요.' : '사용할 주소를 선택하고 모험을 시작해요.'}</p>
        <div className={styles.choices}>
          <a href={target === 'azure' ? '/' : '/microsoft'}>Microsoft 계정</a>
          {target === 'cloudflare' && <a href="/simple">닉네임과 PIN</a>}
        </div>
      </div>
    </section>
  )
}
