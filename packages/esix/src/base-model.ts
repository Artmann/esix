import 'reflect-metadata'

import QueryBuilder from './query-builder'
import type {
  ComparisonOperator,
  Dictionary,
  ObjectType,
  Paginated
} from './types'
import { camelCase } from 'change-case'

export default class BaseModel {
  public createdAt = 0
  public id = ''
  public updatedAt: number | null = null

  /**
   * True when this instance was inserted into the database by the current
   * process, either through `create()`, an inserting `save()`, or the create
   * path of `firstOrCreate()`. Models retrieved from the database always have
   * this set to `false`.
   *
   * This is runtime metadata and is never persisted to the database.
   */
  declare wasRecentlyCreated: boolean

  constructor() {
    Object.defineProperty(this, 'wasRecentlyCreated', {
      enumerable: false,
      value: false,
      writable: true
    })
  }

  /**
   * Direct access to Mongo's aggregation functions.
   *
   * Example
   * ```
   * const results = await User.aggregate([
   *   { $group: { _id: '$department', count: { $sum: 1 } } }
   * ]);
   * ```
   *
   * @param stages
   * @returns The result of the aggregations
   */
  static async aggregate<T extends BaseModel>(
    this: ObjectType<T>,
    stages: Record<string, unknown>[]
  ) {
    return new QueryBuilder(this).aggregate(stages)
  }

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
   * Returns the average of all the values for the given key.
   *
   * Example
   * ```
   * const avgAge = await User.average('age');
   * ```
   *
   * @param key
   */
  static async average<T extends BaseModel, K extends keyof T>(
    this: ObjectType<T>,
    key: K
  ): Promise<number> {
    return new QueryBuilder(this).average(key)
  }

  /**
   * Returns the number of documents for this model.
   *
   * Example
   * ```
   * const userCount = await User.count();
   * ```
   */
  static async count<T extends BaseModel>(
    this: ObjectType<T>
  ): Promise<number> {
    return new QueryBuilder(this).count()
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

    const attributesWithDefaults = {
      ...getDefaultValues(this),
      ...attributes
    }

    const id = await queryBuilder.create(attributesWithDefaults)
    const model = await queryBuilder.findOne({
      _id: id
    })

    if (!model) {
      throw new Error(
        `Failed to create ${this.name} (id: ${String(id)}). ` +
          `The document was inserted but could not be retrieved afterwards.`
      )
    }

    model.wasRecentlyCreated = true

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
   * Find a model matching the filter, or create a new one with the given attributes.
   * If attributes are not provided, the filter will be used as the attributes.
   *
   * The lookup and the insert happen in a single atomic `findOneAndUpdate`
   * operation. The returned model's `wasRecentlyCreated` property tells you
   * whether the model was created (`true`) or an existing one was found
   * (`false`). Note that guarding against duplicate inserts from concurrent
   * callers requires a unique index on the filter fields.
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
   *
   * if (flight.wasRecentlyCreated) {
   *   console.log('Created a new flight.');
   * }
   * ```
   *
   * @param filter - Object to search for existing model
   * @param attributes - Attributes to use when creating new model (optional, defaults to filter)
   * @returns The found or created model, with `wasRecentlyCreated` set accordingly
   */
  static async firstOrCreate<T extends BaseModel>(
    this: ObjectType<T>,
    filter: Partial<T>,
    attributes?: Partial<T>
  ): Promise<T> {
    const queryBuilder = new QueryBuilder(this)

    const { model } = await queryBuilder.firstOrCreate(filter, {
      ...getDefaultValues(this),
      ...filter,
      ...attributes
    })

    return model
  }

  /**
   * Returns the unique values of the given key across all documents in
   * this collection.
   *
   * Example
   * ```
   * const tags = await Post.distinct('tag');
   * ```
   *
   * @param key
   */
  static distinct<T extends BaseModel, K extends keyof T>(
    this: ObjectType<T>,
    key: K
  ): Promise<T[K][]> {
    return new QueryBuilder(this).distinct(key)
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
   * Returns the largest value for the given key.
   *
   * Example
   * ```
   * const maxScore = await Test.max('score');
   * ```
   *
   * @param key
   */
  static async max<T extends BaseModel, K extends keyof T>(
    this: ObjectType<T>,
    key: K
  ): Promise<number> {
    return new QueryBuilder(this).max(key)
  }

  /**
   * Returns the smallest value for the given key.
   *
   * Example
   * ```
   * const minAge = await User.min('age');
   * ```
   *
   * @param key
   */
  static async min<T extends BaseModel, K extends keyof T>(
    this: ObjectType<T>,
    key: K
  ): Promise<number> {
    return new QueryBuilder(this).min(key)
  }

  /**
   * Specifies the order the models are returned.
   *
   * Example
   * ```
   * const posts = await BlogPost.orderBy('publishedAt', 'desc').get();
   * ```
   *
   * @param key - A property of the model
   * @param order
   */
  static orderBy<T extends BaseModel, K extends keyof T>(
    this: ObjectType<T>,
    key: K,
    order: 'asc' | 'desc' = 'asc'
  ): QueryBuilder<T> {
    return new QueryBuilder<T>(this).orderBy(key, order)
  }

  /**
   * Returns a page of models along with the total count and metadata for
   * rendering pagination UIs.
   *
   * Example
   * ```
   * const { data, total, lastPage } = await Post.paginate(1, 20);
   * ```
   *
   * @param page The page to fetch, starting at 1.
   * @param perPage The number of models per page.
   */
  static paginate<T extends BaseModel>(
    this: ObjectType<T>,
    page: number,
    perPage: number
  ): Promise<Paginated<T>> {
    return new QueryBuilder(this).paginate(page, perPage)
  }

  /**
   * Returns the nth percentile of all the values for the given key.
   *
   * Example
   * ```
   * const median = await ResponseTime.percentile('value', 50);
   * const p95 = await ResponseTime.percentile('value', 95);
   * ```
   *
   * @param key
   * @param n
   */
  static async percentile<T extends BaseModel, K extends keyof T>(
    this: ObjectType<T>,
    key: K,
    n: number
  ): Promise<number> {
    return new QueryBuilder(this).percentile(key, n)
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
   * Returns the sum of all the values for the given key.
   *
   * Example
   * ```
   * const totalSales = await Order.sum('amount');
   * ```
   *
   * @param key
   */
  static async sum<T extends BaseModel, K extends keyof T>(
    this: ObjectType<T>,
    key: K
  ): Promise<number> {
    return new QueryBuilder(this).sum(key)
  }

  /**
   * Returns a QueryBuilder where `key` matches `value` or satisfies the comparison.
   *
   * Example
   * ```
   * const posts = await BlogPost.where('status', 'published').get();
   * const adults = await User.where('age', '>=', 18).get();
   * const youngUsers = await User.where('age', '<', 30).get();
   * ```
   *
   * @param key - A property of the model
   * @param operatorOrValue - Comparison operator or value when using 2-param syntax
   * @param value - The value when using 3-param syntax with operator
   */
  static where<T extends BaseModel, K extends keyof T>(
    this: ObjectType<T>,
    key: K,
    value: any
  ): QueryBuilder<T>
  static where<T extends BaseModel, K extends keyof T>(
    this: ObjectType<T>,
    key: K,
    operator: ComparisonOperator,
    value: any
  ): QueryBuilder<T>
  static where<T extends BaseModel, K extends keyof T>(
    this: ObjectType<T>,
    key: K,
    operatorOrValue: ComparisonOperator | any,
    value?: any
  ): QueryBuilder<T> {
    if (value !== undefined) {
      return new QueryBuilder(this).where(
        key,
        operatorOrValue as ComparisonOperator,
        value
      )
    }
    return new QueryBuilder(this).where(key, operatorOrValue)
  }

  /**
   * Returns models where `key` is in the array of `values`.
   *
   * Example
   * ```
   * const comments = await Comment.whereIn('postId', [1, 2, 3]).get();
   * ```
   *
   * @param key - A property of the model
   * @param values
   */
  static whereIn<T extends BaseModel, K extends keyof T>(
    this: ObjectType<T>,
    key: K,
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
   * @param key - A property of the model
   * @param values
   */
  static whereNotIn<T extends BaseModel, K extends keyof T>(
    this: ObjectType<T>,
    key: K,
    values: any[]
  ): QueryBuilder<T> {
    const queryBuilder = new QueryBuilder(this)

    return queryBuilder.whereNotIn(key, values)
  }

  /**
   * Returns the parent record this model belongs to. The foreign key
   * defaults to the camelCase of the parent class name suffixed with
   * `Id` (e.g. `Author` -> `authorId`); the owner key defaults to
   * `id`. Returns `null` when the foreign key is unset.
   */
  async belongsTo<T extends BaseModel>(
    ctor: ObjectType<T>,
    foreignKey?: string,
    ownerKey?: string
  ): Promise<T | null> {
    const fk = foreignKey || camelCase(`${ctor.name}Id`)
    const ok = ownerKey || 'id'

    const value = (this as unknown as Record<string, unknown>)[fk]

    if (value === undefined || value === null) {
      return null
    }

    const queryBuilder = new QueryBuilder(ctor)

    if (ok === 'id') {
      return queryBuilder.find(String(value))
    }

    return queryBuilder.where({ [ok]: value }).first()
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

    const fk = foreignKey || camelCase(`${this.constructor.name}Id`)
    const lk = localKey || 'id'

    return queryBuilder.where({ [fk]: (this as any)[lk] })
  }

  /**
   * Returns the single related record matching this model. Mirrors
   * `hasMany` but resolves to a single record (or `null`).
   */
  hasOne<T extends BaseModel>(
    ctor: ObjectType<T>,
    foreignKey?: string,
    localKey?: string
  ): Promise<T | null> {
    return this.hasMany(ctor, foreignKey, localKey).first()
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
      this.wasRecentlyCreated = true
    }

    const attributes = { ...this }

    const id = await queryBuilder.save(attributes)

    if (!this.id) {
      this.id = id
    }
  }
}

function getDefaultValues<T extends BaseModel>(
  ctor: ObjectType<T>
): Record<string, any> {
  const instance = new ctor()

  return Object.keys(instance).reduce((acc: Record<string, any>, key) => {
    acc[key] = instance[key as keyof T]

    return acc
  }, {})
}
