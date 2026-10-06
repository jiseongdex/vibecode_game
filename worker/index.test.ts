// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { createTestEnv, type TestEnv } from './test/createTestEnv'

const activeEnvironments: TestEnv[] = []

afterEach(async () => {
  await Promise.all(activeEnvironments.splice(0).map(({ dispose }) => dispose()))
})

describe('Worker API foundation', () => {
  it('returns a no-store health response', async () => {
    const testEnv = await createTestEnv()
    activeEnvironments.push(testEnv)

    const response = await testEnv.fetch(new Request('http://localhost/api/health'))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('returns a JSON 404 for unknown API routes', async () => {
    const testEnv = await createTestEnv()
    activeEnvironments.push(testEnv)

    const response = await testEnv.fetch(new Request('http://localhost/api/missing'))

    expect(response.status).toBe(404)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({
      error: { code: 'not_found', message: 'API route not found.' },
    })
  })

  it('creates the account and record tables in isolated D1', async () => {
    const testEnv = await createTestEnv()
    activeEnvironments.push(testEnv)

    const { results } = await testEnv.env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users', 'sessions', 'oauth_flows', 'auth_throttle', 'attempts', 'stage_records') ORDER BY name",
    ).all<{ name: string }>()

    expect(results.map(({ name }) => name)).toEqual([
      'attempts', 'auth_throttle', 'oauth_flows', 'sessions', 'stage_records', 'users',
    ])
  })
})
