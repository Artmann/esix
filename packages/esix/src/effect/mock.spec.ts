import { Effect, Option } from 'effect'
import MongoMock from 'mongo-mock'
import type { Db } from 'mongodb'
import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { BaseModel } from 'esix'
import { Esix } from './service'
class User extends BaseModel {
  name = ''
  age = 0
}

it('supports in-process mongo-mock queries with an explicit borrowed adapter', async () => {
  const db = (await new MongoMock.MongoClient().connect(
    `mongodb://effect-tests/${randomUUID()}`
  )) as unknown as Db & { close(): Promise<void> }
  try {
    const users = Esix.model(User)
    await Effect.runPromise(
      Effect.gen(function* () {
        const first = yield* users.create({ name: 'Alice', age: 20 })
        yield* users.create({ name: 'Bob', age: 40 })
        expect(yield* users.average('age')).toBe(30)
        expect(yield* users.sum('age')).toBe(60)
        expect(yield* users.distinct('name')).toEqual(['Alice', 'Bob'])
        expect(Option.isSome(yield* users.find(first.id))).toBe(true)
        yield* users.remove(first)
        expect(yield* users.count()).toBe(1)
      }).pipe(Effect.provide(Esix.layerFromDb(db, { adapter: 'mock' })))
    )
    expect(await db.collection('users').countDocuments()).toBe(1)
  } finally {
    await db.close()
  }
}, 15000)
