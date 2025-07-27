import MongoMock from 'mongo-mock'
import { Db, MongoClient } from 'mongodb'

import { env } from './env'

/**
 * Handles MongoDB database connections and provides access to database instances.
 * Supports both real MongoDB connections and mock connections for testing.
 */
class ConnectionHandler {
  private client?: MongoClient

  /**
   * Use this if you want to manually close the open connections. This can be useful if
   * you want to gracefully terminate connections in response to a signal.
   */
  async closeConnections(): Promise<void> {
    if (!this.client) {
      return
    }

    await this.client.close()

    this.client = undefined
  }

  /**
   * Returns a connection to the database. Connections are being pooled
   * behind the scenes so there is no need to get multiple connections.
   */
  async getConnection(): Promise<Db> {
    return this.getDatabase()
  }

  private async createClient(): Promise<MongoClient> {
    const adapterName = env('DB_ADAPTER', 'default').toLowerCase()
    const url = env('DB_URL', 'mongodb://127.0.0.1:27017/')

    const deprecatedPoolSizeEnv = env('DB_POOL_SIZE', '10')
    const maxPoolSizeEnv = env('DB_MAX_POOL_SIZE', deprecatedPoolSizeEnv)

    const maxPoolSize = parseInt(maxPoolSizeEnv, 10)

    const adapters: Record<string, typeof MongoClient> = {
      default: MongoClient,
      mock: MongoMock.MongoClient as unknown as typeof MongoClient
    }

    if (!adapters.hasOwnProperty(adapterName)) {
      const validAdapterNames = Object.keys(adapters)
        .map((name) => `'${name}'`)
        .join(', ')

      throw new Error(
        `${adapterName} is not a valid adapter name. Must be one of ${validAdapterNames}.`
      )
    }

    const adapter = adapters[adapterName]

    const client = await adapter.connect(url, {
      maxPoolSize: maxPoolSize
    })

    return client
  }

  private async getDatabase(): Promise<Db> {
    if (!this.client) {
      this.client = await this.createClient()
    }

    const databaseName = env('DB_DATABASE', '')

    return this.client.db(databaseName)
  }
}

const connectionHandler = new ConnectionHandler()

export { ConnectionHandler, connectionHandler }
