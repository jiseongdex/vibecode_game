import { describe, expect, it } from 'vitest'
import { AzureConfigError, loadConfig } from './config'

const valid = {
  COSMOS_ENDPOINT: 'https://maze.documents.azure.com/',
  COSMOS_KEY: 'private-cosmos-key',
  PUBLIC_ORIGIN: 'https://maze.example.com',
  MICROSOFT_CLIENT_ID: 'client-id',
  MICROSOFT_CLIENT_SECRET: 'private-client-secret',
}

describe('loadConfig', () => {
  it('reads server-only values and accepts a local HTTP origin for development', () => {
    expect(loadConfig(valid)).toMatchObject({
      cosmosEndpoint: 'https://maze.documents.azure.com',
      cosmosDatabase: 'maze-rescue',
      publicOrigin: 'https://maze.example.com',
    })
    expect(loadConfig({ ...valid, PUBLIC_ORIGIN: 'http://localhost:4280' }).publicOrigin)
      .toBe('http://localhost:4280')
  })

  it('rejects missing secrets and malformed origins without exposing values in errors', () => {
    for (const input of [
      { ...valid, COSMOS_KEY: '' },
      { ...valid, PUBLIC_ORIGIN: 'http://maze.example.com' },
      { ...valid, PUBLIC_ORIGIN: 'https://maze.example.com/path' },
      { ...valid, COSMOS_ENDPOINT: 'https://maze.documents.azure.com/?key=leak' },
    ]) {
      expect(() => loadConfig(input)).toThrow(AzureConfigError)
      try {
        loadConfig(input)
      } catch (error) {
        expect(String(error)).not.toContain('private-cosmos-key')
        expect(String(error)).not.toContain('private-client-secret')
      }
    }
  })
})
