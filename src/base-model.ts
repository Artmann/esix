import 'reflect-metadata';

import QueryBuilder from './query-builder';
import { ObjectType, Dictionary } from './types';
import { camelCase } from 'change-case';

export default class BaseModel {
  public createdAt = 0;
  public id = '';
  public updatedAt: number | null = null;

  /**
   * Returns all models.
   *
   * Example
   * ```
   * const posts = await BlogPost.all();
   * ```
   */
  static async all<T extends BaseModel>(this: ObjectType<T>): Promise<T[]> {
    return new QueryBuilder(this).where({}).get();
  }

  /**
   * Creates a new model with the given attributes. The Id will be automatically generated
   * if none is provided.
   *
   * Example
   * ```
   * const post = await BlogPost.create({ title: 'My First Blog Post!' });
   * ```
   *
   * @param attributes
   */
  static async create<T extends BaseModel>(this: ObjectType<T>, attributes: Dictionary): Promise<T> {
    const queryBuilder = new QueryBuilder(this);

    const id = await queryBuilder.create(attributes);
    const model = await queryBuilder.findOne({
      _id: id
    });

    if (!model) {
      throw new Error('Failed to create model.');
    }

    return model;
  }

  /**
   * Returns the model with the given id.
   *
   * Example
   * ```
   * const post = await BlogPost.find('5f5a41cc3eb990709eafda43');
   * ```
   *
   * @param id
   */
  static async find<T extends BaseModel>(this: ObjectType<T>, id?: string | number): Promise<T | null> {
    return new QueryBuilder(this).findOne({
      _id: id
    });
  }

  /**
   * Returns the first model matching where the `key` matches `value`.
   *
   * Example
   * ```
   * const user = await User.findBy('email', 'john.smith@company.com');
   * ```
   *
   * @param key
   * @param value
   */
  static async findBy<T extends BaseModel>(this: ObjectType<T>, key: string, value: any): Promise<T | null> {
    return new QueryBuilder(this).findOne({
      [key]: value
    });
  }

  /**
   * Limits the number of models returned.
   *
   * @param length
   */
  static limit<T extends BaseModel>(this: ObjectType<T>, length: number): QueryBuilder<T> {
    return new QueryBuilder<T>(this).limit(length);
  }

  /**
   * Specifies the order the models are returned.
   *
   * Example
   * ```
   * const posts = await BlogPost.orderBy('publishedAt', 'desc').get();
   * ```
   *
   * @param key
   * @param order
   */
  static orderBy<T extends BaseModel>(this: ObjectType<T>,key: string, order: 'asc' | 'desc' = 'asc'): QueryBuilder<T> {
    return new QueryBuilder<T>(this).orderBy(key, order);
  }

  /**
   * Returns a QueryBuilder where `key` matches `value`.
   *
   * Example
   * ```
   * const posts = await BlogPost.where('status', 'published').get();
   * ```
   *
   * @param key
   * @param value
   */
  static where<T extends BaseModel>(this: ObjectType<T>, key: string, value: any): QueryBuilder<T> {
    return new QueryBuilder(this).where(key, value);
  }

  /**
   * Returns models where `key` is in the array of `values`.
   *
   * Example
   * ```
   * const comments = await Comment.whereIn('postId', [1, 2, 3]).get();
   * ```
   *
   * @param fieldName
   * @param values
   */
  static whereIn<T extends BaseModel>(this: ObjectType<T>, fieldName: string, values: any[]): QueryBuilder<T> {
    const queryBuilder = new QueryBuilder(this);

    return queryBuilder.whereIn(fieldName, values);
  }

  /**
   * Deletes the model from the database.
   *
   * Example
   * ```
   * await post.delete();
   * ```
   */
  async delete(): Promise<number> {
    const queryBuilder = new QueryBuilder(this.constructor as ObjectType<BaseModel>);

    return queryBuilder.where({
      _id: this.id
    }).limit(1).delete();
  }

  hasMany<T extends BaseModel>(ctor: ObjectType<T>, foreignKey?: string, localKey?: string): QueryBuilder<T> {
    const queryBuilder = new QueryBuilder(ctor);

    foreignKey = foreignKey || camelCase(`${ this.constructor.name }Id`)
    localKey = localKey || 'id';

    return queryBuilder.where(foreignKey, (this as any)[localKey]);
  }

  /**
   * Persists the current changes to the database.
   *
   * Example
   * ```
   * const post = new Post();
   *
   * post.title = 'My Second Blog Post!';
   *
   * await post.save();
   * ```
   */
  async save(): Promise<void> {
    const queryBuilder = new QueryBuilder(this.constructor as ObjectType<BaseModel>);

    if (this.id) {
      this.updatedAt = Date.now();
    } else {
      this.createdAt = Date.now();
    }

    const attributes = { ...this };

    const id = await queryBuilder.save(attributes);

    if (!this.id) {
      this.id = id;
    }
  }
}
