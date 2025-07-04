import 'reflect-metadata'

import QueryBuilder from './query-builder'
import type { ObjectType, Dictionary } from './types'
import { camelCase } from 'change-case'

export default class BaseModel {
  public createdAt = 0
  public id = ''
  public updatedAt: number | null = null

  /**
   * Returns all models.
   *
   * Example
   * ```
   * const posts = await BlogPost.all();
   * ```
   */
  static async all<T extends BaseModel>(this: ObjectType<T>): Promise<T[]> {
    return new QueryBuilder(this).where({}).get()
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
  static async create<T extends BaseModel>(
    this: ObjectType<T>,
    attributes: Partial<T>
  ): Promise<T> {
    const queryBuilder = new QueryBuilder(this)

    const instance = new this()
    const defaultValues = Object.getOwnPropertyNames(instance).reduce((acc: Record<string, any>, key) => {
      acc[key] = instance[key as keyof T]

      return acc
    }, {})

    const attributesWithDefaults = {
      ...defaultValues,
      ...attributes
    }

    const id = await queryBuilder.create(attributesWithDefaults)
    const model = await queryBuilder.findOne({
      _id: id
    })

    if (!model) {
      throw new Error('Failed to create model.')
    }

    return model
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
  static async find<T extends BaseModel>(
    this: ObjectType<T>,
    id: string
  ): Promise<T | null> {
    return new QueryBuilder(this).find(id)
  }

  /**
   * Returns the first model matching where the `key` matches `value`.
   *
   * Example
   * ```
   * const user = await User.findBy('email', 'john.smith@company.com');
   * ```
   *
   * @param key - A property of the model or '_id'
   * @param value
   */
  static async findBy<T extends BaseModel, K extends keyof T | '_id'>(
    this: ObjectType<T>,
    key: K,
    value: K extends keyof T ? T[K] : any
  ): Promise<T | null> {
    return new QueryBuilder(this).findOne({
      [key]: value
    })
  }

  /**
   * Limits the number of models returned.
   *
   * @param length
   */
  static limit<T extends BaseModel>(
    this: ObjectType<T>,
    length: number
  ): QueryBuilder<T> {
    return new QueryBuilder<T>(this).limit(length)
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
  static orderBy<T extends BaseModel>(
    this: ObjectType<T>,
    key: string,
    order: 'asc' | 'desc' = 'asc'
  ): QueryBuilder<T> {
    return new QueryBuilder<T>(this).orderBy(key, order)
  }

  /**
   * Returns an array of values for the given key.
   * 
   * Example
   * ```
   * const titles = await BlogPost.pluck('title');
   * ```
   * 
   * @param key
   */
  static pluck<T extends BaseModel, K extends keyof T>(
    this: ObjectType<T>,
    key: K
  ): Promise<T[K][]> {
    return new QueryBuilder(this).pluck(key)
  }

  /**
   * Skips {length} number of models.
   *
   * @param length
   */
  static skip<T extends BaseModel>(
    this: ObjectType<T>,
    length: number
  ): QueryBuilder<T> {
    return new QueryBuilder<T>(this).skip(length)
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
  static where<T extends BaseModel>(
    this: ObjectType<T>,
    key: string,
    value: any
  ): QueryBuilder<T> {
    return new QueryBuilder(this).where(key, value)
  }

  /**
   * Returns models where `key` is in the array of `values`.
   *
   * Example
   * ```
   * const comments = await Comment.whereIn('postId', [1, 2, 3]).get();
   * ```
   *
   * @param key
   * @param values
   */
  static whereIn<T extends BaseModel>(
    this: ObjectType<T>,
    key: string,
    values: any[]
  ): QueryBuilder<T> {
    const queryBuilder = new QueryBuilder(this)

    return queryBuilder.whereIn(key, values)
  }

  /**
   * Returns models where `key` is not in the array of `values`.
   *
   * Example
   * ```
   * const users = await User.whereNotIn('id', [1, 2, 3]).get();
   * ```
   *
   * @param key
   * @param values
   */
  static whereNotIn<T extends BaseModel>(
    this: ObjectType<T>,
    key: string,
    values: any[]
  ): QueryBuilder<T> {
    const queryBuilder = new QueryBuilder(this)

    return queryBuilder.whereNotIn(key, values)
  }

  /**
   * Find a model matching the filter, or create a new one with the given attributes.
   * If attributes are not provided, the filter will be used as the attributes.
   *
   * Example
   * ```
   * // Retrieve flight by name or create it if it doesn't exist...
   * const flight = await Flight.firstOrCreate({
   *   name: 'London to Paris'
   * });
   * 
   * // Retrieve flight by name or create it with the name, delayed, and arrival_time attributes...
   * const flight = await Flight.firstOrCreate(
   *   { name: 'London to Paris' },
   *   { delayed: 1, arrival_time: '11:30' }
   * );
   * ```
   *
   * @param filter - Object to search for existing model
   * @param attributes - Attributes to use when creating new model (optional, defaults to filter)
   */
  static async firstOrCreate<T extends BaseModel>(
    this: ObjectType<T>,
    filter: Partial<T>,
    attributes?: Partial<T>
  ): Promise<T> {
    const queryBuilder = new QueryBuilder(this)
    
    const existingModel = await queryBuilder.findOne(filter)
    
    if (existingModel) {
      return existingModel
    }
    
    return (this as any).create({ ...filter, ...attributes })
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
    const queryBuilder = new QueryBuilder(
      this.constructor as ObjectType<BaseModel>
    )

    return queryBuilder
      .where({
        _id: this.id
      })
      .limit(1)
      .delete()
  }

  hasMany<T extends BaseModel>(
    ctor: ObjectType<T>,
    foreignKey?: string,
    localKey?: string
  ): QueryBuilder<T> {
    const queryBuilder = new QueryBuilder(ctor)

    foreignKey = foreignKey || camelCase(`${this.constructor.name}Id`)
    localKey = localKey || 'id'

    return queryBuilder.where(foreignKey, (this as any)[localKey])
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
    const queryBuilder = new QueryBuilder(
      this.constructor as ObjectType<BaseModel>
    )

    if (this.id) {
      this.updatedAt = Date.now()
    } else {
      this.createdAt = Date.now()
    }

    const attributes = { ...this }

    const id = await queryBuilder.save(attributes)

    if (!this.id) {
      this.id = id
    }
  }
}
