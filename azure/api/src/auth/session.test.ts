// @vitest-environment node
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { AzureStore, SessionDoc, UserDoc } from '../model'
import { MICROSOFT_SCOPE } from '../model'
import { ApiFailure, assertSameOriginJson, clearSession, issueSession, readSession, requireSession, sessionDto } from './session'

const now = Date.now()
const user: UserDoc = {
  id: 'u_test', scope: MICROSOFT_SCOPE, type: 'user', tid: 'tenant', sub: 'subject',
  displayName: 'Player', unlockedStage: 4, highestStage: 3,
  bestTimeSeconds: 45, rankTimeSeconds: 45,
  stageRecords: { '3': { bestTimeSeconds: 45 } }, createdAtMs: now, updatedAtMs: now,
}

function storeFixture() {
  const sessions = new Map<string, SessionDoc>()
  let existingUser: UserDoc | null = { ...user }
  const store = {
    putSession: async (doc: SessionDoc) => { sessions.set(doc.id, doc) },
    getSession: async (id: string) => sessions.get(id) ?? null,
    deleteSession: async (id: string) => { sessions.delete(id) },
    getUser: async () => existingUser,
  } as AzureStore
  return { store, sessions, removeUser: () => { existingUser = null } }
}

function request(cookie?: string): Request {
  return new Request('https://game.example/api/me', { headers: cookie ? { Cookie: cookie } : {} })
}

describe('Azure Microsoft session', () => {
  it('stores only a token hash and issues an isolated secure cookie', async () => {
    const { store, sessions } = storeFixture()
    const cookie = await issueSession(store, user.id, now)
    const token = cookie.match(/^__Host-maze_azure_session=([^;]+)/)?.[1]
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(cookie).toContain('HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800')
    const id = `s_${createHash('sha256').update(token!).digest('hex')}`
    expect([...sessions.keys()]).toEqual([id])
    expect(sessions.get(id)).toMatchObject({ userId: user.id, scope: MICROSOFT_SCOPE, ttl: 604800, expiresAtMs: now + 604800000 })
    expect(JSON.stringify([...sessions.values()])).not.toContain(token!)
    expect(await readSession(request(cookie), store, now)).toEqual({ userId: user.id, displayName: 'Player', authType: 'microsoft' })
    expect(await sessionDto(store, await requireSession(request(cookie), store, now))).toEqual({
      user: { id: user.id, authType: 'microsoft', displayName: 'Player' },
      progress: { unlockedStage: 4, stageRecords: { 3: { bestTimeSeconds: 45 } } },
    })
  })

  it('rejects expired, missing, duplicated, and orphaned sessions', async () => {
    const { store, removeUser } = storeFixture()
    const cookie = await issueSession(store, user.id, now)
    expect(await readSession(request(cookie), store, now + 604800000)).toBeNull()
    expect(await readSession(request(), store, now)).toBeNull()
    expect(await readSession(request(`${cookie}; ${cookie}`), store, now)).toBeNull()
    await expect(requireSession(request(), store, now)).rejects.toMatchObject({ status: 401, code: 'unauthorized' })
    removeUser()
    expect(await readSession(request(cookie), store, now)).toBeNull()
  })

  it('deletes the stored hash and clears the browser cookie on logout', async () => {
    const { store, sessions } = storeFixture()
    const cookie = await issueSession(store, user.id, now)
    const response = await clearSession(request(cookie), store)
    expect(response.status).toBe(204)
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(sessions.size).toBe(0)
  })

  it('requires same-origin JSON for state-changing requests', () => {
    const make = (origin?: string, contentType = 'application/json') => new Request('https://game.example/api/runs/start', {
      method: 'POST',
      headers: { ...(origin ? { Origin: origin } : {}), 'Content-Type': contentType },
    })
    expect(() => assertSameOriginJson(make('https://game.example', 'application/json; charset=utf-8'), 'https://game.example')).not.toThrow()
    expect(() => assertSameOriginJson(make('https://other.example'), 'https://game.example')).toThrow(ApiFailure)
    expect(() => assertSameOriginJson(make(), 'https://game.example')).toThrowError(/origin/i)
    expect(() => assertSameOriginJson(make('https://game.example', 'text/plain'), 'https://game.example')).toThrowError(/Content-Type/)
  })
})
