import mongodb from 'mongo-mock'
import { MongoClient, ObjectId } from 'mongodb'
import { v1 as createUuid } from 'uuid'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BaseModel } from './'
import { connectionHandler } from './connection-handler'

mongodb.max_delay = 1

class Author extends BaseModel {
  public name = ''

  blogPosts() {
    return this.hasMany(BlogPost)
  }
}

class BlogPost extends BaseModel {
  public title = ''

  public authorId?: string
}

class Flight extends BaseModel {
  public name = ''
  public delayed = 0
  public arrival_time = ''
}

class Product extends BaseModel {
  public name = ''
  public price = 0

  public categoryId?: number
}

describe('Integration', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${createUuid()}`
    })
  })

  afterAll(() => {
    connectionHandler.closeConnections()
  })

  it('finds a model by id', async () => {
    const author = await Author.create({
      name: 'John Smith'
    })

    await BlogPost.create({
      authorId: author.id,
      title: 'How to store things in MongoDB.'
    })
    const { id, createdAt } = await BlogPost.create({
      authorId: author.id,
      title: '21 tips to improve your MongoDB setup.'
    })

    const post = await BlogPost.find(id)

    expect(post).toEqual({
      authorId: author.id,
      createdAt,
      id,
      title: '21 tips to improve your MongoDB setup.',
      updatedAt: null
    })
  })

  it('finds a model with an id created in Mongo', async () => {
    const MockClient = mongodb.MongoClient as unknown as typeof MongoClient
    const connection = await MockClient.connect(
      process.env['DB_URL'] || 'mongodb://127.0.0.1:27017/'
    )
    const db = await connection.db(process.env['DB_DATABASE'])
    const collection = await db.collection('blog-posts')

    const { insertedId } = await collection.insertOne({
      title: 'Why ObjectIds makes your code fail.'
    })

    const id = insertedId.toHexString()

    const post = await BlogPost.find(id)

    expect(post).toEqual({
      createdAt: 0,
      id,
      title: 'Why ObjectIds makes your code fail.',
      updatedAt: null
    })
  })

  it('finds a model with a user created id', async () => {
    const MockClient = mongodb.MongoClient as unknown as typeof MongoClient
    const connection = await MockClient.connect(
      process.env['DB_URL'] || 'mongodb://127.0.0.1:27017/'
    )
    const db = connection.db(process.env['DB_DATABASE'])
    const collection = db.collection('blog-posts')

    const objectId = new ObjectId()

    await collection.insertOne({
      _id: objectId,
      title: 'Why Custom IDs makes your code fail.'
    })

    const post = await BlogPost.find(objectId.toHexString())

    expect(post).toEqual({
      createdAt: 0,
      id: objectId.toHexString(),
      title: 'Why Custom IDs makes your code fail.',
      updatedAt: null
    })
  })

  it('finds the first blog post', async () => {
    const author = await Author.create({
      name: 'John Smith'
    })
    const { id, createdAt } = await BlogPost.create({
      authorId: author.id,
      title: 'How to store things in MongoDB.'
    })

    await BlogPost.create({
      authorId: author.id,
      title: '21 tips to improve your MongoDB setup.'
    })

    const post = await BlogPost.where('authorId', author.id).first()

    expect(post).toEqual({
      authorId: author.id,
      createdAt,
      id,
      title: 'How to store things in MongoDB.',
      updatedAt: null
    })
  })

  it('updates existing model', async () => {
    const dateSpy = vi.spyOn(Date, 'now')
    dateSpy.mockReturnValue(new Date('2023-01-01T10:00:00Z').getTime())
    
    const author = await Author.create({
      name: 'John Smith'
    })

    dateSpy.mockReturnValue(new Date('2023-01-01T10:30:00Z').getTime())

    const existingAuthor = await Author.find(author.id)

    expect(existingAuthor).not.toBeNull()

    if (!existingAuthor) {
      return
    }

    existingAuthor.name = 'John Oliver'

    await existingAuthor.save()

    const author2 = await Author.find(author.id)

    expect(existingAuthor).toEqual({
      createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
      id: author.id,
      name: 'John Oliver',
      updatedAt: new Date('2023-01-01T10:30:00Z').getTime()
    })

    expect(author2).toEqual({
      createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
      id: author.id,
      name: 'John Oliver',
      updatedAt: new Date('2023-01-01T10:30:00Z').getTime()
    })
  })

  it('persists a new model', async () => {
    const dateSpy = vi.spyOn(Date, 'now')
    dateSpy.mockReturnValue(new Date('2023-01-01T10:00:00Z').getTime())
    
    const author = new Author()

    author.name = 'Molly Markel'

    await author.save()

    expect(author).toEqual({
      createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
      id: expect.any(String),
      name: 'Molly Markel',
      updatedAt: null
    })
  })

  it('finds models by ids', async () => {
    const dateSpy = vi.spyOn(Date, 'now')
    dateSpy.mockReturnValue(new Date('2023-01-01T10:00:00Z').getTime())
    
    const author1 = await Author.create({ name: 'Ayra York' })
    await Author.create({ name: 'Cain Young' })
    const author3 = await Author.create({ name: 'Antonio Dennis' })

    const authors = await Author.whereIn('id', [author1.id, author3.id]).get()

    expect(authors).toEqual([
      {
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        id: author1.id,
        name: author1.name,
        updatedAt: null
      },
      {
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        id: author3.id,
        name: author3.name,
        updatedAt: null
      }
    ])
  })

  it('returns nothing when an empty array is passed to whereIn', async () => {
    await Author.create({ name: 'Ayra York' })
    await Author.create({ name: 'Cain Young' })
    await Author.create({ name: 'Antonio Dennis' })

    const authors = await Author.whereIn('id', []).get()

    expect(authors).toEqual([])
  })

  it('finds models with ids not in the given array', async () => {
    const dateSpy = vi.spyOn(Date, 'now')
    dateSpy.mockReturnValue(new Date('2023-01-01T10:00:00Z').getTime())
    
    const author1 = await Author.create({ name: 'Ayra York' })
    const author2 = await Author.create({ name: 'Cain Young' })
    const author3 = await Author.create({ name: 'Antonio Dennis' })

    const authors = await Author.whereNotIn('id', [author1.id, author3.id]).get()

    expect(authors).toEqual([
      {
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        id: author2.id,
        name: author2.name,
        updatedAt: null
      }
    ])
  })

  it('returns all models when an empty array is passed to whereNotIn', async () => {
    const author1 = await Author.create({ name: 'Ayra York' })
    const author2 = await Author.create({ name: 'Cain Young' })
    const author3 = await Author.create({ name: 'Antonio Dennis' })

    const authors = await Author.whereNotIn('id', []).get()

    expect(authors).toHaveLength(3)
    expect(authors.map(author => author.name).sort()).toEqual([
      'Antonio Dennis',
      'Ayra York',
      'Cain Young'
    ])
  })

  it('finds models with a key other than id not in the given array', async () => {
    await Product.create({ name: 'Widget A', price: 10, categoryId: 1 })
    await Product.create({ name: 'Widget B', price: 20, categoryId: 2 })
    await Product.create({ name: 'Widget C', price: 30, categoryId: 3 })
    await Product.create({ name: 'Widget D', price: 40, categoryId: 4 })
    await Product.create({ name: 'Widget E', price: 50, categoryId: 5 })

    const products = await Product.whereNotIn('categoryId', [1, 3, 5]).get()

    expect(products).toHaveLength(2)
    expect(products.map(product => product.name).sort()).toEqual([
      'Widget B',
      'Widget D'
    ])
    expect(products.map(product => product.categoryId).sort()).toEqual([2, 4])
  })

  it('creates a model with a custom id', async () => {
    const dateSpy = vi.spyOn(Date, 'now')
    dateSpy.mockReturnValue(new Date('2023-01-01T10:00:00Z').getTime())
    
    await Author.create({
      id: 'author-1',
      name: 'Antonio Dennis'
    })

    const author = await Author.find('author-1')

    expect(author).toEqual({
      createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
      id: 'author-1',
      name: 'Antonio Dennis',
      updatedAt: null
    })
  })

  it('plucks an attribute.', async () => {
    await Product.create({ name: 'Widget 1', price: 79.99, categoryId: 1 })
    await Product.create({ name: 'Widget 2', price: 44.99, categoryId: 1 })
    await Product.create({ name: 'Widget 3', price: 129.99, categoryId: 1 })
    await Product.create({ name: 'Widget 4', price: 19.99, categoryId: 1 })
    await Product.create({ name: 'Chair 1', price: 79.99, categoryId: 2 })
    await Product.create({ name: 'Chair 2', price: 49.99, categoryId: 2 })

    const names = await Product.pluck('name')
    const prices = await Product.orderBy('price').pluck('price')

    expect(names).toEqual([
      'Widget 1',
      'Widget 2',
      'Widget 3',
      'Widget 4',
      'Chair 1',
      'Chair 2'
    ])

    expect(prices).toEqual([
      19.99,
      44.99,
      49.99,
      79.99,
      79.99,
      129.99,
    ])
  })
})

describe('Pagination', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${createUuid()}`
    })
  })

  afterAll(() => {
    connectionHandler.closeConnections()
  })

  it('returns the first page of results.', async () => {
    for (let i = 0; i < 30; i++) {
      await Product.create({ name: `Widget ${i + 1}`, price: 10, categoryId: 1 })
    }

    const products = await Product.limit(10).get()

    expect(products).toEqual([
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 1', price: 10, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 2', price: 10, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 3', price: 10, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 4', price: 10, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 5', price: 10, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 6', price: 10, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 7', price: 10, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 8', price: 10, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 9', price: 10, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 10', price: 10, updatedAt: null },
    ])
  })

  it('returns the second page of results.', async () => {
    for (let i = 0; i < 30; i++) {
      await Product.create({ name: `Widget ${i + 1}`, price: 10, categoryId: 1 })
    }

    const products = await Product.skip(10).limit(10).get()

    expect(products).toEqual([
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 11', price: 10, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 12', price: 10, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 13', price: 10, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 14', price: 10, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 15', price: 10, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 16', price: 10, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 17', price: 10, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 18', price: 10, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 19', price: 10, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 20', price: 10, updatedAt: null },
    ])
  })
})

describe('Ordering', () => {
  beforeEach(async () => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${createUuid()}`
    })

    await Product.create({ name: 'Widget 1', price: 79.99, categoryId: 1 })
    await Product.create({ name: 'Widget 2', price: 44.99, categoryId: 1 })
    await Product.create({ name: 'Widget 3', price: 129.99, categoryId: 1 })
    await Product.create({ name: 'Widget 4', price: 19.99, categoryId: 1 })
    await Product.create({ name: 'Chair 1', price: 79.99, categoryId: 2 })
    await Product.create({ name: 'Chair 2', price: 49.99, categoryId: 2 })
  })

  it('returns products with ascending price.', async () => {
    const products = await Product.orderBy('price').get()

    expect(products).toEqual([
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 4', price: 19.99, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 2', price: 44.99, updatedAt: null },
      { categoryId: 2, createdAt: expect.any(Number), id: expect.any(String), name: 'Chair 2', price: 49.99, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 1', price: 79.99, updatedAt: null },
      { categoryId: 2, createdAt: expect.any(Number), id: expect.any(String), name: 'Chair 1', price: 79.99, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 3', price: 129.99, updatedAt: null },
    ])
  })

  it('returns products with descending price.', async () => {
    const products = await Product.orderBy('price', 'desc').get()

    expect(products).toEqual([
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 3', price: 129.99, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 1', price: 79.99, updatedAt: null },
      { categoryId: 2, createdAt: expect.any(Number), id: expect.any(String), name: 'Chair 1', price: 79.99, updatedAt: null },
      { categoryId: 2, createdAt: expect.any(Number), id: expect.any(String), name: 'Chair 2', price: 49.99, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 2', price: 44.99, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 4', price: 19.99, updatedAt: null }
    ])
  })

  it('returns products with ordered by multiple fields.', async () => {
    const products = await Product.orderBy('price', 'desc')
      .orderBy('name', 'asc')
      .get()

    expect(products).toEqual([
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 3', price: 129.99, updatedAt: null },
      { categoryId: 2, createdAt: expect.any(Number), id: expect.any(String), name: 'Chair 1', price: 79.99, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 1', price: 79.99, updatedAt: null },
      { categoryId: 2, createdAt: expect.any(Number), id: expect.any(String), name: 'Chair 2', price: 49.99, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 2', price: 44.99, updatedAt: null },
      { categoryId: 1, createdAt: expect.any(Number), id: expect.any(String), name: 'Widget 4', price: 19.99, updatedAt: null }
    ])
  })
})

describe('Relationships', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${createUuid()}`
    })
  })

  it('hasMany', async () => {
    const author = await Author.create({ name: 'John Smith' })

    await BlogPost.create({
      authorId: author.id,
      title: '21 tips to improve your MongoDB setup.'
    })

    await BlogPost.create({
      authorId: 'randomId',
      title: 'Order things in interesting ways.'
    })

    await BlogPost.create({
      authorId: author.id,
      title: 'How to store things in MongoDB.'
    })

    const posts = await author.blogPosts().get()

    expect(posts).toEqual([
      {
        authorId: author.id,
        createdAt: expect.any(Number),
        id: expect.any(String),
        title: '21 tips to improve your MongoDB setup.',
        updatedAt: null
      },
      {
        authorId: author.id,
        createdAt: expect.any(Number),
        id: expect.any(String),
        title: 'How to store things in MongoDB.',
        updatedAt: null
      }
    ])
  })
})

describe('Deletion', () => {
  beforeEach(async () => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${createUuid()}`
    })
  })

  it('Deletes multiple records', async () => {
    await Product.create({ name: 'Widget 1', price: 10, categoryId: 1 })
    await Product.create({ name: 'Widget 2', price: 10, categoryId: 1 })
    await Product.create({ name: 'Widget 3', price: 10, categoryId: 1 })
    await Product.create({ name: 'Chair 1', price: 10, categoryId: 2 })
    await Product.create({ name: 'Chair 2', price: 10, categoryId: 2 })
    await Product.create({ name: 'Chair 3', price: 10, categoryId: 2 })

    const numberOfRemovedProducts = await Product.where(
      'categoryId',
      2
    ).delete()
    const products = await Product.all()

    expect(numberOfRemovedProducts).toEqual(3)
    expect(products.length).toEqual(3)

    expect(products).toEqual([
      {
        categoryId: 1,
        createdAt: expect.any(Number),
        id: expect.any(String),
        name: 'Widget 1',
        price: 10,
        updatedAt: null
      },
      {
        categoryId: 1,
        createdAt: expect.any(Number),
        id: expect.any(String),
        name: 'Widget 2',
        price: 10,
        updatedAt: null
      },
      {
        categoryId: 1,
        createdAt: expect.any(Number),
        id: expect.any(String),
        name: 'Widget 3',
        price: 10,
        updatedAt: null
      }
    ])
  })

  it('Deletes a single record', async () => {
    const product = await Product.create({
      name: 'Widget 1',
      price: 10,
      categoryId: 1
    })

    expect(await Product.find(product.id)).not.toEqual(null)

    await product.delete()

    expect(await Product.find(product.id)).toEqual(null)
  })

  it('Does nothing with no matches', async () => {
    await Product.create({ name: 'Widget 1', price: 10, categoryId: 1 })
    await Product.create({ name: 'Widget 2', price: 10, categoryId: 1 })
    await Product.create({ name: 'Widget 3', price: 10, categoryId: 1 })
    await Product.create({ name: 'Chair 1', price: 10, categoryId: 2 })
    await Product.create({ name: 'Chair 2', price: 10, categoryId: 2 })
    await Product.create({ name: 'Chair 3', price: 10, categoryId: 2 })

    const numberOfRemovedProducts = await Product.where(
      'categoryId',
      53
    ).delete()
    const products = await Product.all()

    expect(numberOfRemovedProducts).toEqual(0)
    expect(products.length).toEqual(6)
  })
})

describe('FirstOrCreate', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${createUuid()}`
    })
  })

  it('returns existing flight when found', async () => {
    // Create initial flight
    const existingFlight = await Flight.create({
      name: 'London to Paris',
      delayed: 0,
      arrival_time: '10:30'
    })

    // Try to firstOrCreate with same name
    const flight = await Flight.firstOrCreate(
      { name: 'London to Paris' },
      { name: 'London to Paris', delayed: 1, arrival_time: '11:30' }
    )

    // Should return existing flight, not create new one
    expect(flight.id).toBe(existingFlight.id)
    expect(flight.delayed).toBe(0) // Should have original value
    expect(flight.arrival_time).toBe('10:30') // Should have original value

    // Verify only one flight exists
    const allFlights = await Flight.all()
    expect(allFlights).toHaveLength(1)
  })

  it('creates new flight when not found', async () => {
    // Try to firstOrCreate with non-existing name
    const flight = await Flight.firstOrCreate(
      { name: 'London to Paris' },
      { name: 'London to Paris', delayed: 1, arrival_time: '11:30' }
    )

    // Should create new flight
    expect(flight.id).toBeDefined()
    expect(flight.name).toBe('London to Paris')
    expect(flight.delayed).toBe(1)
    expect(flight.arrival_time).toBe('11:30')
    expect(flight.createdAt).toBeGreaterThan(0)
    expect(flight.updatedAt).toBe(null)

    // Verify flight was actually created in database
    const foundFlight = await Flight.find(flight.id)
    expect(foundFlight).toEqual(flight)
  })

  it('creates new flight using filter as attributes when attributes not provided', async () => {
    // Try to firstOrCreate with only filter
    const flight = await Flight.firstOrCreate({
      name: 'Paris to London'
    })

    // Should create new flight using filter values
    expect(flight.id).toBeDefined()
    expect(flight.name).toBe('Paris to London')
    expect(flight.delayed).toBe(0) // Default value from model
    expect(flight.arrival_time).toBe('') // Default value from model
    expect(flight.createdAt).toBeGreaterThan(0)
    expect(flight.updatedAt).toBe(null)

    // Verify flight was actually created in database
    const foundFlight = await Flight.find(flight.id)
    expect(foundFlight).toEqual(flight)
  })

  it('finds existing flight with filter-only syntax', async () => {
    // Create initial flight
    const existingFlight = await Flight.create({
      name: 'New York to London'
    })

    // Try to firstOrCreate with same name (filter-only syntax)
    const flight = await Flight.firstOrCreate({
      name: 'New York to London'
    })

    // Should return existing flight
    expect(flight.id).toBe(existingFlight.id)
    expect(flight.name).toBe('New York to London')

    // Verify only one flight exists
    const allFlights = await Flight.where('name', 'New York to London').get()
    expect(allFlights).toHaveLength(1)
  })
})

describe('Documentation', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${createUuid()}`
    })
  })

  it('lists all flights', async () => {
    const spy = vi.spyOn(console, 'log')

    spy.mockImplementation(() => { })

    await Flight.create({
      name: 'Indian Air 9600'
    })
    await Flight.create({
      name: 'Flight 714 to Sydney'
    })

    const flights = await Flight.all()

    flights.forEach((flight) => {
      console.log(flight.name)
    })

    expect(spy.mock.calls).toEqual([
      ['Indian Air 9600'],
      ['Flight 714 to Sydney']
    ])
  })
})
