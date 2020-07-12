import { v1 as createUuid } from 'uuid';
import BaseModel from './base-model';

class Author extends BaseModel {
  public name = '';
}

class BlogPost extends BaseModel {
  public title = '';

  public authorId?: string;
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
      updatedAt: 0
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
      updatedAt: 0
    });
  });
});

