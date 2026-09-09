import { Effect, Either, Option } from 'effect'
import { BSON, ObjectId, type Db } from 'mongodb'
import { describe, expect, it, vi } from 'vitest'
import { BaseModel, QueryBuilder } from '../index'
import { EffectQuery } from './query'

class User extends BaseModel {
  age = 0
  name = ''
  tags: string[] = []
}
function fixture() {
  const find = vi.fn((_query: unknown) => ({
    toArray: async () => [{ _id: 'one', age: 30 }]
  }))
  const db = { collection: () => ({ find }) } as unknown as Db
  const query = new EffectQuery(
    () => new QueryBuilder(User, { getConnection: async () => db }),
    'users'
  )
  return { query, find }
}

describe('Effect queries', () => {
  it('is lazy and rebuilds independently on repeated and concurrent runs', async () => {
    const { query, find } = fixture()
    const young = query.where('age', '<', 20).get()
    const old = query.where('age', '>=', 20).get()
    expect(find).not.toHaveBeenCalled()
    await Effect.runPromise(
      Effect.all([young, old, young], { concurrency: 'unbounded' })
    )
    expect(find.mock.calls.map((call) => call[0])).toEqual([
      { age: { $lt: 20 } },
      { age: { $gte: 20 } },
      { age: { $lt: 20 } }
    ])
    await Effect.runPromise(query.get())
    expect(find).toHaveBeenLastCalledWith({})
  })
  it('snapshots mutable query values without losing BSON types', async () => {
    const { query, find } = fixture()
    const id = new ObjectId(),
      date = new Date(1000),
      regex = /abc/i
    const input = {
      id,
      date,
      regex,
      score: BSON.Long.fromNumber(12),
      tags: ['one']
    }
    const effect = query.where(input).get()
    date.setTime(2000)
    input.tags.push('two')
    await Effect.runPromise(effect)
    expect(find).toHaveBeenCalledWith({
      _id: id,
      date: new Date(1000),
      regex,
      score: BSON.Long.fromNumber(12),
      tags: ['one']
    })
  })
  it('captures synchronous query construction failures in the typed channel', async () => {
    const { query } = fixture()
    const effect = query.search('text').orWhere('age', 30).get()
    const result = await Effect.runPromise(Effect.either(effect))
    expect(Either.isLeft(result) && result.left._tag).toBe('EsixQueryError')
  })
  it('converts missing lookup results to Option.none and retains error causes', async () => {
    const failure = new Error('driver failure')
    const core = {
      first: async () => null,
      get: async () => {
        throw failure
      }
    } as unknown as QueryBuilder<User>
    const query = new EffectQuery(() => core, 'users')
    expect(await Effect.runPromise(query.first())).toEqual(Option.none())
    const error = await Effect.runPromise(
      query
        .get()
        .pipe(Effect.catchTag('EsixQueryError', (e) => Effect.succeed(e)))
    )
    expect(error).toMatchObject({
      _tag: 'EsixQueryError',
      operation: 'get',
      collection: 'users',
      cause: failure
    })
  })
})
