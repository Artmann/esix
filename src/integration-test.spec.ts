import { v1 as createUuid } from 'uuid';
import mongodb from 'mongo-mock';

import { BaseModel } from './';
import { MongoClient } from 'mongodb';

mongodb.max_delay = 1;

class Author extends BaseModel {
  public name = '';

  blogPosts() {
    return this.hasMany(BlogPost);
  }
}

class BlogPost extends BaseModel {
  public title = '';

  public authorId?: string;
}

class Flight extends BaseModel {
  public name = '';
}

class Product extends BaseModel {
  public name = '';
  public price = 0;

  public categoryId?: number;
}

describe('Integration', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      'DB_ADAPTER': 'mock',
      'DB_DATABASE': `test-${ createUuid() }`
    });
  });

  it('finds a model by id', async() => {
    const author = await Author.create({
      name: 'John Smith'
    });

    await BlogPost.create({
      authorId: author.id,
      title: 'How to store things in MongoDB.'
    });
    const { id, createdAt } = await BlogPost.create({
      authorId: author.id,
      title: '21 tips to improve your MongoDB setup.'
    });

    const post = await BlogPost.find(id);

    expect(post).toEqual({
      authorId: author.id,
      createdAt,
      id,
      title: '21 tips to improve your MongoDB setup.',
      updatedAt: null
    });
  });

  it('finds a model with an id created in Mongo', async() => {
    const MockClient = (mongodb.MongoClient as unknown) as typeof MongoClient;
    const connection = await MockClient.connect(process.env['DB_URL'] || 'mongodb://127.0.0.1:27017/');
    const db = await connection.db(process.env['DB_DATABASE']);
    const collection = await db.collection('blog-posts');

    const { insertedId } = await collection.insertOne({
      title: 'Why ObjectIds makes your code fail.'
    });

    const id = insertedId.toHexString();

    const post = await BlogPost.find(id);

    expect(post).toEqual({
      createdAt: 0,
      id,
      title: 'Why ObjectIds makes your code fail.',
      updatedAt: null
    });
  });

  it('finds the first blog post', async() => {
    const author = await Author.create({
      name: 'John Smith'
    });
    const { id, createdAt } = await BlogPost.create({
      authorId: author.id,
      title: 'How to store things in MongoDB.'
    });

    await BlogPost.create({
      authorId: author.id,
      title: '21 tips to improve your MongoDB setup.'
    });

    const post = await BlogPost.where('authorId', author.id).first();

    expect(post).toEqual({
      authorId: author.id,
      createdAt,
      id,
      title: 'How to store things in MongoDB.',
      updatedAt: null
    });
  });

  it('updates existing model', async() => {
    const dateSpy = jest.spyOn(Date, 'now');

    dateSpy.mockReturnValue(42);

    const author = await Author.create({
      name: 'John Smith'
    });

    dateSpy.mockReturnValue(123);

    const existingAuthor = await Author.find(author.id);

    expect(existingAuthor).not.toBeNull();

    if (!existingAuthor) {
      return;
    }

    existingAuthor.name = 'John Oliver';

    await existingAuthor.save();

    const author2 = await Author.find(author.id);

    expect(existingAuthor).toEqual({
      createdAt: 42,
      id: author.id,
      name: 'John Oliver',
      updatedAt: 123
    });


    expect(author2).toEqual({
      createdAt: 42,
      id: author.id,
      name: 'John Oliver',
      updatedAt: 123
    });
  });

  it('persists a new model', async() => {
    jest.spyOn(Date, 'now').mockReturnValue(42);

    const author = new Author();

    author.name = 'Molly Markel';

    await author.save();

    expect(author).toEqual({
      createdAt: 42,
      id: expect.any(String),
      name: 'Molly Markel',
      updatedAt: null
    });
  })

  it('finds models by ids', async() => {
    const author1 = await Author.create({ name: 'Ayra York' });
    await Author.create({ name: 'Cain Young' });
    const author3 = await Author.create({ name: 'Antonio Dennis' });

    const authors = await Author.whereIn('id', [ author1.id, author3.id ]).get();

    expect(authors).toEqual([
      {
        createdAt: 42,
        id: author1.id,
        name: author1.name,
        updatedAt: null
      },
      {
        createdAt: 42,
        id: author3.id,
        name: author3.name,
        updatedAt: null
      }
    ]);
  });
});

describe('Ordering', () => {
  beforeEach(async() => {
    Object.assign(process.env, {
      'DB_ADAPTER': 'mock',
      'DB_DATABASE': `test-${ createUuid() }`
    });

    await Product.create({ name: 'Widget 1', price: 79.99, categoryId: 1 });
    await Product.create({ name: 'Widget 2', price: 44.99, categoryId: 1 });
    await Product.create({ name: 'Widget 3', price: 129.99, categoryId: 1 });
    await Product.create({ name: 'Widget 4', price: 19.99, categoryId: 1 });
    await Product.create({ name: 'Chair 1', price: 79.99, categoryId: 2 });
    await Product.create({ name: 'Chair 2', price: 49.99, categoryId: 2 });
  });

  it('returns products with ascending price.', async() => {
    const products = await Product.orderBy('price').pluck('name', 'price');

    expect(products).toEqual([
      { name: 'Widget 4', price: 19.99 },
      { name: 'Widget 2', price: 44.99 },
      { name: 'Chair 2', price: 49.99 },
      { name: 'Widget 1', price: 79.99 },
      { name: 'Chair 1', price: 79.99 },
      { name: 'Widget 3', price: 129.99  }
    ]);
  });

  it('returns products with descending price.', async() => {
    const products = await Product.orderBy('price', 'desc').pluck('name', 'price');

    expect(products).toEqual([
      { name: 'Widget 3', price: 129.99 },
      { name: 'Widget 1', price: 79.99 },
      { name: 'Chair 1', price: 79.99 },
      { name: 'Chair 2', price: 49.99 },
      { name: 'Widget 2', price: 44.99 },
      { name: 'Widget 4', price: 19.99  }
    ]);
  });

  it('returns products with ordered by multiple fields.', async() => {
    const products = await Product
      .orderBy('price', 'desc')
      .orderBy('name', 'asc')
      .pluck('name', 'price');

    expect(products).toEqual([
      { name: 'Widget 3', price: 129.99 },
      { name: 'Chair 1', price: 79.99 },
      { name: 'Widget 1', price: 79.99 },
      { name: 'Chair 2', price: 49.99 },
      { name: 'Widget 2', price: 44.99 },
      { name: 'Widget 4', price: 19.99  }
    ]);
  });
});

describe('Relationships', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      'DB_ADAPTER': 'mock',
      'DB_DATABASE': `test-${ createUuid() }`
    });
  });

  it('hasMany', async() => {
    const author = await Author.create({ name: 'John Smith' });

    await BlogPost.create({
      authorId: author.id,
      title: '21 tips to improve your MongoDB setup.'
    });

    await BlogPost.create({
      authorId: 'randomId',
      title: 'Order things in interesting ways.'
    });

    await BlogPost.create({
      authorId: author.id,
      title: 'How to store things in MongoDB.'
    });

    const posts = await author.blogPosts().get();

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
    ]);
  });
});

describe('Deletion', () => {
  beforeEach(async() => {
    Object.assign(process.env, {
      'DB_ADAPTER': 'mock',
      'DB_DATABASE': `test-${ createUuid() }`
    });
  });

  it('Deletes multiple records', async() => {
    await Product.create({ name: 'Widget 1', price: 10, categoryId: 1 });
    await Product.create({ name: 'Widget 2', price: 10, categoryId: 1 });
    await Product.create({ name: 'Widget 3', price: 10, categoryId: 1 });
    await Product.create({ name: 'Chair 1', price: 10, categoryId: 2 });
    await Product.create({ name: 'Chair 2', price: 10, categoryId: 2 });
    await Product.create({ name: 'Chair 3', price: 10, categoryId: 2 });

    const numberOfRemovedProducts = await Product.where('categoryId', 2).delete();
    const products = await Product.all();

    expect(numberOfRemovedProducts).toEqual(3);
    expect(products.length).toEqual(3);

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
    ]);
  });

  it('Deletes a single record', async() => {
    const product = await Product.create({ name: 'Widget 1', price: 10, categoryId: 1 });

    expect(await Product.find(product.id)).not.toEqual(null);

    await product.delete();

    expect(await Product.find(product.id)).toEqual(null);
  });

  it('Does nothing with no matches', async() => {
    await Product.create({ name: 'Widget 1', price: 10, categoryId: 1 });
    await Product.create({ name: 'Widget 2', price: 10, categoryId: 1 });
    await Product.create({ name: 'Widget 3', price: 10, categoryId: 1 });
    await Product.create({ name: 'Chair 1', price: 10, categoryId: 2 });
    await Product.create({ name: 'Chair 2', price: 10, categoryId: 2 });
    await Product.create({ name: 'Chair 3', price: 10, categoryId: 2 });

    const numberOfRemovedProducts = await Product.where('categoryId', 53).delete();
    const products = await Product.all();

    expect(numberOfRemovedProducts).toEqual(0);
    expect(products.length).toEqual(6);
  });
});

describe('Documentation', () => {

  beforeEach(() => {
    Object.assign(process.env, {
      'DB_ADAPTER': 'mock',
      'DB_DATABASE': `test-${ createUuid() }`
    });
  });

  it('lists all flights', async() => {
    const spy = jest.spyOn(console, 'log');

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    spy.mockImplementation(() => {});

    await Flight.create({
      name: 'Indian Air 9600'
    });
    await Flight.create({
      name: 'Flight 714 to Sydney'
    });

    const flights = await Flight.all();

    flights.forEach(flight => {
      console.log(flight.name);
    });

    expect(spy.mock.calls).toEqual([
      ['Indian Air 9600'],
      ['Flight 714 to Sydney']
    ]);
  });
});
