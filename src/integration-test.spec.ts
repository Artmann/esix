import { v1 as createUuid } from 'uuid';
import { BaseModel } from './';

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

  it('find a model by id', async() => {
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

  it('updates values and persist them', async() => {
    const dateSpy = jest.spyOn(Date, 'now');

    dateSpy.mockReturnValue(42);

    const author = await Author.create({
      name: 'John Smith'
    });

    dateSpy.mockReturnValue(123);

    author.name = 'John Oliver';

    await author.save();

    const author2 = await Author.find(author.id);

    expect(author).toEqual({
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
