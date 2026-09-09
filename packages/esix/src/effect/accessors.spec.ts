import { Config, ConfigProvider, Effect, Option } from 'effect'
import type { Db } from 'mongodb'
import { expect, expectTypeOf, it } from 'vitest'
import { BaseModel } from 'esix'
import { Esix } from './service'
import type { EsixOperationError } from './errors'
class User extends BaseModel {
  name = ''
}

it('resolves a reusable module-level query from each provided Layer', async () => {
  const users = Esix.model(User)
  const query = users.find('one')
  expectTypeOf(query).toEqualTypeOf<
    Effect.Effect<Option.Option<User>, EsixOperationError, Esix>
  >()
  const db = (name: string) =>
    ({
      collection: () => ({
        find: () => ({
          limit: function () {
            return this
          },
          toArray: async () => [{ _id: 'one', name }]
        }),
        findOne: async () => ({ _id: 'one', name })
      })
    }) as unknown as Db
  const values = await Effect.runPromise(
    Effect.all(
      [
        query.pipe(Effect.provide(Esix.layerFromDb(db('first')))),
        query.pipe(Effect.provide(Esix.layerFromDb(db('second'))))
      ],
      { concurrency: 'unbounded' }
    )
  )
  expect(values.map((v) => Option.isSome(v) && v.value.name)).toEqual([
    'first',
    'second'
  ])
})

it('reports missing configuration as a typed ConfigError', async () => {
  const result = await Effect.runPromise(
    Esix.pipe(
      Effect.provide(Esix.layerConfig({ url: Config.redacted('MISSING_URL') })),
      Effect.withConfigProvider(ConfigProvider.fromMap(new Map())),
      Effect.flip
    )
  )
  expect(result._tag).toBe('ConfigError')
})
