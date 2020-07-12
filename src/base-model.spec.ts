import BaseModel from './base-model';
import { ObjectId } from 'mongodb';

function createCursor(documents: any[]) {
  return {
    toArray: () => documents
  };
}

const collection = {
  find: jest.fn(),
  findOne: jest.fn()
};
const database = {
  collection: () => Promise.resolve(collection)
};
const client = {
  db: () => database
};

jest.mock('mongo-mock', () => ({
  MongoClient: {
    connect: () => Promise.resolve(client)
  }
}));

class Book extends BaseModel {
  public isbn = '';
  public title = '';

  public authorId?: string;
}

describe('BaseModel', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      'DB_ADAPTER': 'mock',
      'DB_DATABASE': `test`
    });
  });

  describe('find', () => {

    it('returns null for non existing documents', async() => {
      const book = await Book.find('abc-123');

      expect(collection.findOne).toHaveBeenCalledWith({
        _id: 'abc-123'
      });

      expect(book).toBeNull();
    });

    it('finds a document by id', async() => {
      collection.findOne.mockResolvedValue({
        _id: new ObjectId('5f0aeaeacff57e3ec676b340'),
        authorId: 'author-1',
        createdAt: 1594552340652,
        isbn: '978-3-16-148410-0',
        title: 'Esix for dummies',
        updatedAt: 0
      });

      const book = await Book.find('5f0aeaeacff57e3ec676b340');

      expect(collection.findOne).toHaveBeenCalledWith({
        _id: '5f0aeaeacff57e3ec676b340'
      });

      expect(book).toEqual({
        authorId: 'author-1',
        createdAt: 1594552340652,
        id: '5f0aeaeacff57e3ec676b340',
        isbn: '978-3-16-148410-0',
        title: 'Esix for dummies',
        updatedAt: 0
      });
    });
  });

  describe('all',  () => {
    it ('finds all documets', async() => {
      const cursor = createCursor([
        {
          _id: new ObjectId('5f0aeaeacff57e3ec676b340'),
          authorId: 'author-1',
          createdAt: 1594552340652,
          isbn: '978-3-16-148410-0',
          title: 'Esix for dummies',
          updatedAt: 0
        },
        {
          _id: new ObjectId('5f0aefba348289a81889a920'),
          authorId: 'author-1',
          createdAt: 1594552346653,
          isbn: '978-3-16-148410-1',
          title: 'Esix for dummies 2',
          updatedAt: 0
        }
      ]);

      collection.find.mockReturnValue(cursor);

      const books = await Book.all();

      expect(collection.find).toHaveBeenCalledWith({});

      expect(books).toEqual([
        {
          authorId: 'author-1',
          createdAt: 1594552340652,
          id: '5f0aeaeacff57e3ec676b340',
          isbn: '978-3-16-148410-0',
          title: 'Esix for dummies',
          updatedAt: 0
        },
        {
          authorId: 'author-1',
          createdAt: 1594552346653,
          id: '5f0aefba348289a81889a920',
          isbn: '978-3-16-148410-1',
          title: 'Esix for dummies 2',
          updatedAt: 0
        }
      ]);
    });
  });

  describe('where', () => {
    it ('finds all documets that matches a query', async() => {
      const cursor = createCursor([
        {
          _id: new ObjectId('5f0aeaeacff57e3ec676b340'),
          authorId: 'author-1',
          createdAt: 1594552340652,
          isbn: '978-3-16-148410-0',
          title: 'Esix for dummies',
          updatedAt: 0
        },
        {
          _id: new ObjectId('5f0aefba348289a81889a920'),
          authorId: 'author-1',
          createdAt: 1594552346653,
          isbn: '978-3-16-148410-1',
          title: 'Esix for dummies 2',
          updatedAt: 0
        }
      ]);

      collection.find.mockReturnValue(cursor);

      const books = await Book.where('authorId', 'author-1').get();

      expect(collection.find).toHaveBeenCalledWith({
        authorId: 'author-1'
      });

      expect(books).toEqual([
        {
          authorId: 'author-1',
          createdAt: 1594552340652,
          id: '5f0aeaeacff57e3ec676b340',
          isbn: '978-3-16-148410-0',
          title: 'Esix for dummies',
          updatedAt: 0
        },
        {
          authorId: 'author-1',
          createdAt: 1594552346653,
          id: '5f0aefba348289a81889a920',
          isbn: '978-3-16-148410-1',
          title: 'Esix for dummies 2',
          updatedAt: 0
        }
      ]);
    });
  });
});
