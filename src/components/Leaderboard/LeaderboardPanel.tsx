import { useEffect, useRef, useState, type ReactElement } from 'react'

import { ApiClientError, getLeaderboard } from '../../api/client'
import type { AuthType, LeaderboardDto, LeaderboardEntry } from '../../api/contracts'
import { ActionIcon } from '../Decorations/ActionIcon'
import { formatTime } from '../Hud/GameHud'
import styles from './LeaderboardPanel.module.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: LeaderboardDto }

const PAGE_SIZE = 10

function RankingRow({ entry, currentUserId }: {
  entry: LeaderboardEntry
  currentUserId: string
}): ReactElement {
  const isCurrentUser = entry.userId === currentUserId
  return (
    <li className={`${styles.row} ${isCurrentUser ? styles.currentUser : ''}`}
      data-current-user={isCurrentUser ? 'true' : undefined}>
      <span className={styles.rank}>{entry.rank}위</span>
      <strong className={styles.name} title={entry.displayName}>{entry.displayName}</strong>
      <span className={styles.stage}>{entry.highestStage}단계</span>
      <span className={styles.time}>
        {entry.bestTimeSeconds === null ? '기록 없음' : `최단 ${formatTime(entry.bestTimeSeconds)}`}
      </span>
    </li>
  )
}

function EmptyRankingRow({ rank }: { rank: number }): ReactElement {
  return (
    <li className={`${styles.row} ${styles.emptyRow}`} aria-label={`${rank}위 기록 없음`}>
      <span className={styles.rank}>{rank}위</span>
      <strong className={styles.name} />
      <span className={styles.stage} />
      <span className={styles.time} />
    </li>
  )
}

export function LeaderboardPanel({
  authType,
  currentUserId,
  currentDisplayName,
  onUnauthorized,
}: {
  authType: AuthType
  currentUserId: string
  currentDisplayName: string
  onUnauthorized: () => Promise<void>
}): ReactElement {
  const identity = `${authType}:${currentUserId}`
  const [response, setResponse] = useState<{ identity: string; state: LoadState }>({
    identity,
    state: { status: 'loading' },
  })
  const [requestNumber, setRequestNumber] = useState(0)
  const [page, setPage] = useState(1)
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    let active = true
    setPage(1)
    setResponse({ identity, state: { status: 'loading' } })
    void getLeaderboard().then((data) => {
      if (active) setResponse({ identity, state: { status: 'ready', data } })
    }).catch((error: unknown) => {
      if (!active) return
      if (error instanceof ApiClientError && error.status === 401) {
        setResponse({ identity, state: { status: 'error', message: '로그인 상태를 다시 확인하고 있어요.' } })
        void onUnauthorized()
        return
      }
      setResponse({ identity, state: { status: 'error', message: '랭킹을 불러오지 못했어요. 다시 시도해주세요.' } })
    })
    return () => { active = false }
  }, [identity, onUnauthorized, requestNumber])

  const loadState: LoadState = response.identity === identity ? response.state : { status: 'loading' }
  const data = loadState.status === 'ready' ? loadState.data : null
  const pageCount = data ? Math.max(1, Math.ceil(data.top.length / PAGE_SIZE)) : 1
  const currentPage = Math.min(page, pageCount)
  const visibleEntries = data?.top.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) ?? []

  const retry = () => {
    setPage(1)
    setResponse({ identity, state: { status: 'loading' } })
    setRequestNumber((value) => value + 1)
  }

  const changePage = (nextPage: number) => {
    setPage(nextPage)
    if (listRef.current) listRef.current.scrollTop = 0
  }

  return (
    <section className={styles.panel} aria-labelledby="leaderboard-heading">
      <div className={styles.header}>
        <h2 id="leaderboard-heading">
          {authType === 'microsoft' ? 'Microsoft 랭킹' : '간편 계정 랭킹'}
        </h2>
      </div>
      {authType === 'microsoft' && (
        <p className={styles.privacy}>Microsoft 계정의 표시 이름이 랭킹에 공개됩니다. 실명일 수 있어요.</p>
      )}

      {loadState.status === 'loading' && <p className={styles.message} role="status">랭킹을 불러오는 중…</p>}
      {loadState.status === 'error' && (
        <div className={styles.message}>
          <p role="alert">{loadState.message}</p>
          <button type="button" onClick={retry}>다시 시도</button>
        </div>
      )}
      {data && (
        <>
          <section className={styles.myRecord} aria-labelledby="my-record-heading">
            <h3 id="my-record-heading">내 기록</h3>
            <ol className={styles.list} aria-label="내 기록">
              {data.current ? (
                <RankingRow entry={data.current} currentUserId={currentUserId} />
              ) : (
                <li className={`${styles.row} ${styles.currentUser}`}>
                  <span className={styles.rank}>순위 없음</span>
                  <strong className={styles.name} title={currentDisplayName}>{currentDisplayName}</strong>
                  <span className={styles.stage}>기록 없음</span>
                </li>
              )}
            </ol>
          </section>
          <section className={styles.rankings} aria-labelledby="ranking-list-heading">
            <h3 id="ranking-list-heading">전체 순위</h3>
            <ol ref={listRef} className={`${styles.list} ${styles.topList}`} aria-label="상위 100명 랭킹" tabIndex={0}>
              {Array.from({ length: PAGE_SIZE }, (_, index) => {
                const entry = visibleEntries[index]
                const slotRank = (currentPage - 1) * PAGE_SIZE + index + 1
                return entry
                  ? <RankingRow key={entry.userId} entry={entry} currentUserId={currentUserId} />
                  : <EmptyRankingRow key={`empty-${slotRank}`} rank={slotRank} />
              })}
            </ol>
            <div className={styles.pagination} aria-label="랭킹 페이지">
              <button type="button" aria-label="이전 페이지" title="이전 페이지" disabled={currentPage === 1}
                onClick={() => changePage(Math.max(1, currentPage - 1))}><ActionIcon kind="arrow-left" /></button>
              <span aria-live="polite">{currentPage}/{pageCount} 페이지</span>
              <button type="button" aria-label="다음 페이지" title="다음 페이지" disabled={currentPage === pageCount}
                onClick={() => changePage(Math.min(pageCount, currentPage + 1))}><ActionIcon kind="arrow-right" /></button>
            </div>
          </section>
        </>
      )}
    </section>
  )
}
