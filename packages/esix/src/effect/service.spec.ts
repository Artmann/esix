import { Cause, Effect, Exit, Fiber, Redacted } from 'effect'
import { MongoClient } from 'mongodb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BaseModel } from 'esix'
import { Esix } from './service'

const options = { url: Redacted.make('mongodb://127.0.0.1:27028/test') }
class User extends BaseModel {}
afterEach(() => vi.restoreAllMocks())

describe('Esix Layers', () => {
  it('owns one client per layer and closes it on success', async () => {
    const connect = vi
      .spyOn(MongoClient.prototype, 'connect')
      .mockImplementation(async function (this: MongoClient) {
        return this
      })
    const close = vi.spyOn(MongoClient.prototype, 'close').mockResolvedValue()
    await Effect.runPromise(Esix.pipe(Effect.provide(Esix.layer(options))))
    expect(connect).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
  })
  it('closes an allocated client when connecting fails and preserves its cause', async () => {
    const cause = new Error('connection failed')
    vi.spyOn(MongoClient.prototype, 'connect').mockRejectedValue(cause)
    const close = vi.spyOn(MongoClient.prototype, 'close').mockResolvedValue()
    const error = await Effect.runPromise(
      Esix.pipe(Effect.provide(Esix.layer(options)), Effect.flip)
    )
    expect(error).toMatchObject({ _tag: 'EsixConnectionError', cause })
    expect(close).toHaveBeenCalledTimes(1)
  })
  it('reports invalid database configuration through the connection error channel', async () => {
    vi.spyOn(MongoClient.prototype, 'connect').mockImplementation(
      async function (this: MongoClient) {
        return this
      }
    )
    const close = vi.spyOn(MongoClient.prototype, 'close').mockResolvedValue()
    const error = await Effect.runPromise(
      Esix.pipe(
        Effect.provide(Esix.layer({ ...options, database: 'invalid.name' })),
        Effect.flip
      )
    )
    expect(error._tag).toBe('EsixConnectionError')
    expect(close).toHaveBeenCalledTimes(1)
  })
  it('borrows Db without connecting or closing it', async () => {
    const client = new MongoClient('mongodb://127.0.0.1:27028')
    const connect = vi.spyOn(client, 'connect'),
      close = vi.spyOn(client, 'close')
    await Effect.runPromise(
      Esix.pipe(Effect.provide(Esix.layerFromDb(client.db('test'))))
    )
    expect(connect).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
  })
  it('rejects use after scope closure without reconnecting', async () => {
    const connect = vi
      .spyOn(MongoClient.prototype, 'connect')
      .mockImplementation(async function (this: MongoClient) {
        return this
      })
    vi.spyOn(MongoClient.prototype, 'close').mockResolvedValue()
    const users = await Effect.runPromise(
      Effect.gen(function* () {
        return (yield* Esix).model(User)
      }).pipe(Effect.provide(Esix.layer(options)))
    )
    const error = await Effect.runPromise(users.get().pipe(Effect.flip))
    expect(error._tag).toBe('EsixQueryError')
    expect(String(error.cause)).toContain('closed')
    expect(connect).toHaveBeenCalledTimes(1)
  })
  it('retains close failures as finalizer defects', async () => {
    vi.spyOn(MongoClient.prototype, 'connect').mockImplementation(
      async function (this: MongoClient) {
        return this
      }
    )
    const cause = new Error('close failed')
    vi.spyOn(MongoClient.prototype, 'close').mockRejectedValue(cause)
    const exit = await Effect.runPromiseExit(
      Esix.pipe(Effect.provide(Esix.layer(options)))
    )
    expect(
      Exit.isFailure(exit) && Array.from(Cause.defects(exit.cause))
    ).toEqual([cause])
  })
  it('cleans up a pending acquisition when interrupted', async () => {
    let settle!: () => void
    let started!: () => void
    const ready = new Promise<void>((resolve) => {
      started = resolve
    })
    vi.spyOn(MongoClient.prototype, 'connect').mockImplementation(function (
      this: MongoClient
    ) {
      started()
      return new Promise((resolve) => {
        settle = () => resolve(this)
      })
    })
    const close = vi.spyOn(MongoClient.prototype, 'close').mockResolvedValue()
    const fiber = Effect.runFork(Esix.pipe(Effect.provide(Esix.layer(options))))
    await ready
    const interrupted = Effect.runPromise(Fiber.interrupt(fiber))
    settle()
    await interrupted
    expect(close).toHaveBeenCalledTimes(1)
  })
})
