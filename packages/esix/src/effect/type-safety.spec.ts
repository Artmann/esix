import { Effect, Option, Stream } from 'effect'
import { expectTypeOf, it } from 'vitest'
import { BaseModel, type QueryConnection } from 'esix'
import { Esix } from './service'
import { EffectModel } from './model'
import type { EsixOperationError } from './errors'
class User extends BaseModel {
  age = 0
  name = ''
  tags: string[] = []
}
it('retains model field and Effect result inference', () => {
  const users = new EffectModel(User, {} as QueryConnection)
  expectTypeOf(users.pluck('age')).toEqualTypeOf<
    Effect.Effect<number[], EsixOperationError>
  >()
  expectTypeOf(users.first()).toEqualTypeOf<
    Effect.Effect<Option.Option<User>, EsixOperationError>
  >()
  users.where('tags', 'tag')
  // @ts-expect-error unknown field
  users.where('missing', 1)
  // @ts-expect-error comparison value must match field
  users.where('age', '>=', 'old')
  // @ts-expect-error atomic increments require numeric fields
  users.increment('name')
  // @ts-expect-error create attributes are model typed
  users.create({ age: 'old' })
})

it('threads Esix through derived queries, writes, relationships and Streams', () => {
  const users = Esix.model(User)
  expectTypeOf(users.where('age', '>=', 18).get()).toEqualTypeOf<
    Effect.Effect<User[], EsixOperationError, Esix>
  >()
  expectTypeOf(users.stream()).toEqualTypeOf<
    Stream.Stream<User, EsixOperationError, Esix>
  >()
  expectTypeOf(users.update(new User(), { age: 20 })).toEqualTypeOf<
    Effect.Effect<void, EsixOperationError, Esix>
  >()
  expectTypeOf(users.hasMany(new User(), User).get()).toEqualTypeOf<
    Effect.Effect<User[], EsixOperationError, Esix>
  >()
})
