import { Effect, Schema, Tracer } from 'effect'
import { MongoServerError, MongoNetworkTimeoutError } from 'mongodb'
import { expect, it } from 'vitest'
import { queryEffect, EsixDuplicateKeyError } from './errors'

it('exposes duplicate-key errors as a catchTag target with a serializable schema', async () => {
  const cause = new MongoServerError({
    code: 11000,
    message: 'duplicate secret value'
  })
  Object.assign(cause, { cyclic: cause })
  const error = await Effect.runPromise(
    queryEffect('create', 'users', async () => {
      throw cause
    }).pipe(Effect.flip)
  )
  expect(error._tag).toBe('EsixDuplicateKeyError')
  expect(error.cause).toBe(cause)
  const encoded = Schema.encodeUnknownSync(EsixDuplicateKeyError)(error)
  expect(encoded).toMatchObject({
    code: 11000,
    operation: 'create',
    collection: 'users'
  })
  expect(JSON.stringify(encoded)).not.toContain('secret')
  expect(encoded).not.toHaveProperty('cause')
})

it('distinguishes driver timeouts from other failures without suggesting writes are safe to retry', async () => {
  for (const cause of [
    new MongoNetworkTimeoutError('network timeout'),
    new MongoServerError({ code: 50, message: 'maxTimeMS' })
  ]) {
    const error = await Effect.runPromise(
      queryEffect('get', 'users', async () => {
        throw cause
      }).pipe(Effect.flip)
    )
    expect(error._tag).toBe('EsixTimeoutError')
  }
})

it('annotates spans with database identity without query values', async () => {
  const spans: Tracer.Span[] = []
  await Effect.runPromise(
    Effect.tracerWith((tracer) =>
      queryEffect('count', 'users', async () => 1).pipe(
        Effect.withTracer(
          Tracer.make({
            context: (f, fiber) => tracer.context(f, fiber),
            span: (...args) => {
              const span = tracer.span(...args)
              spans.push(span)
              return span
            }
          })
        )
      )
    )
  )
  expect(Object.fromEntries(spans[0].attributes)).toMatchObject({
    'db.system': 'mongodb',
    'db.collection.name': 'users',
    'db.operation.name': 'count'
  })
})
