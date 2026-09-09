import { describe, expect, it, vi } from 'vitest'
import type { Db } from 'mongodb'
import { BaseModel, QueryBuilder, connectionHandler } from './index'

class User extends BaseModel {
  age = 0
}
class Post extends BaseModel {
  userId = ''
}

function fixture() {
  const cursor = {
    toArray: vi.fn(async () => [{ _id: 'one', age: 30 }]),
    sort: vi.fn(),
    skip: vi.fn(),
    limit: vi.fn()
  }
  for (const method of ['sort', 'skip', 'limit'] as const)
    cursor[method].mockReturnValue(cursor)
  const collection = {
    find: vi.fn(() => cursor),
    findOne: vi.fn(async () => ({ _id: 'one', age: 30 })),
    updateOne: vi.fn(async () => ({ upsertedCount: 0, matchedCount: 1 })),
    deleteOne: vi.fn(async () => ({ deletedCount: 1 })),
    count: vi.fn(async () => 1)
  }
  const provider = {
    getConnection: vi.fn(
      async () => ({ collection: () => collection }) as unknown as Db
    )
  }
  return { provider, collection }
}

describe('model connection ownership', () => {
  it('keeps hydrated writes, relationships and copied queries on the injected connection', async () => {
    const { provider, collection } = fixture()
    const global = vi
      .spyOn(connectionHandler, 'getConnection')
      .mockRejectedValue(new Error('global connection used'))
    try {
      const query = new QueryBuilder(User, provider)
      const user = (await query.first())!
      expect(user.id).toBe('one')
      await user.save()
      await user.hasMany(Post).get()
      await query.paginate(1, 10)
      await user.delete()
      expect(collection.updateOne).toHaveBeenCalled()
      expect(collection.deleteOne).toHaveBeenCalled()
      expect(global).not.toHaveBeenCalled()
      expect(Object.keys(user)).toEqual(['createdAt', 'id', 'updatedAt', 'age'])
    } finally {
      global.mockRestore()
    }
  })
  it('refuses to rebind a model to another connection', async () => {
    const a = fixture(),
      b = fixture()
    const user = (await new QueryBuilder(User, a.provider).first())!
    expect(() => new QueryBuilder(User, b.provider).bindModel(user)).toThrow(
      'different connection'
    )
    expect(b.provider.getConnection).not.toHaveBeenCalled()
  })
})
