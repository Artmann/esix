/**
 * Type-level tests for model field type safety.
 *
 * These tests verify that TypeScript correctly rejects invalid field names
 * at compile time. The @ts-expect-error comments indicate lines that SHOULD
 * produce type errors - if they don't, the test file won't compile.
 *
 * Related to: https://github.com/Artmann/esix/issues/60
 * Related to: https://github.com/Artmann/esix/issues/68
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import BaseModel from './base-model'

vi.mock('mongodb')

// Mock the MongoDB connection to avoid actual database calls
vi.mock('./connection-handler', () => ({
  connectionHandler: {
    getConnection: vi.fn().mockResolvedValue({
      collection: vi.fn().mockResolvedValue({
        find: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnThis(),
          skip: vi.fn().mockReturnThis(),
          sort: vi.fn().mockReturnThis(),
          toArray: vi.fn().mockResolvedValue([])
        }),
        count: vi.fn().mockResolvedValue(0)
      })
    })
  }
}))

/**
 * Example model for testing - matches the issue example
 */
class MenuItem extends BaseModel {
  public available = false
  public name = ''
  public order = 0
  public price = 0
}

/**
 * Another test model with different fields
 */
class User extends BaseModel {
  public email = ''
  public age = 0
  public isActive = true
}

/**
 * Test model with a union-typed field
 */
class Article extends BaseModel {
  public publishedAt: Date | null = null
}

/**
 * Test model with an array-typed field
 */
class Post extends BaseModel {
  public tags: string[] = []
}

describe('Type Safety for Model Fields', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: 'test'
    })
  })

  describe('where method', () => {
    it('accepts valid model fields with two-parameter syntax', () => {
      // These should all compile without errors
      MenuItem.where('available', true)
      MenuItem.where('name', 'Pizza')
      MenuItem.where('order', 1)
      MenuItem.where('price', 9.99)

      // BaseModel fields should also work
      MenuItem.where('id', 'some-id')
      MenuItem.where('createdAt', 123456789)
      MenuItem.where('updatedAt', 123456789)

      expect(true).toBe(true)
    })

    it('accepts valid model fields with three-parameter syntax (comparison operators)', () => {
      // These should all compile without errors
      MenuItem.where('price', '>', 10)
      MenuItem.where('price', '>=', 10)
      MenuItem.where('price', '<', 100)
      MenuItem.where('price', '<=', 100)
      MenuItem.where('price', '=', 50)
      MenuItem.where('price', '!=', 0)
      MenuItem.where('order', '<>', 5)

      expect(true).toBe(true)
    })

    it('rejects invalid field names with two-parameter syntax', () => {
      // @ts-expect-error - 'active' is not a valid field on MenuItem (should be 'available')
      MenuItem.where('active', true)

      // @ts-expect-error - 'status' is not a valid field on MenuItem
      MenuItem.where('status', 'published')

      // @ts-expect-error - 'nonExistentField' is not a valid field
      MenuItem.where('nonExistentField', 123)

      expect(true).toBe(true)
    })

    it('rejects invalid field names with three-parameter syntax', () => {
      // @ts-expect-error - 'rating' is not a valid field on MenuItem
      MenuItem.where('rating', '>', 4)

      // @ts-expect-error - 'quantity' is not a valid field
      MenuItem.where('quantity', '>=', 10)

      expect(true).toBe(true)
    })

    it('type-checks fields per model', () => {
      // User model has different fields than MenuItem
      User.where('email', 'test@example.com')
      User.where('age', 25)
      User.where('isActive', true)

      // @ts-expect-error - 'price' is a MenuItem field, not a User field
      User.where('price', 10)

      // @ts-expect-error - 'available' is a MenuItem field, not a User field
      User.where('available', true)

      expect(true).toBe(true)
    })

    it('works with chained where calls', () => {
      MenuItem.where('available', true).where('price', '>', 5)

      // @ts-expect-error - invalid field in chained call
      MenuItem.where('available', true).where('invalid', 'value')

      expect(true).toBe(true)
    })
  })

  describe('whereIn method', () => {
    it('accepts valid model fields', () => {
      MenuItem.whereIn('name', ['Pizza', 'Burger', 'Salad'])
      MenuItem.whereIn('price', [5, 10, 15])
      MenuItem.whereIn('id', ['id1', 'id2', 'id3'])

      expect(true).toBe(true)
    })

    it('rejects invalid field names', () => {
      // @ts-expect-error - 'category' is not a valid field on MenuItem
      MenuItem.whereIn('category', ['food', 'drink'])

      // @ts-expect-error - 'invalidField' is not a valid field
      MenuItem.whereIn('invalidField', [1, 2, 3])

      expect(true).toBe(true)
    })
  })

  describe('whereNotIn method', () => {
    it('accepts valid model fields', () => {
      MenuItem.whereNotIn('name', ['Expired Item'])
      MenuItem.whereNotIn('id', ['deleted-id'])

      expect(true).toBe(true)
    })

    it('rejects invalid field names', () => {
      // @ts-expect-error - 'type' is not a valid field on MenuItem
      MenuItem.whereNotIn('type', ['archived'])

      expect(true).toBe(true)
    })
  })

  describe('orderBy method', () => {
    it('accepts valid model fields', () => {
      MenuItem.orderBy('name')
      MenuItem.orderBy('price', 'desc')
      MenuItem.orderBy('order', 'asc')
      MenuItem.orderBy('createdAt', 'desc')

      expect(true).toBe(true)
    })

    it('rejects invalid field names', () => {
      // @ts-expect-error - 'ranking' is not a valid field on MenuItem
      MenuItem.orderBy('ranking')

      // @ts-expect-error - 'sortOrder' is not a valid field
      MenuItem.orderBy('sortOrder', 'desc')

      expect(true).toBe(true)
    })
  })
})

describe('Type Safety for Query Values', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: 'test'
    })
  })

  describe('where method', () => {
    it('accepts values matching the field type', () => {
      MenuItem.where('price', 9.99)
      MenuItem.where('price', '>', 10)

      expect(true).toBe(true)
    })

    it('rejects values that do not match the field type', () => {
      // @ts-expect-error - 'price' is a number field, not a string field
      MenuItem.where('price', 'ten')

      // @ts-expect-error - 'available' is a boolean field, not a string field
      MenuItem.where('available', 'yes')

      // @ts-expect-error - 'price' is a number field, not a string field
      MenuItem.where('price', '>', '10')

      expect(true).toBe(true)
    })

    it('type-checks values in chained where calls', () => {
      MenuItem.where('available', true).where('price', '>', 5)

      // @ts-expect-error - 'price' is a number field, not a string field
      MenuItem.where('available', true).where('price', 'ten')

      expect(true).toBe(true)
    })

    it('accepts every member of a union-typed field', () => {
      Article.where('publishedAt', null)
      Article.where('publishedAt', '>', new Date())

      // @ts-expect-error - 'publishedAt' is a Date | null field, not a number field
      Article.where('publishedAt', 123)

      expect(true).toBe(true)
    })

    it('still accepts raw query objects', () => {
      MenuItem.limit(1).where({ price: { $gt: 5 } })

      expect(true).toBe(true)
    })

    it('accepts the element type for array fields', () => {
      Post.where('tags', 'news')
      Post.where('tags', ['news'])

      // @ts-expect-error - 'tags' is a string array field, not a number field
      Post.where('tags', 5)

      expect(true).toBe(true)
    })
  })

  describe('whereIn method', () => {
    it('accepts values matching the field type', () => {
      MenuItem.whereIn('price', [5, 10])

      // @ts-expect-error - 'price' is a number field, not a string field
      MenuItem.whereIn('price', ['1'])

      expect(true).toBe(true)
    })

    it('accepts the element type for array fields', () => {
      Post.whereIn('tags', ['a', 'b'])

      // @ts-expect-error - 'tags' is a string array field, not a number field
      Post.whereIn('tags', [5])

      expect(true).toBe(true)
    })
  })

  describe('whereNotIn method', () => {
    it('accepts values matching the field type', () => {
      MenuItem.whereNotIn('name', ['x'])

      // @ts-expect-error - 'name' is a string field, not a number field
      MenuItem.whereNotIn('name', [1])

      expect(true).toBe(true)
    })
  })
})
