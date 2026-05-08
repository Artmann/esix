import mongodb from 'mongo-mock'
import { v1 as createUuid } from 'uuid'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { BaseModel } from './'
import { connectionHandler } from './connection-handler'

mongodb.max_delay = 1

class Author extends BaseModel {
  public name = ''
}

class Post extends BaseModel {
  public title = ''
  public authorId?: string
  public published = false
  public views = 0
  public tag = ''
}

describe('paginate', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${createUuid()}`
    })
  })

  afterAll(() => {
    connectionHandler.closeConnections()
  })

  it('returns the first page with metadata.', async () => {
    for (let i = 0; i < 25; i++) {
      await Post.create({ title: `Post ${i}`, published: true })
    }

    const result = await Post.paginate(1, 10)

    expect(result.data).toHaveLength(10)
    expect(result.total).toEqual(25)
    expect(result.page).toEqual(1)
    expect(result.perPage).toEqual(10)
    expect(result.lastPage).toEqual(3)
  })

  it('returns the middle page.', async () => {
    for (let i = 0; i < 25; i++) {
      await Post.create({ title: `Post ${i}`, published: true })
    }

    const result = await Post.paginate(2, 10)

    expect(result.data).toHaveLength(10)
    expect(result.page).toEqual(2)
  })

  it('returns the last page (potentially partial).', async () => {
    for (let i = 0; i < 25; i++) {
      await Post.create({ title: `Post ${i}`, published: true })
    }

    const result = await Post.paginate(3, 10)

    expect(result.data).toHaveLength(5)
    expect(result.page).toEqual(3)
    expect(result.lastPage).toEqual(3)
  })

  it('returns an empty page when beyond range.', async () => {
    for (let i = 0; i < 5; i++) {
      await Post.create({ title: `Post ${i}` })
    }

    const result = await Post.paginate(10, 10)

    expect(result.data).toEqual([])
    expect(result.total).toEqual(5)
    expect(result.lastPage).toEqual(1)
  })

  it('returns lastPage=1 when total is 0.', async () => {
    const result = await Post.paginate(1, 10)

    expect(result.total).toEqual(0)
    expect(result.lastPage).toEqual(1)
    expect(result.data).toEqual([])
  })

  it('throws on invalid page.', async () => {
    await expect(Post.paginate(0, 10)).rejects.toThrow(/page/)
    await expect(Post.paginate(-1, 10)).rejects.toThrow(/page/)
  })

  it('throws on invalid perPage.', async () => {
    await expect(Post.paginate(1, 0)).rejects.toThrow(/perPage/)
  })
})

describe('increment / decrement', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${createUuid()}`
    })
  })

  afterAll(() => {
    connectionHandler.closeConnections()
  })

  it('increments the value of a field for matching documents.', async () => {
    const post = await Post.create({ title: 'incA', views: 5 })

    await Post.where('title', 'incA').increment('views')

    const reloaded = await Post.find(post.id)
    expect(reloaded?.views).toEqual(6)
  })

  it('increments by a specific amount.', async () => {
    const post = await Post.create({ title: 'incB', views: 5 })

    await Post.where('title', 'incB').increment('views', 10)

    const reloaded = await Post.find(post.id)
    expect(reloaded?.views).toEqual(15)
  })

  it('decrements the value of a field.', async () => {
    const post = await Post.create({ title: 'decA', views: 5 })

    await Post.where('title', 'decA').decrement('views', 2)

    const reloaded = await Post.find(post.id)
    expect(reloaded?.views).toEqual(3)
  })

  it('respects current where() constraints.', async () => {
    const a = await Post.create({ title: 'A', views: 5, published: true })
    const b = await Post.create({ title: 'B', views: 5, published: false })

    await Post.where('published', true).increment('views')

    const updatedA = await Post.find(a.id)
    const updatedB = await Post.find(b.id)

    expect(updatedA?.views).toEqual(6)
    expect(updatedB?.views).toEqual(5)
  })
})

describe('belongsTo', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${createUuid()}`
    })
  })

  afterAll(() => {
    connectionHandler.closeConnections()
  })

  it('returns the parent record.', async () => {
    const author = await Author.create({ name: 'John' })
    const post = await Post.create({ title: 'Hello', authorId: author.id })

    const parent = await post.belongsTo(Author)

    expect(parent?.id).toEqual(author.id)
    expect(parent?.name).toEqual('John')
  })

  it('returns null when foreign key is missing.', async () => {
    const post = await Post.create({ title: 'Hello' })

    const parent = await post.belongsTo(Author)

    expect(parent).toBeNull()
  })
})

describe('hasOne', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${createUuid()}`
    })
  })

  afterAll(() => {
    connectionHandler.closeConnections()
  })

  it('returns the first related record.', async () => {
    const author = await Author.create({ name: 'John' })
    await Post.create({ title: 'First', authorId: author.id })
    await Post.create({ title: 'Second', authorId: author.id })

    const post = await author.hasOne(Post)

    expect(post).not.toBeNull()
    expect(post?.authorId).toEqual(author.id)
  })

  it('returns null when no related records exist.', async () => {
    const author = await Author.create({ name: 'Lonely' })

    const post = await author.hasOne(Post)

    expect(post).toBeNull()
  })
})

describe('distinct', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${createUuid()}`
    })
  })

  afterAll(() => {
    connectionHandler.closeConnections()
  })

  it('returns deduplicated values for a field.', async () => {
    await Post.create({ title: 'A', tag: 'mongo', published: true })
    await Post.create({ title: 'B', tag: 'mongo', published: true })
    await Post.create({ title: 'C', tag: 'typescript', published: true })
    await Post.create({ title: 'D', tag: 'typescript', published: false })

    const tags = await Post.distinct('tag')

    expect(tags.sort()).toEqual(['mongo', 'typescript'])
  })

  it('respects active where constraints.', async () => {
    await Post.create({ title: 'A', tag: 'mongo', published: true })
    await Post.create({ title: 'B', tag: 'typescript', published: true })
    await Post.create({ title: 'C', tag: 'draft-only', published: false })

    const publishedTags = await Post.where('published', true).distinct('tag')

    expect(publishedTags.sort()).toEqual(['mongo', 'typescript'])
  })

  it('returns an empty array when no documents match.', async () => {
    const tags = await Post.where('published', true).distinct('tag')

    expect(tags).toEqual([])
  })
})

describe('where("id", ...)', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${createUuid()}`
    })
  })

  afterAll(() => {
    connectionHandler.closeConnections()
  })

  it('finds the document via where("id", ...).first().', async () => {
    const created = await Post.create({ title: 'Findable' })

    const found = await Post.where('id', created.id).first()

    expect(found).not.toBeNull()
    expect(found?.id).toEqual(created.id)
  })

  it('updates the matching document via where("id", ...).increment().', async () => {
    const post = await Post.create({ title: 'Counter', views: 0 })

    const modified = await Post.where('id', post.id).increment('views', 3)

    expect(modified).toEqual(1)

    const reloaded = await Post.find(post.id)
    expect(reloaded?.views).toEqual(3)
  })
})
