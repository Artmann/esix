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
  updateOne: vi.fn(),
  count: vi.fn(),
  aggregate: vi.fn()
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
  public pages = 0

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
          isbn: '9780486284736',
          pages: 279,
          title: 'Pride and Prejudice',
          updatedAt: null
        },
        {
          _id: '5f3569089f762e8323e4eb84',
          authorId: 'author-1',
          createdAt: 1594552346653,
          isAvailable: true,
          isbn: '9780141439518',
          pages: 544,
          title: 'Jane Eyre',
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
          isbn: '9780486284736',
          pages: 279,
          title: 'Pride and Prejudice',
          updatedAt: null
        },
        {
          authorId: 'author-1',
          createdAt: 1594552346653,
          id: '5f3569089f762e8323e4eb84',
          isAvailable: true,
          isbn: '9780141439518',
          pages: 544,
          title: 'Jane Eyre',
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
        isbn: '9780486411095',
        pages: 376,
        title: 'Wuthering Heights',
        updatedAt: null
      })

      const book = await Book.create({
        authorId: 'author-1',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        isbn: '9780486411095',
        title: 'Wuthering Heights',
        pages: 376,
        updatedAt: null
      })

      expect(collection.insertOne).toHaveBeenCalledWith({
        _id: '5f0aefba348289a81889a955',
        authorId: 'author-1',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        isAvailable: true,
        isbn: '9780486411095',
        pages: 376,
        title: 'Wuthering Heights',
        updatedAt: null
      })

      expect(book).toEqual({
        authorId: 'author-1',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        id: '5f0aefba348289a81889a955',
        isAvailable: true,
        isbn: '9780486411095',
        pages: 376,
        title: 'Wuthering Heights',
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
        isbn: '9780486411095',
        pages: 376,
        title: 'Wuthering Heights',
        updatedAt: null
      })

      const book = await Book.create({
        authorId: 'author-1',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        id: '5f0aefba348289a81889a955',
        isbn: '9780486411095',
        title: 'Wuthering Heights',
        pages: 376,
        updatedAt: null
      })

      expect(collection.insertOne).toHaveBeenCalledWith({
        _id: '5f0aefba348289a81889a955',
        authorId: 'author-1',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        isAvailable: true,
        isbn: '9780486411095',
        pages: 376,
        title: 'Wuthering Heights',
        updatedAt: null
      })

      expect(book).toEqual({
        authorId: 'author-1',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        id: '5f0aefba348289a81889a955',
        isAvailable: true,
        isbn: '9780486411095',
        pages: 376,
        title: 'Wuthering Heights',
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
        isbn: '9780486411095',
        pages: 376,
        title: 'Wuthering Heights',
        updatedAt: null
      })

      await Book.create({
        authorId: 'author-1',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        id: '5f0aefba348289a81889a955',
        isbn: '9780486411095',
        title: 'Wuthering Heights',
        pages: 376,
        updatedAt: null
      })

      expect(collection.insertOne).toHaveBeenCalledWith({
        _id: '5f0aefba348289a81889a955',
        authorId: 'author-1',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        isAvailable: true,
        isbn: '9780486411095',
        pages: 376,
        title: 'Wuthering Heights',
        updatedAt: null
      })
    })
  })

  describe('delete', () => {
    it('deletes a book', async () => {
      const cursor = createCursor([
        {
          _id: '5f3568f2a0cdd1c9ba411c43',
          title: 'Pride and Prejudice',
          isbn: '9780486284736',
          pages: 279,
          authorId: 'author-1'
        }
      ])

      collection.find.mockReturnValue(cursor)
      collection.deleteOne.mockReturnValue({
        deletedCount: 1
      })

      const book = await Book.create({
        title: 'Pride and Prejudice',
        isbn: '9780486284736',
        pages: 279,
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
        isbn: '9780486284736',
        pages: 279,
        title: 'Pride and Prejudice',
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
        isbn: '9780486284736',
        pages: 279,
        title: 'Pride and Prejudice',
        updatedAt: null
      })
    })
  })

  describe('findBy', () => {
    it('returns null for non existing documents.', async () => {
      collection.findOne.mockReturnValue(null)

      const book = await Book.findBy('isbn', '9780486284736')

      expect(collection.findOne).toHaveBeenCalledWith({
        isbn: '9780486284736'
      })

      expect(book).toBeNull()
    })

    it('finds a document by id.', async () => {
      collection.findOne.mockResolvedValue({
        _id: '5f3568f2a0cdd1c9ba411c43',
        authorId: 'author-1',
        createdAt: 1594552340652,
        isAvailable: true,
        isbn: '9780486284736',
        pages: 279,
        title: 'Pride and Prejudice',
        updatedAt: null
      })

      const book = await Book.findBy('isbn', '9780486284736')

      expect(collection.findOne).toHaveBeenCalledWith({
        isbn: '9780486284736'
      })

      expect(book).toEqual({
        authorId: 'author-1',
        createdAt: 1594552340652,
        isAvailable: true,
        id: '5f3568f2a0cdd1c9ba411c43',
        isbn: '9780486284736',
        pages: 279,
        title: 'Pride and Prejudice',
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
          isbn: '9780486284736',
          pages: 279,
          title: 'Pride and Prejudice',
          updatedAt: null
        },
        {
          _id: '5f0aeaeacff57e3ec676b340',
          authorId: 'author-1',
          createdAt: 1594552346653,
          isAvailable: true,
          isbn: '9780141439518',
          pages: 544,
          title: 'Jane Eyre',
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
        isbn: '9780486284736',
        pages: 279,
        title: 'Pride and Prejudice',
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

      book.title = 'Emma'
      book.isbn = '9780141439600'
      book.pages = 448
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
            isbn: '9780141439600',
            pages: 448,
            title: 'Emma',
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
          isbn: '9780486284736',
          pages: 279,
          title: 'Pride and Prejudice',
          updatedAt: null
        },
        {
          _id: '5f0aefba348289a81889a920',
          authorId: 'author-1',
          createdAt: 1594552346653,
          isAvailable: true,
          isbn: '9780141439518',
          pages: 544,
          title: 'Jane Eyre',
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
          isbn: '9780486284736',
          pages: 279,
          title: 'Pride and Prejudice',
          updatedAt: null
        },
        {
          authorId: 'author-1',
          createdAt: 1594552346653,
          id: '5f0aefba348289a81889a920',
          isAvailable: true,
          isbn: '9780141439518',
          pages: 544,
          title: 'Jane Eyre',
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

  describe('where with comparison operators', () => {
    it('filters using greater than operator', async () => {
      const cursor = createCursor([
        {
          _id: '5f0aeaeacff57e3ec676b340',
          authorId: 'author-1',
          createdAt: 1594552340652,
          isAvailable: true,
          isbn: '9780141439518',
          pages: 544,
          title: 'Jane Eyre',
          updatedAt: null
        },
        {
          _id: '5f0aefba348289a81889a920',
          authorId: 'author-2',
          createdAt: 1594552346653,
          isAvailable: true,
          isbn: '9780140449266',
          pages: 688,
          title: 'Crime and Punishment',
          updatedAt: null
        }
      ])

      collection.find.mockReturnValue(cursor)

      const books = await Book.where('pages', '>', 300).get()

      expect(collection.find).toHaveBeenCalledWith({
        pages: { $gt: 300 }
      })

      expect(books).toHaveLength(2)
    })

    it('filters using greater than or equal operator', async () => {
      const cursor = createCursor([
        {
          _id: '5f0aeaeacff57e3ec676b340',
          authorId: 'author-1',
          createdAt: 1594552340652,
          isAvailable: true,
          isbn: '9780486284736',
          pages: 279,
          title: 'Pride and Prejudice',
          updatedAt: null
        }
      ])

      collection.find.mockReturnValue(cursor)

      const books = await Book.where('pages', '>=', 279).get()

      expect(collection.find).toHaveBeenCalledWith({
        pages: { $gte: 279 }
      })

      expect(books).toHaveLength(1)
    })

    it('filters using less than operator', async () => {
      const cursor = createCursor([
        {
          _id: '5f0aeaeacff57e3ec676b340',
          authorId: 'author-1',
          createdAt: 1594552340652,
          isAvailable: true,
          isbn: '9780486284736',
          pages: 279,
          title: 'Pride and Prejudice',
          updatedAt: null
        }
      ])

      collection.find.mockReturnValue(cursor)

      const books = await Book.where('pages', '<', 300).get()

      expect(collection.find).toHaveBeenCalledWith({
        pages: { $lt: 300 }
      })

      expect(books).toHaveLength(1)
    })

    it('filters using less than or equal operator', async () => {
      const cursor = createCursor([
        {
          _id: '5f0aeaeacff57e3ec676b340',
          authorId: 'author-1',
          createdAt: 1594552340652,
          isAvailable: true,
          isbn: '9780486284736',
          pages: 279,
          title: 'Pride and Prejudice',
          updatedAt: null
        },
        {
          _id: '5f0aefba348289a81889a920',
          authorId: 'author-1',
          createdAt: 1594552346653,
          isAvailable: true,
          isbn: '9780486411095',
          pages: 376,
          title: 'Wuthering Heights',
          updatedAt: null
        }
      ])

      collection.find.mockReturnValue(cursor)

      const books = await Book.where('pages', '<=', 376).get()

      expect(collection.find).toHaveBeenCalledWith({
        pages: { $lte: 376 }
      })

      expect(books).toHaveLength(2)
    })

    it('filters using equals operator', async () => {
      const cursor = createCursor([
        {
          _id: '5f0aeaeacff57e3ec676b340',
          authorId: 'author-1',
          createdAt: 1594552340652,
          isAvailable: true,
          isbn: '9780486284736',
          pages: 279,
          title: 'Pride and Prejudice',
          updatedAt: null
        }
      ])

      collection.find.mockReturnValue(cursor)

      const books = await Book.where('pages', '=', 279).get()

      expect(collection.find).toHaveBeenCalledWith({
        pages: 279
      })

      expect(books).toHaveLength(1)
    })

    it('filters using not equals operator (!=)', async () => {
      const cursor = createCursor([
        {
          _id: '5f0aeaeacff57e3ec676b340',
          authorId: 'author-1',
          createdAt: 1594552340652,
          isAvailable: true,
          isbn: '9780141439518',
          pages: 544,
          title: 'Jane Eyre',
          updatedAt: null
        }
      ])

      collection.find.mockReturnValue(cursor)

      const books = await Book.where('pages', '!=', 279).get()

      expect(collection.find).toHaveBeenCalledWith({
        pages: { $ne: 279 }
      })

      expect(books).toHaveLength(1)
    })

    it('filters using not equals operator (<>)', async () => {
      const cursor = createCursor([
        {
          _id: '5f0aeaeacff57e3ec676b340',
          authorId: 'author-1',
          createdAt: 1594552340652,
          isAvailable: true,
          isbn: '9780141439518',
          pages: 544,
          title: 'Jane Eyre',
          updatedAt: null
        }
      ])

      collection.find.mockReturnValue(cursor)

      const books = await Book.where('pages', '<>', 279).get()

      expect(collection.find).toHaveBeenCalledWith({
        pages: { $ne: 279 }
      })

      expect(books).toHaveLength(1)
    })

    it('chains multiple comparison operators', async () => {
      const cursor = createCursor([
        {
          _id: '5f0aeaeacff57e3ec676b340',
          authorId: 'author-1',
          createdAt: 1594552340652,
          isAvailable: true,
          isbn: '9780486411095',
          pages: 376,
          title: 'Wuthering Heights',
          updatedAt: null
        }
      ])

      collection.find.mockReturnValue(cursor)

      const books = await Book.where('pages', '>', 300)
        .where('pages', '<', 500)
        .get()

      expect(collection.find).toHaveBeenCalledWith({
        pages: { $lt: 500 }
      })

      expect(books).toHaveLength(1)
    })

    it('maintains backward compatibility with 2-parameter syntax', async () => {
      const cursor = createCursor([
        {
          _id: '5f0aeaeacff57e3ec676b340',
          authorId: 'author-1',
          createdAt: 1594552340652,
          isAvailable: true,
          isbn: '9780486284736',
          pages: 279,
          title: 'Pride and Prejudice',
          updatedAt: null
        }
      ])

      collection.find.mockReturnValue(cursor)

      const books = await Book.where('authorId', 'author-1').get()

      expect(collection.find).toHaveBeenCalledWith({
        authorId: 'author-1'
      })

      expect(books).toHaveLength(1)
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
          isbn: '9780486284736',
          pages: 279,
          title: 'Pride and Prejudice',
          updatedAt: null
        },
        {
          _id: '5f0aefba348289a81889a920',
          authorId: 'author-1',
          createdAt: 1594552346653,
          isAvailable: true,
          isbn: '9780141439518',
          pages: 544,
          title: 'Jane Eyre',
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
          isbn: '9780486284736',
          pages: 279,
          title: 'Pride and Prejudice',
          updatedAt: null
        },
        {
          authorId: 'author-1',
          createdAt: 1594552346653,
          id: '5f0aefba348289a81889a920',
          isAvailable: true,
          isbn: '9780141439518',
          pages: 544,
          title: 'Jane Eyre',
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
          isbn: '9780486415871',
          pages: 512,
          title: 'Moby Dick',
          updatedAt: null
        },
        {
          _id: '5f0aefba348289a81889a921',
          authorId: 'author-2',
          createdAt: 1594552346659,
          isAvailable: true,
          isbn: '9780486409825',
          pages: 304,
          title: 'The Picture of Dorian Gray',
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
          isbn: '9780486415871',
          pages: 512,
          title: 'Moby Dick',
          updatedAt: null
        },
        {
          authorId: 'author-2',
          createdAt: 1594552346659,
          id: '5f0aefba348289a81889a921',
          isAvailable: true,
          isbn: '9780486409825',
          pages: 304,
          title: 'The Picture of Dorian Gray',
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
        isbn: '9780486284736',
        pages: 279,
        title: 'Pride and Prejudice',
        updatedAt: null
      })

      const book = await Book.firstOrCreate(
        { isbn: '9780486284736' },
        {
          title: 'Pride and Prejudice',
          isbn: '9780486284736',
          pages: 279,
          authorId: 'author-2'
        }
      )

      expect(collection.findOne).toHaveBeenCalledWith({
        isbn: '9780486284736'
      })

      expect(book).toEqual({
        authorId: 'author-1',
        createdAt: 1594552340652,
        id: '5f0aeaeacff57e3ec676b340',
        isAvailable: true,
        isbn: '9780486284736',
        pages: 279,
        title: 'Pride and Prejudice',
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
        isbn: '9780140449266',
        pages: 688,
        title: 'Crime and Punishment',
        updatedAt: null
      })

      const book = await Book.firstOrCreate(
        { isbn: '9780140449266' },
        {
          title: 'Crime and Punishment',
          isbn: '9780140449266',
          pages: 688,
          authorId: 'author-2'
        }
      )

      expect(collection.findOne).toHaveBeenCalledWith({
        isbn: '9780140449266'
      })

      expect(collection.insertOne).toHaveBeenCalledWith({
        _id: '5f0aefba348289a81889a955',
        authorId: 'author-2',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        isAvailable: true,
        isbn: '9780140449266',
        pages: 688,
        title: 'Crime and Punishment',
        updatedAt: null
      })

      expect(book).toEqual({
        authorId: 'author-2',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        id: '5f0aefba348289a81889a955',
        isAvailable: true,
        isbn: '9780140449266',
        pages: 688,
        title: 'Crime and Punishment',
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
        isbn: '9780486282114',
        pages: 320,
        title: 'The Great Gatsby',
        updatedAt: null
      })

      const book = await Book.firstOrCreate({
        title: 'The Great Gatsby',
        isbn: '9780486282114',
        pages: 320,
        authorId: 'author-3'
      })

      expect(collection.findOne).toHaveBeenCalledWith({
        title: 'The Great Gatsby',
        isbn: '9780486282114',
        pages: 320,
        authorId: 'author-3'
      })

      expect(collection.insertOne).toHaveBeenCalledWith({
        _id: '5f0aefba348289a81889a956',
        authorId: 'author-3',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        isAvailable: true,
        isbn: '9780486282114',
        pages: 320,
        title: 'The Great Gatsby',
        updatedAt: null
      })

      expect(book).toEqual({
        authorId: 'author-3',
        createdAt: new Date('2023-01-01T10:00:00Z').getTime(),
        id: '5f0aefba348289a81889a956',
        isAvailable: true,
        isbn: '9780486282114',
        pages: 320,
        title: 'The Great Gatsby',
        updatedAt: null
      })
    })
  })

  describe('Static Aggregation Functions', () => {
    describe('count', () => {
      it('returns the number of documents', async () => {
        collection.count = vi.fn().mockResolvedValue(5)

        const count = await Book.count()

        expect(collection.count).toHaveBeenCalledWith({})
        expect(count).toEqual(5)
      })
    })

    describe('sum', () => {
      it('returns the sum of values for a given key', async () => {
        const cursor = createCursor([
          { _id: '1', isbn: '9780486284736', pages: 279 },
          { _id: '2', isbn: '9780141439518', pages: 544 },
          { _id: '3', isbn: '9780486411095', pages: 376 }
        ])

        collection.find.mockReturnValue(cursor)

        const sum = await Book.sum('pages')

        expect(collection.find).toHaveBeenCalledWith({}, { pages: 1 })
        expect(sum).toEqual(1199)
      })

      it('calculates sum correctly for numeric values', async () => {
        const cursor = createCursor([
          { _id: '1', pages: 279 },
          { _id: '2', pages: 544 },
          { _id: '3', pages: 376 }
        ])

        collection.find.mockReturnValue(cursor)

        const sum = await Book.sum('pages')

        expect(sum).toEqual(1199)
      })
    })

    describe('average', () => {
      it('calculates average correctly for numeric values', async () => {
        const cursor = createCursor([
          { _id: '1', pages: 320 },
          { _id: '2', pages: 400 },
          { _id: '3', pages: 280 }
        ])

        collection.find.mockReturnValue(cursor)

        const average = await Book.average('pages')

        expect(average).toEqual(333.3333333333333)
      })

      it('returns 0 when no values exist', async () => {
        const cursor = createCursor([])

        collection.find.mockReturnValue(cursor)

        const average = await Book.average('pages')

        expect(average).toEqual(0)
      })
    })

    describe('max', () => {
      it('returns the maximum value for a given key', async () => {
        const cursor = createCursor([
          { _id: '1', pages: 279 },
          { _id: '2', pages: 688 },
          { _id: '3', pages: 544 }
        ])

        collection.find.mockReturnValue(cursor)

        const max = await Book.max('pages')

        expect(max).toEqual(688)
      })
    })

    describe('min', () => {
      it('returns the minimum value for a given key', async () => {
        const cursor = createCursor([
          { _id: '1', pages: 279 },
          { _id: '2', pages: 688 },
          { _id: '3', pages: 544 }
        ])

        collection.find.mockReturnValue(cursor)

        const min = await Book.min('pages')

        expect(min).toEqual(279)
      })
    })

    describe('percentile', () => {
      it('returns the nth percentile for a given key', async () => {
        const cursor = createCursor([
          { _id: '1', pages: 320 },
          { _id: '2', pages: 400 },
          { _id: '3', pages: 480 }
        ])

        collection.find.mockReturnValue(cursor)

        const percentile = await Book.percentile('pages', 50)

        expect(collection.find).toHaveBeenCalledWith({}, { pages: 1 })
        expect(percentile).toEqual(400)
      })
    })

    describe('aggregate', () => {
      it('calls the aggregate method on the collection', async () => {
        const aggregationStages = [
          { $group: { _id: '$authorId', count: { $sum: 1 } } }
        ]
        const aggregationResult = [
          { _id: 'author-1', count: 3 },
          { _id: 'author-2', count: 2 }
        ]

        collection.aggregate = vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(aggregationResult)
        })

        const result = await Book.aggregate(aggregationStages)

        expect(collection.aggregate).toHaveBeenCalledWith(aggregationStages)
        expect(result).toEqual(aggregationResult)
      })
    })
  })
})
