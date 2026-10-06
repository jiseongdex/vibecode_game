import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import type { Env } from '../types'

export interface TestEnv {
  env: Env
  fetch: (request: Request) => Promise<Response>
  dispose: () => Promise<void>
}

export async function createTestEnv(options: { pinPepper?: string | null } = {}): Promise<TestEnv> {
  const entryPoint = fileURLToPath(new URL('../index.ts', import.meta.url))
  const migrationPath = fileURLToPath(new URL('../../migrations/0001_initial.sql', import.meta.url))
  const bundle = await build({
    entryPoints: [entryPoint],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
  })

  const mf = new Miniflare(convertV4MiniflareOptions({
    script: bundle.outputFiles[0].text,
    modules: true,
    compatibilityDate: '2026-10-02',
    d1Databases: { DB: crypto.randomUUID() },
    bindings: options.pinPepper === null
      ? {}
      : { PIN_PEPPER: options.pinPepper ?? 'test-only-pepper-never-use-in-production' },
  }))

  try {
    const db = await mf.getD1Database('DB')
    const migration = await readFile(migrationPath, 'utf8')
    for (const statement of migration.split(';').map((part) => part.trim()).filter(Boolean)) {
      await db.prepare(statement).run()
    }

    return {
      env: {
        DB: db,
        PIN_PEPPER: options.pinPepper === null
          ? undefined
          : options.pinPepper ?? 'test-only-pepper-never-use-in-production',
      } as Env,
      fetch: async (request) => {
        const response = await mf.dispatchFetch(request.url, {
          method: request.method,
          headers: Object.fromEntries(request.headers.entries()),
          body: request.method === 'GET' || request.method === 'HEAD'
            ? undefined
            : await request.arrayBuffer(),
        })
        // Miniflare returns a Node fetch Response with the same API surface used here.
        return response as unknown as Response
      },
      dispose: () => mf.dispose(),
    }
  } catch (error) {
    await mf.dispose()
    throw error
  }
}
