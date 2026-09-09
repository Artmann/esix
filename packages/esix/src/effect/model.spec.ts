import { Effect, Option } from 'effect'
import { MongoClient } from 'mongodb'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BaseModel } from 'esix'
import { EffectModel } from './model'

class User extends BaseModel {
  name = ''
  age = 0
}
class Post extends BaseModel {
  userId = ''
  title = ''
}
const uri = process.env.ESIX_TEST_MONGODB_URI

describe.skipIf(!uri)('Effect model database contracts', () => {
  const name = `esix_effect_${randomUUID().replaceAll('-', '')}`
  const client = new MongoClient(uri || 'mongodb://127.0.0.1:27028')
  const provider = {
    getConnection: async () => client.db(name),
    adapter: 'default' as const
  }
  const users = new EffectModel(User, provider)
  const posts = new EffectModel(Post, provider)
  beforeAll(() => client.connect())
  afterAll(async () => {
    await client.db(name).dropDatabase()
    await client.close()
  })
  it('defers writes, preserves defaults, looks up and deletes models', async () => {
    const fresh = new User()
    const update = users.update(fresh, { age: 42 })
    expect(fresh.age).toBe(0)
    await Effect.runPromise(update)
    expect(fresh.wasRecentlyCreated).toBe(true)
    const found = await Effect.runPromise(users.find(fresh.id))
    expect(Option.isSome(found) && found.value.age).toBe(42)
    const created = await Effect.runPromise(users.create({ name: 'Alice' }))
    expect(created).toBeInstanceOf(User)
    expect(created.age).toBe(0)
    expect(created.wasRecentlyCreated).toBe(true)
    expect(await Effect.runPromise(users.deleteModel(created))).toBe(1)
    expect(await Effect.runPromise(users.find(created.id))).toEqual(
      Option.none()
    )
  })
  it('preserves firstOrCreate defaults and relationship connection ownership', async () => {
    const alice = await Effect.runPromise(
      users.firstOrCreate({ name: 'Related' })
    )
    const again = await Effect.runPromise(
      users.firstOrCreate({ name: 'Related' })
    )
    expect(again.id).toBe(alice.id)
    expect(again.wasRecentlyCreated).toBe(false)
    const post = await Effect.runPromise(
      posts.create({ userId: alice.id, title: 'hello' })
    )
    const related = await Effect.runPromise(users.hasMany(alice, Post).get())
    expect(related.map((p) => p.id)).toEqual([post.id])
    expect(
      Option.isSome(await Effect.runPromise(users.hasOne(alice, Post)))
    ).toBe(true)
    const author = await Effect.runPromise(posts.belongsTo(post, User))
    expect(Option.isSome(author) && author.value.id).toBe(alice.id)
    related[0].title = 'updated'
    await related[0].save()
    expect(
      (await client.db(name).collection('posts').findOne({ title: 'updated' }))
        ?.userId
    ).toBe(alice.id)
  })
  it('rejects cross-connection updates before mutating the model', async () => {
    const alice = await Effect.runPromise(users.create({ name: 'Isolated' }))
    const other = new EffectModel(User, {
      getConnection: async () => client.db(`${name}_other`)
    })
    const result = await Effect.runPromise(
      other.update(alice, { name: 'Wrong' }).pipe(Effect.flip)
    )
    expect(result._tag).toBe('EsixQueryError')
    expect(alice.name).toBe('Isolated')
  })
})
