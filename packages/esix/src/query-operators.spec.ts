import mongodb from 'mongo-mock'
import { v1 as createUuid } from 'uuid'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { BaseModel } from './'
import { connectionHandler } from './connection-handler'
import QueryBuilder from './query-builder'

mongodb.max_delay = 1

class Book extends BaseModel {
  public openLibraryEnrichedVersion: number | null = null
  public title = ''
}

describe('whereNull', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${createUuid()}`
    })
  })

  afterAll(() => {
    connectionHandler.closeConnections()
  })

  it('matches documents where the field is null.', async () => {
    await Book.create({ title: 'Null Book', openLibraryEnrichedVersion: null })
    await Book.create({ title: 'Enriched Book', openLibraryEnrichedVersion: 2 })

    const books = await Book.whereNull('openLibraryEnrichedVersion').get()

    expect(books.map((book) => book.title)).toEqual(['Null Book'])
  })

  it('matches documents where the field is missing.', async () => {
    await new QueryBuilder(Book).create({ title: 'Missing Field Book' })
    await Book.create({ title: 'Enriched Book', openLibraryEnrichedVersion: 2 })

    const books = await Book.whereNull('openLibraryEnrichedVersion').get()

    expect(books.map((book) => book.title)).toEqual(['Missing Field Book'])
  })
})

describe('whereNotNull', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${createUuid()}`
    })
  })

  afterAll(() => {
    connectionHandler.closeConnections()
  })

  it('excludes documents where the field is null or missing.', async () => {
    await Book.create({ title: 'Null Book', openLibraryEnrichedVersion: null })
    await new QueryBuilder(Book).create({ title: 'Missing Field Book' })
    await Book.create({ title: 'Enriched Book', openLibraryEnrichedVersion: 2 })

    const books = await Book.whereNotNull('openLibraryEnrichedVersion').get()

    expect(books.map((book) => book.title)).toEqual(['Enriched Book'])
  })
})

describe('orWhere', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${createUuid()}`
    })
  })

  afterAll(() => {
    connectionHandler.closeConnections()
  })

  it('selects documents where the field is null or below a version.', async () => {
    await Book.create({
      title: 'Never Enriched',
      openLibraryEnrichedVersion: null
    })
    await Book.create({ title: 'Stale', openLibraryEnrichedVersion: 2 })
    await Book.create({ title: 'Current', openLibraryEnrichedVersion: 3 })

    const books = await Book.whereNull('openLibraryEnrichedVersion')
      .orWhere('openLibraryEnrichedVersion', '<', 3)
      .get()

    expect(books.map((book) => book.title).sort()).toEqual([
      'Never Enriched',
      'Stale'
    ])
  })

  it('binds AND tighter than OR.', async () => {
    await Book.create({ title: 'First Group', openLibraryEnrichedVersion: 1 })
    await Book.create({ title: 'B And C', openLibraryEnrichedVersion: 5 })
    await Book.create({ title: 'B Only', openLibraryEnrichedVersion: 5 })

    // a OR (b AND c)
    const books = await Book.where('openLibraryEnrichedVersion', 1)
      .orWhere('openLibraryEnrichedVersion', 5)
      .where('title', 'B And C')
      .get()

    expect(books.map((book) => book.title).sort()).toEqual([
      'B And C',
      'First Group'
    ])
  })

  it('behaves like where when used as the first condition.', async () => {
    await Book.create({ title: 'Solo' })
    await Book.create({ title: 'Other' })

    const books = await new QueryBuilder(Book).orWhere('title', 'Solo').get()

    expect(books.map((book) => book.title)).toEqual(['Solo'])
  })

  it('supports chaining multiple orWhere calls.', async () => {
    await Book.create({ title: 'A' })
    await Book.create({ title: 'B' })
    await Book.create({ title: 'C' })
    await Book.create({ title: 'D' })

    const books = await Book.where('title', 'A')
      .orWhere('title', 'B')
      .orWhere('title', 'C')
      .get()

    expect(books.map((book) => book.title).sort()).toEqual(['A', 'B', 'C'])
  })

  it('supports count with an orWhere chain.', async () => {
    await Book.create({
      title: 'Never Enriched',
      openLibraryEnrichedVersion: null
    })
    await Book.create({ title: 'Stale', openLibraryEnrichedVersion: 2 })
    await Book.create({ title: 'Current', openLibraryEnrichedVersion: 3 })

    const count = await Book.whereNull('openLibraryEnrichedVersion')
      .orWhere('openLibraryEnrichedVersion', '<', 3)
      .count()

    expect(count).toEqual(2)
  })

  it('supports delete with an orWhere chain.', async () => {
    await Book.create({
      title: 'Never Enriched',
      openLibraryEnrichedVersion: null
    })
    await Book.create({ title: 'Stale', openLibraryEnrichedVersion: 2 })
    await Book.create({ title: 'Current', openLibraryEnrichedVersion: 3 })

    const deletedCount = await Book.whereNull('openLibraryEnrichedVersion')
      .orWhere('openLibraryEnrichedVersion', '<', 3)
      .delete()

    expect(deletedCount).toEqual(2)

    const remainingBooks = await Book.all()

    expect(remainingBooks.map((book) => book.title)).toEqual(['Current'])
  })

  it('remaps id to _id.', async () => {
    const target = await Book.create({ title: 'Target' })
    await Book.create({ title: 'Other' })

    const books = await Book.where('title', 'No Such Title')
      .orWhere('id', target.id)
      .get()

    expect(books).toHaveLength(1)
    expect(books[0].id).toEqual(target.id)
  })

  it('strips operator objects passed as values.', async () => {
    await Book.create({ title: 'Real Book' })

    const books = await new QueryBuilder(Book)
      .orWhere('title', { $gt: '' } as any)
      .get()

    expect(books).toEqual([])
  })

  it('rejects when combined with search().', async () => {
    await Book.create({ title: 'Searchable' })

    await expect(
      new QueryBuilder(Book)
        .search('Searchable')
        .orWhere('title', 'Searchable')
        .get()
    ).rejects.toThrow('search() cannot be combined with orWhere().')
  })
})
