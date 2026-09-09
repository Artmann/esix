import { Effect, Option } from 'effect'
import { expectTypeOf, it } from 'vitest'
import { BaseModel, type QueryConnection } from 'esix'
import { EffectModel } from './model'
import type { EsixQueryError } from './errors'
class User extends BaseModel {
  age = 0
  name = ''
  tags: string[] = []
}
it('retains model field and Effect result inference', () => {
  const users = new EffectModel(User, {} as QueryConnection)
  expectTypeOf(users.pluck('age')).toEqualTypeOf<
    Effect.Effect<number[], EsixQueryError>
  >()
  expectTypeOf(users.first()).toEqualTypeOf<
    Effect.Effect<Option.Option<User>, EsixQueryError>
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
