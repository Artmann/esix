import { MongoClient } from 'mongodb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConnectionHandler } from './connection-handler'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function client() {
  return {
    db: vi.fn(() => ({ connected: true })),
    close: vi.fn(async () => {})
  }
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('connection lifecycle', () => {
  it('shares initialization and closes every opened client', async () => {
    vi.stubEnv('DB_ADAPTER', 'default')
    const pending = deferred<MongoClient>()
    const connect = vi
      .spyOn(MongoClient, 'connect')
      .mockReturnValue(pending.promise)
    const handler = new ConnectionHandler()
    const reads = Array.from({ length: 10 }, () => handler.getConnection())
    const opened = client()
    pending.resolve(opened as unknown as MongoClient)
    await Promise.all(reads)
    expect(connect).toHaveBeenCalledTimes(1)
    await handler.closeConnections()
    expect(opened.close).toHaveBeenCalledTimes(1)
  })
  it('shares failures and permits a fresh retry', async () => {
    vi.stubEnv('DB_ADAPTER', 'default')
    const pending = deferred<MongoClient>()
    const opened = client()
    const connect = vi
      .spyOn(MongoClient, 'connect')
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue(opened as unknown as MongoClient)
    const handler = new ConnectionHandler()
    const results = Promise.allSettled([
      handler.getConnection(),
      handler.getConnection()
    ])
    pending.reject(new Error('offline'))
    expect((await results).map((result) => result.status)).toEqual([
      'rejected',
      'rejected'
    ])
    await handler.getConnection()
    expect(connect).toHaveBeenCalledTimes(2)
    await handler.closeConnections()
  })
  it('waits for pending initialization during shutdown', async () => {
    vi.stubEnv('DB_ADAPTER', 'default')
    const pending = deferred<MongoClient>()
    vi.spyOn(MongoClient, 'connect').mockReturnValue(pending.promise)
    const handler = new ConnectionHandler()
    const read = handler.getConnection()
    const closing = handler.closeConnections()
    const opened = client()
    pending.resolve(opened as unknown as MongoClient)
    await Promise.all([read, closing])
    expect(opened.close).toHaveBeenCalledTimes(1)
  })
  it('waits for a single shutdown before reconnecting', async () => {
    vi.stubEnv('DB_ADAPTER', 'default')
    const closed = deferred<void>()
    const first = client()
    first.close.mockReturnValue(closed.promise)
    const second = client()
    const connect = vi
      .spyOn(MongoClient, 'connect')
      .mockResolvedValueOnce(first as unknown as MongoClient)
      .mockResolvedValue(second as unknown as MongoClient)
    const handler = new ConnectionHandler()
    await handler.getConnection()
    const close1 = handler.closeConnections()
    const close2 = handler.closeConnections()
    const next = handler.getConnection()
    closed.resolve()
    await Promise.all([close1, close2, next])
    expect(first.close).toHaveBeenCalledTimes(1)
    expect(connect).toHaveBeenCalledTimes(2)
    expect(second.db).toHaveBeenCalledTimes(1)
    await handler.closeConnections()
  })
})
