import { ObjectId } from 'mongodb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import BaseModel from './base-model'

vi.mock('mongodb')

function createCursor(documents: any[]) {
  const cursor: any = {
    limit: vi.fn(() => cursor),
    sort: vi.fn(() => cursor),
    toArray: () => documents
  }

  return cursor
}

const collection = {
  deleteOne: vi.fn(),
  deleteMany: vi.fn(),
  find: vi.fn(),
  findOne: vi.fn(),
  insertOne: vi.fn(),
  updateOne: vi.fn()
}
const database = {
  collection: () => Promise.resolve(collection)
}
const client = {
  db: () => database
}

vi.mock('mongo-mock', () => ({
  default: {
    MongoClient: {
      connect: () => Promise.resolve(client)
    }
  }
}))

class Book extends BaseModel {
  public isAvailable = true
  public isbn = ''
  public title = ''

  public authorId?: string
}

describe('BaseModel', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: 'test'
    })

    const ids = [
      '5f3568f2a0cdd1c9ba411c43',
      '5f3569089f762e8323e4eb84',
      '5f35690bf7f2173b99d638a3',
      '5f35690fd9415667293e27b1',
      '5f356912588afedc2a260ead'
    ]

    let idCounter = 0

    vi.mocked(ObjectId.prototype.toHexString).mockImplementation(() => {
      return ids[idCounter++ % ids.length]
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  describe('all', () => {
    it('finds all documents.', async () => {
      const cursor = createCursor([
        {
          _id: '5f3568f2a0cdd1c9ba411c43',
          authorId: 'author-1',
          createdAt: 1594552340652,
          isAvailable: true,
          isbn: '978-3-16-148410-0',
          title: 'Esix for dummies',
          updatedAt: null
        },
        {
          _id: '5f3569089f762e8323e4eb84',
          authorId: 'author-1',
          createdAt: 1594552346653,
          isAvailable: true,
          isbn: '978-3-16-148410-1',
          title: 'Esix for dummies 2',
          updatedAt: null
        }
      ])

      collection.find.mockReturnValue(cursor)

      const books = await Book.all()

      expect(collection.find).toHaveBeenCalledWith({})

      expect(books).toEqual([
        {
          authorId: 'author-1',
          createdAt: 1594552340652,
          id: '5f3568f2a0cdd1c9ba411c43',
          isAvailable: true,
          isbn: '978-3-16-148410-0',
          title: 'Esix for dummies',
          updatedAt: null
        },
        {
          authorId: 'author-1',
          createdAt: 1594552346653,
          id: '5f3569089f762e8323e4eb84',
          isAvailable: true,
          isbn: '978-3-16-148410-1',
          title: 'Esix for dummies 2',
          updatedAt: null
        }
      ])
    })

    it('returns an empty array if there is no documents.', async () => {
      const cursor = createCursor([])

      collection.find.mockReturnValue(cursor)

      const books = await Book.all()

      expect(collection.find).toHaveBeenCalledWith({})

      expect(books).toEqual([])
    })
  })

  describe('create', () => {
    it('creates a new Model.', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2023-01-01T10:00:00Z'))

      vi.mocked(ObjectId.prototype.toHexString).mockReturnValueOnce(
        '5f0aefba348289a81889a955'
      )

      collection.insertOne.mockResolvedValue({
        insertedId: '5f0aefba348289a81889a955'
      })
      collection.findOne.mockResolvedValue({
        _id: '5f0aefba348289a81889a955',
        authorId: 'author-1',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        isAvailable: true,
        isbn: '978-3-16-148410-3',
        title: 'Esix for dummies 3',
        updatedAt: null
      })

      const book = await Book.create({
        authorId: 'author-1',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        isbn: '978-3-16-148410-3',
        title: 'Esix for dummies 3',
        updatedAt: null
      })

      expect(collection.insertOne).toHaveBeenCalledWith({
        _id: '5f0aefba348289a81889a955',
        authorId: 'author-1',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        isAvailable: true,
        isbn: '978-3-16-148410-3',
        title: 'Esix for dummies 3',
        updatedAt: null
      })

      expect(book).toEqual({
        authorId: 'author-1',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        id: '5f0aefba348289a81889a955',
        isAvailable: true,
        isbn: '978-3-16-148410-3',
        title: 'Esix for dummies 3',
        updatedAt: null
      })
    })

    it('creates a new Model with the given id.', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2023-01-01T10:00:00Z'))

      vi.mocked(ObjectId.prototype.toHexString).mockReturnValue(
        '5f0aefba348289a81889a955'
      )
      collection.insertOne.mockResolvedValue({
        insertedId: '5f0aefba348289a81889a955'
      })
      collection.findOne.mockResolvedValue({
        _id: '5f0aefba348289a81889a955',
        authorId: 'author-1',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        isAvailable: true,
        isbn: '978-3-16-148410-3',
        title: 'Esix for dummies 3',
        updatedAt: null
      })

      const book = await Book.create({
        authorId: 'author-1',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        id: '5f0aefba348289a81889a955',
        isbn: '978-3-16-148410-3',
        title: 'Esix for dummies 3',
        updatedAt: null
      })

      expect(collection.insertOne).toHaveBeenCalledWith({
        _id: '5f0aefba348289a81889a955',
        authorId: 'author-1',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        isAvailable: true,
        isbn: '978-3-16-148410-3',
        title: 'Esix for dummies 3',
        updatedAt: null
      })

      expect(book).toEqual({
        authorId: 'author-1',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        id: '5f0aefba348289a81889a955',
        isAvailable: true,
        isbn: '978-3-16-148410-3',
        title: 'Esix for dummies 3',
        updatedAt: null
      })
    })

    it('includes the default values for the model.', async () => {
      vi.mocked(ObjectId.prototype.toHexString).mockReturnValue(
        '5f0aefba348289a81889a955'
      )
      collection.insertOne.mockResolvedValue({
        insertedId: '5f0aefba348289a81889a955'
      })
      collection.findOne.mockResolvedValue({
        _id: '5f0aefba348289a81889a955',
        authorId: 'author-1',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        isbn: '978-3-16-148410-3',
        title: 'Esix for dummies 3',
        updatedAt: null
      })

      await Book.create({
        authorId: 'author-1',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        id: '5f0aefba348289a81889a955',
        isbn: '978-3-16-148410-3',
        title: 'Esix for dummies 3',
        updatedAt: null
      })

      expect(collection.insertOne).toHaveBeenCalledWith({
        _id: '5f0aefba348289a81889a955',
        authorId: 'author-1',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        isAvailable: true,
        isbn: '978-3-16-148410-3',
        title: 'Esix for dummies 3',
        updatedAt: null
      })
    })
  })

  describe('delete', () => {
    it('deletes a book', async () => {
      const cursor = createCursor([
        {
          _id: '5f3568f2a0cdd1c9ba411c43',
          title: 'The Testaments',
          isbn: '9780525590453',
          authorId: 'author-1'
        }
      ])

      collection.find.mockReturnValue(cursor)
      collection.deleteOne.mockReturnValue({
        deletedCount: 1
      })

      const book = await Book.create({
        title: 'The Testaments',
        isbn: '9780525590453',
        authorId: 'author-1'
      })

      await book.delete()

      expect(collection.deleteOne).toHaveBeenCalledWith({
        _id: '5f3568f2a0cdd1c9ba411c43'
      })
    })
  })

  describe('find', () => {
    it('returns null for non existing documents.', async () => {
      collection.findOne.mockReturnValue(null)

      const book = await Book.find('abc-123')

      expect(collection.findOne).toHaveBeenCalledWith({ _id: 'abc-123' })

      expect(book).toBeNull()
    })

    it('finds a document by id.', async () => {
      vi.mocked(ObjectId.createFromHexString).mockImplementation(
        (hexString: string): ObjectId => new ObjectId(hexString)
      )

      collection.findOne.mockResolvedValue({
        _id: '5f3568f2a0cdd1c9ba411c43',
        authorId: 'author-1',
        createdAt: 1594552340652,
        isbn: '978-3-16-148410-0',
        title: 'Esix for dummies',
        updatedAt: null
      })

      const book = await Book.find('5f3568f2a0cdd1c9ba411c43')

      expect(collection.findOne).toHaveBeenCalledWith({
        $or: [
          { _id: expect.any(ObjectId) },
          { _id: '5f3568f2a0cdd1c9ba411c43' }
        ]
      })

      expect(book).toEqual({
        authorId: 'author-1',
        createdAt: 1594552340652,
        isAvailable: true,
        id: '5f3568f2a0cdd1c9ba411c43',
        isbn: '978-3-16-148410-0',
        title: 'Esix for dummies',
        updatedAt: null
      })
    })
  })

  describe('findBy', () => {
    it('returns null for non existing documents.', async () => {
      collection.findOne.mockReturnValue(null)

      const book = await Book.findBy('isbn', '978-3-16-148410-0')

      expect(collection.findOne).toHaveBeenCalledWith({
        isbn: '978-3-16-148410-0'
      })

      expect(book).toBeNull()
    })

    it('finds a document by id.', async () => {
      collection.findOne.mockResolvedValue({
        _id: '5f3568f2a0cdd1c9ba411c43',
        authorId: 'author-1',
        createdAt: 1594552340652,
        isAvailable: true,
        isbn: '978-3-16-148410-0',
        title: 'Esix for dummies',
        updatedAt: null
      })

      const book = await Book.findBy('isbn', '978-3-16-148410-0')

      expect(collection.findOne).toHaveBeenCalledWith({
        isbn: '978-3-16-148410-0'
      })

      expect(book).toEqual({
        authorId: 'author-1',
        createdAt: 1594552340652,
        isAvailable: true,
        id: '5f3568f2a0cdd1c9ba411c43',
        isbn: '978-3-16-148410-0',
        title: 'Esix for dummies',
        updatedAt: null
      })
    })
  })

  describe('first', () => {
    it('returns the first model.', async () => {
      const cursor = createCursor([
        {
          _id: '5f0aeaeacff57e3ec676b340',
          authorId: 'author-1',
          createdAt: 1594552340652,
          isAvailable: true,
          isbn: '978-3-16-148410-0',
          title: 'Esix for dummies',
          updatedAt: null
        },
        {
          _id: '5f0aeaeacff57e3ec676b340',
          authorId: 'author-1',
          createdAt: 1594552346653,
          isAvailable: true,
          isbn: '978-3-16-148410-1',
          title: 'Esix for dummies 2',
          updatedAt: null
        }
      ])

      collection.find.mockReturnValue(cursor)

      const book = await Book.where('authorId', 'author-1').first()

      expect(collection.find).toHaveBeenCalledWith({
        authorId: 'author-1'
      })

      expect(book).toEqual({
        authorId: 'author-1',
        createdAt: 1594552340652,
        isAvailable: true,
        id: '5f0aeaeacff57e3ec676b340',
        isbn: '978-3-16-148410-0',
        title: 'Esix for dummies',
        updatedAt: null
      })
    })

    it('returns null if there is no matching models.', async () => {
      const cursor = createCursor([])

      collection.find.mockReturnValue(cursor)

      const book = await Book.where('authorId', 'author-1').first()

      expect(collection.find).toHaveBeenCalledWith({
        authorId: 'author-1'
      })

      expect(book).toBeNull()
    })
  })

  describe('limit', () => {
    it('limits the amount of models returned', async () => {
      const cursor = createCursor([
        { _id: '1', title: 'Book 1' },
        { _id: '2', title: 'Book 2' },
        { _id: '3', title: 'Book 3' },
        { _id: '4', title: 'Book 4' },
        { _id: '5', title: 'Book 5' }
      ])

      collection.find.mockReturnValue(cursor)

      await Book.limit(3).get()

      expect(collection.find).toHaveBeenCalled()
      expect(cursor.limit).toHaveBeenCalledWith(3)
    })
  })

  describe('orderBy', () => {
    it('orders the models in ascending order', async () => {
      const cursor = createCursor([
        { _id: '1', title: 'Book 1' },
        { _id: '2', title: 'Book 2' },
        { _id: '3', title: 'Book 3' },
        { _id: '4', title: 'Book 4' },
        { _id: '5', title: 'Book 5' }
      ])

      collection.find.mockReturnValue(cursor)

      await Book.orderBy('title').get()

      expect(collection.find).toHaveBeenCalled()
      expect(cursor.sort).toHaveBeenCalledWith({
        title: 1
      })
    })

    it('orders the models in descending order', async () => {
      const cursor = createCursor([
        { _id: '1', title: 'Book 1' },
        { _id: '2', title: 'Book 2' },
        { _id: '3', title: 'Book 3' },
        { _id: '4', title: 'Book 4' },
        { _id: '5', title: 'Book 5' }
      ])

      collection.find.mockReturnValue(cursor)

      await Book.orderBy('title', 'desc').get()

      expect(collection.find).toHaveBeenCalled()
      expect(cursor.sort).toHaveBeenCalledWith({
        title: -1
      })
    })
  })

  describe('pluck', async () => {
    it('returns an array of values for the given key.', async () => {
      const cursor = createCursor([
        { _id: '1', title: 'Book 1' },
        { _id: '2', title: 'Book 2' },
        { _id: '3', title: 'Book 3' },
        { _id: '4', title: 'Book 4' },
        { _id: '5', title: 'Book 5' }
      ])

      collection.find.mockReturnValue(cursor)

      const titles = await Book.pluck('title')

      expect(titles).toEqual(['Book 1', 'Book 2', 'Book 3', 'Book 4', 'Book 5'])
    })
  })

  describe('save', () => {
    it('saves a book', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2023-01-01T10:00:00Z'))

      vi.mocked(ObjectId.prototype.toHexString).mockReturnValue(
        '5f347707fdec6e388b5c1d33'
      )

      const book = new Book()

      book.title = 'The Testaments'
      book.isbn = '9780525590453'
      book.authorId = 'author-1'

      await book.save()

      expect(collection.updateOne).toHaveBeenCalledWith(
        {
          _id: '5f347707fdec6e388b5c1d33'
        },
        {
          $set: {
            _id: '5f347707fdec6e388b5c1d33',
            authorId: 'author-1',
            createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
            isAvailable: true,
            isbn: '9780525590453',
            title: 'The Testaments',
            updatedAt: null
          }
        },
        {
          upsert: true
        }
      )
    })
  })

  describe('where', () => {
    it('finds all documets that matches a query', async () => {
      const cursor = createCursor([
        {
          _id: '5f0aeaeacff57e3ec676b340',
          authorId: 'author-1',
          createdAt: 1594552340652,
          isAvailable: true,
          isbn: '978-3-16-148410-0',
          title: 'Esix for dummies',
          updatedAt: null
        },
        {
          _id: '5f0aefba348289a81889a920',
          authorId: 'author-1',
          createdAt: 1594552346653,
          isAvailable: true,
          isbn: '978-3-16-148410-1',
          title: 'Esix for dummies 2',
          updatedAt: null
        }
      ])

      collection.find.mockReturnValue(cursor)

      const books = await Book.where('authorId', 'author-1').get()

      expect(collection.find).toHaveBeenCalledWith({
        authorId: 'author-1'
      })

      expect(books).toEqual([
        {
          authorId: 'author-1',
          createdAt: 1594552340652,
          id: '5f0aeaeacff57e3ec676b340',
          isAvailable: true,
          isbn: '978-3-16-148410-0',
          title: 'Esix for dummies',
          updatedAt: null
        },
        {
          authorId: 'author-1',
          createdAt: 1594552346653,
          id: '5f0aefba348289a81889a920',
          isAvailable: true,
          isbn: '978-3-16-148410-1',
          title: 'Esix for dummies 2',
          updatedAt: null
        }
      ])
    })

    it('returns an empty array if there is no matching documents.', async () => {
      const cursor = createCursor([])

      collection.find.mockReturnValue(cursor)

      const books = await Book.where('authorId', 'author-2').get()

      expect(collection.find).toHaveBeenCalledWith({
        authorId: 'author-2'
      })

      expect(books).toEqual([])
    })
  })

  describe('whereIn', () => {
    it('finds all documets that matches the ids', async () => {
      const cursor = createCursor([
        {
          _id: '5f0aeaeacff57e3ec676b340',
          authorId: 'author-1',
          createdAt: 1594552340652,
          isAvailable: true,
          isbn: '978-3-16-148410-0',
          title: 'Esix for dummies',
          updatedAt: null
        },
        {
          _id: '5f0aefba348289a81889a920',
          authorId: 'author-1',
          createdAt: 1594552346653,
          isAvailable: true,
          isbn: '978-3-16-148410-1',
          title: 'Esix for dummies 2',
          updatedAt: null
        }
      ])

      collection.find.mockReturnValue(cursor)

      const books = await Book.whereIn('id', [
        '5f0aeaeacff57e3ec676b340',
        '5f0aefba348289a81889a920'
      ]).get()

      expect(collection.find).toHaveBeenCalledWith({
        _id: {
          $in: ['5f0aeaeacff57e3ec676b340', '5f0aefba348289a81889a920']
        }
      })

      expect(books).toEqual([
        {
          authorId: 'author-1',
          createdAt: 1594552340652,
          id: '5f0aeaeacff57e3ec676b340',
          isAvailable: true,
          isbn: '978-3-16-148410-0',
          title: 'Esix for dummies',
          updatedAt: null
        },
        {
          authorId: 'author-1',
          createdAt: 1594552346653,
          id: '5f0aefba348289a81889a920',
          isAvailable: true,
          isbn: '978-3-16-148410-1',
          title: 'Esix for dummies 2',
          updatedAt: null
        }
      ])
    })
  })

  describe('whereNotIn', () => {
    it('finds all documents that do not match the ids', async () => {
      const cursor = createCursor([
        {
          _id: '5f0aeaeacff57e3ec676b341',
          authorId: 'author-2',
          createdAt: 1594552340659,
          isAvailable: true,
          isbn: '978-3-16-148410-2',
          title: 'Esix for experts',
          updatedAt: null
        },
        {
          _id: '5f0aefba348289a81889a921',
          authorId: 'author-2',
          createdAt: 1594552346659,
          isAvailable: true,
          isbn: '978-3-16-148410-3',
          title: 'Esix for experts 2',
          updatedAt: null
        }
      ])

      collection.find.mockReturnValue(cursor)

      const books = await Book.whereNotIn('id', [
        '5f0aeaeacff57e3ec676b340',
        '5f0aefba348289a81889a920'
      ]).get()

      expect(collection.find).toHaveBeenCalledWith({
        _id: {
          $nin: ['5f0aeaeacff57e3ec676b340', '5f0aefba348289a81889a920']
        }
      })

      expect(books).toEqual([
        {
          authorId: 'author-2',
          createdAt: 1594552340659,
          id: '5f0aeaeacff57e3ec676b341',
          isAvailable: true,
          isbn: '978-3-16-148410-2',
          title: 'Esix for experts',
          updatedAt: null
        },
        {
          authorId: 'author-2',
          createdAt: 1594552346659,
          id: '5f0aefba348289a81889a921',
          isAvailable: true,
          isbn: '978-3-16-148410-3',
          title: 'Esix for experts 2',
          updatedAt: null
        }
      ])
    })
  })

  describe('firstOrCreate', () => {
    it('returns existing model if found', async () => {
      collection.findOne.mockResolvedValue({
        _id: '5f0aeaeacff57e3ec676b340',
        authorId: 'author-1',
        createdAt: 1594552340652,
        isAvailable: true,
        isbn: '978-3-16-148410-0',
        title: 'Esix for dummies',
        updatedAt: null
      })

      const book = await Book.firstOrCreate(
        { isbn: '978-3-16-148410-0' },
        { title: 'New Book', isbn: '978-3-16-148410-0', authorId: 'author-2' }
      )

      expect(collection.findOne).toHaveBeenCalledWith({
        isbn: '978-3-16-148410-0'
      })

      expect(book).toEqual({
        authorId: 'author-1',
        createdAt: 1594552340652,
        id: '5f0aeaeacff57e3ec676b340',
        isAvailable: true,
        isbn: '978-3-16-148410-0',
        title: 'Esix for dummies',
        updatedAt: null
      })
    })

    it('creates new model if not found', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2023-01-01T10:00:00Z'))

      vi.mocked(ObjectId.prototype.toHexString).mockReturnValueOnce(
        '5f0aefba348289a81889a955'
      )

      collection.findOne.mockResolvedValueOnce(null)
      collection.insertOne.mockResolvedValue({
        insertedId: '5f0aefba348289a81889a955'
      })
      collection.findOne.mockResolvedValueOnce({
        _id: '5f0aefba348289a81889a955',
        authorId: 'author-2',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        isAvailable: true,
        isbn: '978-3-16-148410-5',
        title: 'New Book',
        updatedAt: null
      })

      const book = await Book.firstOrCreate(
        { isbn: '978-3-16-148410-5' },
        { title: 'New Book', isbn: '978-3-16-148410-5', authorId: 'author-2' }
      )

      expect(collection.findOne).toHaveBeenCalledWith({
        isbn: '978-3-16-148410-5'
      })

      expect(collection.insertOne).toHaveBeenCalledWith({
        _id: '5f0aefba348289a81889a955',
        authorId: 'author-2',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        isAvailable: true,
        isbn: '978-3-16-148410-5',
        title: 'New Book',
        updatedAt: null
      })

      expect(book).toEqual({
        authorId: 'author-2',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        id: '5f0aefba348289a81889a955',
        isAvailable: true,
        isbn: '978-3-16-148410-5',
        title: 'New Book',
        updatedAt: null
      })
    })

    it('creates new model using filter as attributes when attributes not provided', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2023-01-01T10:00:00Z'))

      vi.mocked(ObjectId.prototype.toHexString).mockReturnValueOnce(
        '5f0aefba348289a81889a956'
      )

      collection.findOne.mockResolvedValueOnce(null)
      collection.insertOne.mockResolvedValue({
        insertedId: '5f0aefba348289a81889a956'
      })
      collection.findOne.mockResolvedValueOnce({
        _id: '5f0aefba348289a81889a956',
        authorId: 'author-3',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        isAvailable: true,
        isbn: '',
        title: 'Quick Book',
        updatedAt: null
      })

      const book = await Book.firstOrCreate({
        title: 'Quick Book',
        authorId: 'author-3'
      })

      expect(collection.findOne).toHaveBeenCalledWith({
        title: 'Quick Book',
        authorId: 'author-3'
      })

      expect(collection.insertOne).toHaveBeenCalledWith({
        _id: '5f0aefba348289a81889a956',
        authorId: 'author-3',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        isAvailable: true,
        isbn: '',
        title: 'Quick Book',
        updatedAt: null
      })

      expect(book).toEqual({
        authorId: 'author-3',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        id: '5f0aefba348289a81889a956',
        isAvailable: true,
        isbn: '',
        title: 'Quick Book',
        updatedAt: null
      })
    })
  })
})
