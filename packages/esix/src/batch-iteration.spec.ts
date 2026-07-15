import mongodb from 'mongo-mock'
import { v1 as createUuid } from 'uuid'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { BaseModel } from './'
import { connectionHandler } from './connection-handler'

mongodb.max_delay = 1

class Post extends BaseModel {
  public title = ''
  public published = false
  public views = 0
}

describe('chunk', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${createUuid()}`
    })
  })

  afterAll(() => {
    connectionHandler.closeConnections()
  })

  it('processes all documents in batches with page numbers.', async () => {
    const createdIds: string[] = []

    for (let i = 0; i < 25; i++) {
      const post = await Post.create({ title: `Post ${i}` })

      createdIds.push(post.id)
    }

    const batchSizes: number[] = []
    const pages: number[] = []
    const seenIds: string[] = []

    const result = await Post.chunk(10, (posts, page) => {
      batchSizes.push(posts.length)
      pages.push(page)

      for (const post of posts) {
        seenIds.push(post.id)
      }
    })

    expect(result).toEqual(true)
    expect(batchSizes).toEqual([10, 10, 5])
    expect(pages).toEqual([1, 2, 3])
    expect(seenIds.sort()).toEqual(createdIds.sort())
    expect(new Set(seenIds).size).toEqual(25)
  })

  it('does not invoke an empty extra callback when the count is a multiple of the size.', async () => {
    for (let i = 0; i < 20; i++) {
      await Post.create({ title: `Post ${i}` })
    }

    const batchSizes: number[] = []
    const pages: number[] = []

    const result = await Post.chunk(10, (posts, page) => {
      batchSizes.push(posts.length)
      pages.push(page)
    })

    expect(result).toEqual(true)
    expect(batchSizes).toEqual([10, 10])
    expect(pages).toEqual([1, 2])
  })

  it('processes a single partial batch when the size exceeds the total.', async () => {
    for (let i = 0; i < 5; i++) {
      await Post.create({ title: `Post ${i}` })
    }

    const batchSizes: number[] = []

    await Post.chunk(10, (posts) => {
      batchSizes.push(posts.length)
    })

    expect(batchSizes).toEqual([5])
  })

  it('preserves an existing id condition from whereIn.', async () => {
    const createdIds: string[] = []

    for (let i = 0; i < 8; i++) {
      const post = await Post.create({ title: `Post ${i}` })

      createdIds.push(post.id)
    }

    const subset = createdIds.slice(0, 5)
    const seenIds: string[] = []

    await Post.whereIn('id', subset).chunk(2, (posts) => {
      for (const post of posts) {
        seenIds.push(post.id)
      }
    })

    expect(seenIds.sort()).toEqual([...subset].sort())
    expect(new Set(seenIds).size).toEqual(5)
  })

  it('only processes documents matching the current query.', async () => {
    for (let i = 0; i < 6; i++) {
      await Post.create({ title: `Post ${i}`, published: i % 2 === 0 })
    }

    const seenTitles: string[] = []

    await Post.where('published', true).chunk(2, (posts) => {
      for (const post of posts) {
        seenTitles.push(post.title)
      }
    })

    expect(seenTitles.sort()).toEqual(['Post 0', 'Post 2', 'Post 4'])
  })

  it('processes the union of conditions exactly once each with orWhere.', async () => {
    const expectedIds: string[] = []

    for (let i = 0; i < 5; i++) {
      const post = await Post.create({
        title: `Published ${i}`,
        published: true,
        views: 0
      })

      expectedIds.push(post.id)
    }

    for (let i = 0; i < 5; i++) {
      const post = await Post.create({
        title: `Popular ${i}`,
        published: false,
        views: 200
      })

      expectedIds.push(post.id)
    }

    for (let i = 0; i < 5; i++) {
      await Post.create({ title: `Ignored ${i}`, published: false, views: 1 })
    }

    const seenIds: string[] = []

    await Post.where('published', true)
      .orWhere('views', '>', 100)
      .chunk(3, (posts) => {
        for (const post of posts) {
          seenIds.push(post.id)
        }
      })

    expect(seenIds.sort()).toEqual([...expectedIds].sort())
    expect(new Set(seenIds).size).toEqual(10)
  })

  it('stops early when the callback returns false.', async () => {
    for (let i = 0; i < 25; i++) {
      await Post.create({ title: `Post ${i}` })
    }

    let invocations = 0

    const result = await Post.chunk(10, () => {
      invocations += 1

      return false
    })

    expect(result).toEqual(false)
    expect(invocations).toEqual(1)
  })

  it('processes every document when the callback mutates the query fields.', async () => {
    for (let i = 0; i < 20; i++) {
      await Post.create({ title: `Post ${i}`, published: false })
    }

    await Post.where('published', false).chunk(5, async (posts) => {
      for (const post of posts) {
        post.published = true

        await post.save()
      }
    })

    const publishedCount = await Post.where('published', true).count()
    const unpublishedCount = await Post.where('published', false).count()

    expect(publishedCount).toEqual(20)
    expect(unpublishedCount).toEqual(0)
  })

  it('processes every document exactly once when batches are deleted.', async () => {
    for (let i = 0; i < 12; i++) {
      await Post.create({ title: `Post ${i}` })
    }

    const seenIds: string[] = []

    await Post.chunk(4, async (posts) => {
      for (const post of posts) {
        seenIds.push(post.id)

        await post.delete()
      }
    })

    expect(new Set(seenIds).size).toEqual(12)
    expect(await Post.count()).toEqual(0)
  })

  it('never invokes the callback when no documents match.', async () => {
    await Post.create({ title: 'Draft', published: false })

    let invocations = 0

    const result = await Post.where('published', true).chunk(10, () => {
      invocations += 1
    })

    expect(result).toEqual(true)
    expect(invocations).toEqual(0)
  })

  it('throws on an invalid size.', async () => {
    await expect(Post.chunk(0, () => {})).rejects.toThrow(/size/)
    await expect(Post.chunk(-1, () => {})).rejects.toThrow(/size/)
    await expect(Post.chunk(1.5, () => {})).rejects.toThrow(/size/)
  })

  it('processes every document exactly once even when orderBy is set.', async () => {
    const createdIds: string[] = []

    for (let i = 0; i < 15; i++) {
      const post = await Post.create({ title: `Post ${i}` })

      createdIds.push(post.id)
    }

    const seenIds: string[] = []

    await Post.orderBy('title', 'desc').chunk(4, (posts) => {
      for (const post of posts) {
        seenIds.push(post.id)
      }
    })

    expect(seenIds.sort()).toEqual(createdIds.sort())
    expect(new Set(seenIds).size).toEqual(15)
  })
})

describe('cursor', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${createUuid()}`
    })
  })

  afterAll(() => {
    connectionHandler.closeConnections()
  })

  it('yields every model in ascending id order across batch boundaries.', async () => {
    const createdIds: string[] = []

    for (let i = 0; i < 10; i++) {
      const post = await Post.create({ title: `Post ${i}` })

      createdIds.push(post.id)
    }

    const seenIds: string[] = []

    for await (const post of Post.cursor(3)) {
      seenIds.push(post.id)
    }

    expect(seenIds).toEqual([...createdIds].sort())
    expect(new Set(seenIds).size).toEqual(10)
  })

  it('respects where constraints.', async () => {
    for (let i = 0; i < 6; i++) {
      await Post.create({ title: `Post ${i}`, published: i % 2 === 0 })
    }

    const seenTitles: string[] = []

    for await (const post of Post.where('published', true).cursor(2)) {
      seenTitles.push(post.title)
    }

    expect(seenTitles.sort()).toEqual(['Post 0', 'Post 2', 'Post 4'])
  })

  it('yields the union of conditions exactly once each with orWhere.', async () => {
    const expectedIds: string[] = []

    for (let i = 0; i < 4; i++) {
      const post = await Post.create({
        title: `Published ${i}`,
        published: true,
        views: 0
      })

      expectedIds.push(post.id)
    }

    for (let i = 0; i < 4; i++) {
      const post = await Post.create({
        title: `Popular ${i}`,
        published: false,
        views: 200
      })

      expectedIds.push(post.id)
    }

    for (let i = 0; i < 4; i++) {
      await Post.create({ title: `Ignored ${i}`, published: false, views: 1 })
    }

    const seenIds: string[] = []

    for await (const post of Post.where('published', true)
      .orWhere('views', '>', 100)
      .cursor(3)) {
      seenIds.push(post.id)
    }

    expect(seenIds.sort()).toEqual([...expectedIds].sort())
    expect(new Set(seenIds).size).toEqual(8)
  })

  it('supports iterating the query builder directly.', async () => {
    for (let i = 0; i < 4; i++) {
      await Post.create({ title: `Post ${i}`, published: true })
    }

    await Post.create({ title: 'Draft', published: false })

    const seenTitles: string[] = []

    for await (const post of Post.where('published', true)) {
      seenTitles.push(post.title)
    }

    expect(seenTitles.sort()).toEqual(['Post 0', 'Post 1', 'Post 2', 'Post 3'])
  })

  it('exits cleanly when breaking out of the loop.', async () => {
    for (let i = 0; i < 10; i++) {
      await Post.create({ title: `Post ${i}` })
    }

    let seen = 0

    for await (const post of Post.cursor(3)) {
      expect(post.id).not.toEqual('')

      seen += 1

      if (seen === 4) {
        break
      }
    }

    expect(seen).toEqual(4)
    expect(await Post.count()).toEqual(10)
  })

  it('throws on an invalid batch size.', async () => {
    expect(() => Post.cursor(0)).toThrow(/batchSize/)
    expect(() => Post.cursor(-1)).toThrow(/batchSize/)
    expect(() => Post.cursor(1.5)).toThrow(/batchSize/)
  })
})
