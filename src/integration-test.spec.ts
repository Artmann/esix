import { v1 as createUuid } from 'uuid';
import { BaseModel } from './';

class Author extends BaseModel {
  public name = '';
}

class BlogPost extends BaseModel {
  public title = '';

  public authorId?: string;
}

class Flight extends BaseModel {
  public name = '';
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
