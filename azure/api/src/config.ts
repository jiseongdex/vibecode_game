export interface AzureConfig {
  cosmosEndpoint: string
  cosmosKey: string
  cosmosDatabase: 'maze-rescue'
  publicOrigin: string
  microsoftClientId: string
  microsoftClientSecret: string
}

export class AzureConfigError extends Error {
  constructor() {
    super('Azure API configuration is incomplete or invalid.')
  }
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim()
  if (!value) throw new AzureConfigError()
  return value
}

function origin(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new AzureConfigError()
  }
  const isLocalHttp = url.protocol === 'http:' && url.hostname === 'localhost'
  if (
    (url.protocol !== 'https:' && !isLocalHttp) ||
    value !== url.origin || url.username || url.password ||
    url.pathname !== '/' || url.search || url.hash
  ) {
    throw new AzureConfigError()
  }
  return url.origin
}

export function loadConfig(env: NodeJS.ProcessEnv): AzureConfig {
  const cosmosEndpoint = required(env, 'COSMOS_ENDPOINT')
  let cosmosUrl: URL
  try {
    cosmosUrl = new URL(cosmosEndpoint)
  } catch {
    throw new AzureConfigError()
  }
  if (
    cosmosUrl.protocol !== 'https:' || cosmosUrl.username || cosmosUrl.password ||
    cosmosUrl.pathname !== '/' || cosmosUrl.search || cosmosUrl.hash
  ) {
    throw new AzureConfigError()
  }
  return {
    cosmosEndpoint: cosmosUrl.origin,
    cosmosKey: required(env, 'COSMOS_KEY'),
    cosmosDatabase: 'maze-rescue',
    publicOrigin: origin(required(env, 'PUBLIC_ORIGIN')),
    microsoftClientId: required(env, 'MICROSOFT_CLIENT_ID'),
    microsoftClientSecret: required(env, 'MICROSOFT_CLIENT_SECRET'),
  }
}
