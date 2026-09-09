import { Chunk, Effect, Fiber, Stream } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import type { BaseModel, QueryBuilder } from 'esix'
import { EffectQuery } from './query'

function fixture() {
  const returned = vi.fn()
  const batch = vi.fn()
  const cursor = vi.fn(async function* () {
    try {
      batch()
      yield { id: 'a' } as BaseModel
      yield { id: 'b' } as BaseModel
      batch()
      yield { id: 'c' } as BaseModel
    } finally {
      returned()
    }
  })
  const query = new EffectQuery(
    () => ({ cursor }) as unknown as QueryBuilder<BaseModel>,
    'items'
  )
  return { query, returned, batch, cursor }
}

describe('Effect streams', () => {
  it('creates a fresh lazy iterator per run', async () => {
    const { query, cursor } = fixture()
    const stream = query.stream(2)
    expect(cursor).not.toHaveBeenCalled()
    for (let i = 0; i < 2; i++) {
      const rows = await Effect.runPromise(Stream.runCollect(stream))
      expect(Chunk.toReadonlyArray(rows).map((row) => row.id)).toEqual([
        'a',
        'b',
        'c'
      ])
    }
    expect(cursor).toHaveBeenCalledTimes(2)
  })
  it('returns the iterator and stops new batches on early completion', async () => {
    const { query, returned, batch } = fixture()
    const rows = await Effect.runPromise(
      query.stream(2).pipe(Stream.take(1), Stream.runCollect)
    )
    expect(Chunk.size(rows)).toBe(1)
    expect(batch).toHaveBeenCalledTimes(1)
    expect(returned).toHaveBeenCalledTimes(1)
  })
  it('maps iterator construction and batch failures to query errors', async () => {
    const cause = new Error('invalid batch')
    const query = new EffectQuery(
      () =>
        ({
          cursor: () => {
            throw cause
          }
        }) as unknown as QueryBuilder<BaseModel>,
      'items'
    )
    const error = await Effect.runPromise(
      query.stream(0).pipe(Stream.runCollect, Effect.flip)
    )
    expect(error).toMatchObject({ _tag: 'EsixQueryError', cause })
  })
  it('maps a rejected batch to the query error channel', async () => {
    const cause = new Error('batch failed')
    const cursor = async function* () {
      yield {} as BaseModel
      throw cause
    }
    const query = new EffectQuery(
      () => ({ cursor }) as unknown as QueryBuilder<BaseModel>,
      'items'
    )
    const error = await Effect.runPromise(
      query.stream().pipe(Stream.runDrain, Effect.flip)
    )
    expect(error).toMatchObject({
      _tag: 'EsixQueryError',
      operation: 'stream',
      cause
    })
  })
  it('finalizes a pending iterator after interruption without starting another batch', async () => {
    let settle!: () => void, started!: () => void
    const ready = new Promise<void>((r) => {
      started = r
    })
    const nextBatch = vi.fn(),
      returned = vi.fn()
    const cursor = async function* () {
      try {
        started()
        await new Promise<void>((r) => {
          settle = r
        })
        yield {} as BaseModel
        nextBatch()
      } finally {
        returned()
      }
    }
    const query = new EffectQuery(
      () => ({ cursor }) as unknown as QueryBuilder<BaseModel>,
      'items'
    )
    const fiber = Effect.runFork(Stream.runDrain(query.stream()))
    await ready
    const interrupted = Effect.runPromise(Fiber.interrupt(fiber))
    settle()
    await interrupted
    expect(returned).toHaveBeenCalledTimes(1)
    expect(nextBatch).not.toHaveBeenCalled()
  })
})
