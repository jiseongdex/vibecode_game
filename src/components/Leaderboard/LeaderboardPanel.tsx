import { useEffect, useState, type ReactElement } from 'react'

import { ApiClientError, getLeaderboard } from '../../api/client'
import type { AuthType, LeaderboardDto, LeaderboardEntry } from '../../api/contracts'
import { formatTime } from '../Hud/GameHud'
import styles from './LeaderboardPanel.module.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: LeaderboardDto }

function RankingRow({ entry, currentUserId }: {
  entry: LeaderboardEntry
  currentUserId: string
}): ReactElement {
  const isCurrentUser = entry.userId === currentUserId
  return (
    <li className={`${styles.row} ${isCurrentUser ? styles.currentUser : ''}`}
      data-current-user={isCurrentUser ? 'true' : undefined}>
      <span className={styles.rank}>{entry.rank}위</span>
      <strong className={styles.name}>{entry.displayName}</strong>
      <span className={styles.stage}>최고 {entry.highestStage}단계</span>
      <span className={styles.time}>최단 {formatTime(entry.bestTimeSeconds)}</span>
      {isCurrentUser && <span className={styles.myBadge}>내 기록</span>}
    </li>
  )
}

export function LeaderboardPanel({
  authType,
  currentUserId,
  onUnauthorized,
}: {
  authType: AuthType
  currentUserId: string
  onUnauthorized: () => Promise<void>
}): ReactElement {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const [requestNumber, setRequestNumber] = useState(0)

  useEffect(() => {
    let active = true
    setLoadState({ status: 'loading' })
    void getLeaderboard().then((data) => {
      if (active) setLoadState({ status: 'ready', data })
    }).catch((error: unknown) => {
      if (!active) return
      if (error instanceof ApiClientError && error.status === 401) {
        setLoadState({ status: 'error', message: '로그인 상태를 다시 확인하고 있어요.' })
        void onUnauthorized()
        return
      }
      setLoadState({ status: 'error', message: '랭킹을 불러오지 못했어요. 다시 시도해주세요.' })
    })
    return () => { active = false }
  }, [authType, currentUserId, onUnauthorized, requestNumber])

  const data = loadState.status === 'ready' ? loadState.data : null
  const currentInTop = data?.top.some((entry) => entry.userId === currentUserId) ?? false

  return (
    <section className={styles.panel} aria-labelledby="leaderboard-heading">
      <div className={styles.header}>
        <div>
          <h2 id="leaderboard-heading">
            {authType === 'microsoft' ? 'Microsoft 랭킹' : '간편 계정 랭킹'}
          </h2>
          <p>전체 기간 · 최고 완료 단계 우선, 같은 단계에서는 최단 시간 우선</p>
        </div>
      </div>
      {authType === 'microsoft' && (
        <p className={styles.privacy}>Microsoft 계정의 표시 이름이 랭킹에 공개됩니다. 실명일 수 있어요.</p>
      )}

      {loadState.status === 'loading' && <p className={styles.message} role="status">랭킹을 불러오는 중…</p>}
      {loadState.status === 'error' && (
        <div className={styles.message}>
          <p role="alert">{loadState.message}</p>
          <button type="button" onClick={() => setRequestNumber((value) => value + 1)}>다시 시도</button>
        </div>
      )}
      {data && (
        <>
          {data.top.length === 0 ? (
            <p className={styles.message}>아직 랭킹 기록이 없어요. 첫 번째로 단계를 완료해보세요!</p>
          ) : (
            <ol className={styles.list} aria-label="상위 100명 랭킹">
              {data.top.map((entry) => (
                <RankingRow key={entry.userId} entry={entry} currentUserId={currentUserId} />
              ))}
            </ol>
          )}

          {data.current === null ? (
            <p className={styles.message}>아직 완료한 단계가 없어 순위가 없습니다.</p>
          ) : !currentInTop && (
            <div className={styles.outsideTop}>
              <h3>내 순위</h3>
              <ol className={styles.list} aria-label="내 순위">
                <RankingRow entry={data.current} currentUserId={currentUserId} />
              </ol>
            </div>
          )}
        </>
      )}
    </section>
  )
}
