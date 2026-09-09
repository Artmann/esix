import { BSON, Collection, ObjectId } from 'mongodb'
import percentile from 'percentile'

import type BaseModel from './base-model'
import { rememberIdentity } from './model-identity'
import { connectionHandler } from './connection-handler'
import { bindConnection, type QueryConnection } from './model-connection'
import { resolveCollectionName } from './naming'
import { resolveQueryLogger, withQueryLogging } from './query-logger'
import { sanitize } from './sanitize'
import { env } from './env'
import type {
  ComparisonOperator,
  Dictionary,
  Document,
  ObjectType,
  NumericKey,
  Paginated,
  QueryValue
} from './types'

/**
 * Represents a MongoDB query object with flexible field-value pairs.
 * Used for building database queries with various operators and conditions.
 */
export type Query = { [index: string]: unknown }

type Order = { [index: string]: 1 | -1 }
type Fields = { [index: string]: 0 | 1 }

function isString(x: any): x is string {
  return typeof x === 'string'
}

function normalizeAttributes(originalAttributes: Dictionary): Dictionary {
  const attributes = { ...originalAttributes }

  delete attributes.wasRecentlyCreated

  if (!attributes.id) {
    attributes.id = new ObjectId().toHexString()
  }

  if (attributes.hasOwnProperty('id')) {
    attributes._id = attributes.id
    delete attributes.id
  }

  if (!attributes['createdAt']) {
    attributes.createdAt = Date.now()
  }

  if (!attributes['updatedAt']) {
    attributes.updatedAt = null
  }

  return attributes
}

export default class QueryBuilder<T extends BaseModel> {
  private readonly ctor: ObjectType<T>

  private orQueries: Query[] = []
  private query: Query = {}

  private queryLimit?: number
  private queryOffset?: number
  private queryOrder?: Order

  constructor(
    ctor: ObjectType<T>,
    private readonly connection: QueryConnection = connectionHandler
  ) {
    this.ctor = ctor
  }

  /** Associates instance operations with this query's database. */
  bindModel(model: T): T {
    return bindConnection(model, this.connection)
  }

  private get adapter(): string {
    return this.connection.adapter ?? env('DB_ADAPTER', 'default').toLowerCase()
  }

  /**
   * Direct access to Mongo's aggregation functions.
   *
   * @param stages
   * @returns The result of the aggregations
   */
  async aggregate(stages: Record<string, unknown>[]): Promise<Document[]> {
    return this.useCollection(async (collection) => {
      const cursor = await collection.aggregate(stages)

      return cursor.toArray()
    })
  }

  /**
   * Returns the average of all the values for the given key.
   *
   * @param key
   */
  async average<K extends keyof T>(key: K): Promise<number> {
    if (this.adapter !== 'mock') {
      return this.numericAggregate(key, 'avg')
    }
    const values = await this.pluck(key)

    if (values.length === 0) {
      return 0
    }

    if (!isNumberArray(values)) {
      throw new Error(
        `All values returned for ${String(key)} are not numbers. Please check your data.`
      )
    }

    const sum = values.reduce((sum, value) => sum + (value as number), 0)

    return sum / values.length
  }

  /**
   * Processes all models matching the current query in batches of `size`.
   *
   * Batches are fetched with keyset pagination on `_id` in ascending order,
   * so it is safe to update or delete the models handed to the callback
   * while iterating. Any `orderBy()`, `limit()`, or `skip()` set on the
   * builder is ignored: resumable keyset pagination requires a unique total
   * order, so iteration is always by id ascending.
   *
   * The collection's `_id`s must all be the same BSON type (esix itself
   * always creates string ids); mixed-type collections will only iterate
   * the first type bracket.
   *
   * Return `false` from the callback to stop processing early.
   *
   * Example
   * ```
   * await Post.where('published', false).chunk(500, async (posts, page) => {
   *   for (const post of posts) {
   *     post.published = true;
   *
   *     await post.save();
   *   }
   * });
   * ```
   *
   * @param size The number of models per batch.
   * @param callback Called with each batch of models and the page number,
   *   starting at 1.
   * @returns `false` if the callback stopped the iteration early, `true`
   *   otherwise.
   */
  async chunk(
    size: number,
    callback: (models: T[], page: number) => unknown
  ): Promise<boolean> {
    if (!Number.isInteger(size) || size < 1) {
      throw new Error(`chunk() size must be an integer >= 1, received: ${size}`)
    }

    let lastId: unknown = undefined
    let page = 1

    while (true) {
      const documents = await this.fetchBatch(lastId, size)

      if (documents.length === 0) {
        break
      }

      lastId = documents[documents.length - 1]._id

      const models = documents.map(
        (document): T => this.createInstance(document)
      )

      const result = await callback(models, page)

      if (result === false) {
        return false
      }

      if (documents.length < size) {
        break
      }

      page += 1
    }

    return true
  }

  /**
   * Returns the number of documents matching the given query.
   *
   * Example
   *
   * ```
   * const numberOfPayingCustomers = await Customer.where('hasPaidTheLastInvoice', true).count();
   * ```
   */
  async count(): Promise<number> {
    const query = this.buildQuery()

    const count = await this.useCollection<number>(
      (collection): Promise<number> => {
        return collection.count(query)
      }
    )

    return count
  }

  /**
   * Creates a new document with the given attributes.
   *
   * @internal
   */
  async create(attributes: Record<string, any>): Promise<string> {
    const normalizedAttributes = normalizeAttributes(attributes)

    return this.useCollection(async (collection) => {
      const { insertedId } = await collection.insertOne(normalizedAttributes)

      return insertedId
    })
  }

  /** @internal Inserts and hydrates the exact BSON snapshot without a second query. */
  async createModel(attributes: Dictionary): Promise<T> {
    const snapshot = BSON.serialize(normalizeAttributes(attributes))
    // The real server accepts BSON wrappers; mongo-mock compares JS primitives.
    const document = BSON.deserialize(snapshot, {
      promoteValues: this.adapter === 'mock'
    })
    return this.useCollection(async (collection) => {
      await collection.insertOne(document)
      const model = this.createInstance<T>(BSON.deserialize(snapshot))
      model.wasRecentlyCreated = true
      return model
    })
  }

  /**
   * Returns an async iterator over all models matching the current query,
   * fetching documents in batches of `batchSize` behind the scenes.
   *
   * Batches are fetched with keyset pagination on `_id` in ascending order,
   * so it is safe to update or delete models while iterating. Any
   * `orderBy()`, `limit()`, or `skip()` set on the builder is ignored:
   * resumable keyset pagination requires a unique total order, so iteration
   * is always by id ascending.
   *
   * The collection's `_id`s must all be the same BSON type (esix itself
   * always creates string ids); mixed-type collections will only iterate
   * the first type bracket.
   *
   * Example
   * ```
   * for await (const post of Post.where('published', true).cursor()) {
   *   console.log(post.title);
   * }
   * ```
   *
   * @param batchSize The number of documents fetched per batch.
   */
  cursor(batchSize = 1000): AsyncGenerator<T, void, undefined> {
    if (!Number.isInteger(batchSize) || batchSize < 1) {
      throw new Error(
        `cursor() batchSize must be an integer >= 1, received: ${batchSize}`
      )
    }

    return this.iterate(batchSize)
  }

  /**
   * Makes the QueryBuilder itself async iterable, so it can be used
   * directly in a `for await` loop. Equivalent to iterating `cursor()`.
   *
   * Example
   * ```
   * for await (const post of Post.where('published', true)) {
   *   console.log(post.title);
   * }
   * ```
   */
  [Symbol.asyncIterator](): AsyncIterator<T> {
    return this.cursor()
  }

  /**
   * Deletes the Models matching the current query options.
   *
   * @returns Returns the number of models deleted.
   */
  async delete(): Promise<number> {
    if (!this.queryLimit && !this.queryOffset) {
      return this.useCollection(
        async (collection) =>
          (await collection.deleteMany(this.buildQuery())).deletedCount
      )
    }
    const documents = await this.readDocuments({ _id: 1 })
    return this.useCollection(async (collection) => {
      if (documents.length === 1) {
        return (await collection.deleteOne({ _id: documents[0]._id }))
          .deletedCount
      }
      let deleted = 0
      for (let offset = 0; offset < documents.length; offset += 1000) {
        const ids = documents
          .slice(offset, offset + 1000)
          .map((document) => document._id)
        deleted += (await collection.deleteMany({ _id: { $in: ids } }))
          .deletedCount
      }
      return deleted
    })
  }

  /**
   * Decrements the given numeric key by `by` for every document matching
   * the current query. Translates to MongoDB's `$inc` operator.
   * Sort, skip and limit do not restrict this bulk update. Timestamps are
   * unchanged, and the amount must be finite.
   *
   * Example
   * ```
   * await Account.where('id', accountId).decrement('balance', 25);
   * ```
   *
   * @returns The number of documents that were modified.
   */
  async decrement<K extends NumericKey<T>>(
    key: K,
    by: number = 1
  ): Promise<number> {
    return this.increment(key, -by)
  }

  /**
   * Returns the unique values of the given key for documents matching the
   * current query.
   *
   * Example
   * ```
   * const tags = await Post.where('published', true).distinct('tag');
   * ```
   *
   * @param key
   */
  async distinct<K extends keyof T>(key: K): Promise<T[K][]> {
    const query = this.buildQuery()
    const field = key === 'id' ? '_id' : String(key)
    if (this.adapter !== 'mock') {
      const documents = await this.aggregate([
        { $match: andQueries(query, { [field]: { $ne: null } }) },
        { $group: { _id: `$${field}` } }
      ])
      return documents.map((document) =>
        key === 'id' && typeof document._id !== 'string'
          ? document._id.toHexString()
          : document._id
      )
    }
    return this.useCollection(async (collection) => {
      const keyStr = (key as string) === 'id' ? '_id' : (key as string)
      const documents = await collection
        .find(query, { projection: { [keyStr]: 1 } })
        .toArray()

      const seen = new Set<unknown>()
      const result: T[K][] = []

      for (const document of documents) {
        const value = (document as Record<string, unknown>)[keyStr]
        if (value === null || value === undefined) {
          continue
        }
        const dedupeKey = BSON.EJSON.stringify(value, { relaxed: false })
        if (seen.has(dedupeKey)) {
          continue
        }
        seen.add(dedupeKey)
        result.push(value as T[K])
      }

      return result
    })
  }

  /**
   * Returns the model with the given id or null if there is no matching model.
   */
  async find(id: string): Promise<T | null> {
    return this.useCollection(async (collection) => {
      let objectId: ObjectId | undefined

      try {
        objectId = ObjectId.createFromHexString(id)
      } catch (error) {}

      const query = objectId
        ? {
            $or: [{ _id: objectId }, { _id: sanitize(id) }]
          }
        : { _id: sanitize(id) }

      const document = await collection.findOne(
        andQueries(this.buildQuery(), query) as any
      )

      if (!document) {
        return null
      }

      return this.createInstance(document)
    })
  }

  /**
   * Returns the first model matching the query options.
   *
   * @internal
   */
  async findOne(query: Query): Promise<T | null> {
    return this.useCollection(async (collection) => {
      const document = await collection.findOne(this.buildConditionQuery(query))

      if (!document) {
        return null
      }

      return this.createInstance(document)
    })
  }

  /**
   * Returns the first model matching the query options.
   */
  async first(): Promise<T | null> {
    const models = await this.copy().limit(1).execute()

    if (models.length === 0) {
      return null
    }

    return models[0]
  }

  /**
   * Atomically returns the first document matching the filter, or inserts a
   * new document with the given attributes using a single upsert. The
   * returned model has `wasRecentlyCreated` set to whether it was created.
   *
   * @param filter
   * @param attributes
   * @internal
   */
  async firstOrCreate(
    filter: Query,
    attributes: Record<string, any>
  ): Promise<{ created: boolean; model: T }> {
    const sanitized = sanitize(filter) as Query
    const sanitizedFilter: Query = {}

    for (const [key, value] of Object.entries(sanitized)) {
      // MongoDB copies filter equality fields into upsert-inserted
      // documents, and wasRecentlyCreated must never be persisted.
      if (key === 'wasRecentlyCreated') {
        continue
      }

      sanitizedFilter[key === 'id' ? '_id' : key] = value
    }

    const insertAttributes = normalizeAttributes(sanitize(attributes))

    return this.useCollection(async (collection) => {
      let created: boolean
      let document: Document | null

      try {
        const result = await collection.findOneAndUpdate(
          sanitizedFilter,
          { $setOnInsert: insertAttributes },
          {
            includeResultMetadata: true,
            returnDocument: 'after',
            upsert: true
          }
        )

        created = !result?.lastErrorObject?.updatedExisting
        document = result?.value ?? null
      } catch (error) {
        // Two concurrent upserts on a unique index can race; one of them
        // fails with a duplicate key error. Fall back to reading the
        // document the other writer inserted.
        if (!isDuplicateKeyError(error)) {
          throw error
        }

        created = false
        document = await collection.findOne(sanitizedFilter)

        if (!document) {
          throw error
        }
      }

      if (!document) {
        throw new Error(
          `Failed to create ${this.ctor.name} (id: ${String(insertAttributes._id)}). ` +
            `The document was upserted but could not be retrieved afterwards.`
        )
      }

      const model = this.createInstance<T>(document)

      model.wasRecentlyCreated = created

      return { created, model }
    })
  }

  /**
   * Returns an array of models matching the query options.
   */
  async get(): Promise<T[]> {
    return this.execute()
  }

  /**
   * Increments the given numeric key by `by` for every document matching
   * the current query. Translates to MongoDB's `$inc` operator.
   * Sort, skip and limit do not restrict this bulk update. Timestamps are
   * unchanged, and the amount must be finite.
   *
   * Example
   * ```
   * await Post.where('id', postId).increment('views');
   * await User.where('isActive', true).increment('score', 5);
   * ```
   *
   * @returns The number of documents that were modified.
   */
  async increment<K extends NumericKey<T>>(
    key: K,
    by: number = 1
  ): Promise<number> {
    if (!Number.isFinite(by))
      throw new TypeError('increment() amount must be finite.')
    const query = this.buildQuery()

    return this.useCollection(async (collection) => {
      const { modifiedCount } = await collection.updateMany(query as any, {
        $inc: { [key as string]: by }
      })
      return modifiedCount
    })
  }

  /**
   * Limits the number of models returned.
   *
   * @param length
   */
  limit(length: number): QueryBuilder<T> {
    this.queryLimit = length

    return this
  }

  /**
   * Returns the largest value for the given key.
   *
   * @param key
   */
  async max<K extends keyof T>(key: K): Promise<number> {
    if (this.adapter !== 'mock') {
      return this.numericAggregate(key, 'max')
    }
    const values = await this.pluck(key)

    if (values.length === 0) {
      return 0
    }

    if (!isNumberArray(values)) {
      throw new Error(
        `All values returned for ${String(key)} are not numbers. Please check your data.`
      )
    }

    return (values as number[]).reduce(
      (maximum, value) => Math.max(maximum, value),
      -Infinity
    )
  }

  /**
   * Returns the smallest value for the given key.
   *
   * @param key
   */
  async min<K extends keyof T>(key: K): Promise<number> {
    if (this.adapter !== 'mock') {
      return this.numericAggregate(key, 'min')
    }
    const values = await this.pluck(key)

    if (values.length === 0) {
      return 0
    }

    if (!isNumberArray(values)) {
      throw new Error(
        `All values returned for ${String(key)} are not numbers. Please check your data.`
      )
    }

    return (values as number[]).reduce(
      (minimum, value) => Math.min(minimum, value),
      Infinity
    )
  }

  /**
   * Sorts the models by the given key.
   *
   * @param key - A property of the model to sort by.
   * @param order Defaults to ascending order.
   */
  orderBy<K extends keyof T>(key: K, order?: 'asc' | 'desc'): QueryBuilder<T>
  orderBy(key: string, order: 'asc' | 'desc' = 'asc'): QueryBuilder<T> {
    if (!this.queryOrder) {
      this.queryOrder = {}
    }

    this.queryOrder[key === 'id' ? '_id' : key] = order === 'asc' ? 1 : -1

    return this
  }

  /**
   * Adds a constraint that is combined with the previous constraints using
   * a logical OR. Mirrors `where`'s call forms; values are typed against
   * the model's properties.
   *
   * Subsequent `where` calls are ANDed into the most recent OR group, so
   * AND binds tighter than OR: `where(a).orWhere(b).where(c)` selects
   * documents matching `a OR (b AND c)`.
   *
   * When called without any previous constraints, `orWhere` behaves exactly
   * like `where`. Conditions that are empty after sanitization (for example
   * `{ $where: ... }`, which is stripped to `{}`) are ignored rather than
   * added as an OR branch, matching the no-op semantics of `where({})`.
   * There is no static `orWhere` on `BaseModel` since an OR condition is
   * meaningless without a preceding constraint — start the chain with
   * `where`, `whereNull`, or one of the other query methods.
   *
   * Note: `orWhere` cannot be combined with `search()`.
   *
   * Example
   * ```
   * const books = await Book.whereNull('openLibraryEnrichedVersion')
   *   .orWhere('openLibraryEnrichedVersion', '<', 3)
   *   .get();
   * ```
   *
   * @param query - A query object to filter by
   * @param key - Property name to filter by (must be a valid model field)
   * @param operatorOrValue - Comparison operator or value when using 2-param syntax
   * @param value - The value to filter by, type-checked against the model's
   *   property type. Array fields also accept their element type.
   */
  orWhere(query: Query): QueryBuilder<T>
  orWhere<K extends keyof T>(key: K, value: QueryValue<T[K]>): QueryBuilder<T>
  orWhere<K extends keyof T>(
    key: K,
    operator: ComparisonOperator,
    value: QueryValue<T[K]>
  ): QueryBuilder<T>
  orWhere(
    queryOrKey: Query | string,
    operatorOrValue?: ComparisonOperator | any,
    value?: any
  ): QueryBuilder<T> {
    const condition = this.buildConditionQuery(
      queryOrKey,
      operatorOrValue,
      value
    )

    if (Object.keys(condition).length === 0) {
      return this
    }

    if (Object.keys(this.query).length === 0 && this.orQueries.length === 0) {
      this.query = condition

      return this
    }

    this.orQueries.push(condition)

    return this
  }

  /**
   * Returns the page of models matching the current query along with the
   * total count and the metadata needed to render pagination UIs.
   *
   * Example
   * ```
   * const { data, total, lastPage } = await Post.paginate(1, 20);
   * ```
   *
   * @param page The page to fetch, starting at 1.
   * @param perPage The number of models per page.
   */
  async paginate(page: number, perPage: number): Promise<Paginated<T>> {
    if (!Number.isInteger(page) || page < 1) {
      throw new Error(
        `paginate() page must be an integer >= 1, received: ${page}`
      )
    }
    if (!Number.isInteger(perPage) || perPage < 1) {
      throw new Error(
        `paginate() perPage must be an integer >= 1, received: ${perPage}`
      )
    }

    const query = this.copy()
      .skip((page - 1) * perPage)
      .limit(perPage)
    const [total, data] = await Promise.all([query.count(), query.execute()])
    const lastPage = total === 0 ? 1 : Math.ceil(total / perPage)

    return { data, total, page, perPage, lastPage }
  }

  /**
   * Returns the nth percentile of all the values for the given key.
   *
   * @param key
   * @param n
   */
  async percentile<K extends keyof T>(key: K, n: number): Promise<number> {
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 100) {
      throw new Error(
        `Percentile n must be a finite number between 0 and 100, received: ${n}`
      )
    }

    const values = await this.pluck(key)

    if (values.length === 0) {
      return 0
    }

    if (!isNumberArray(values)) {
      throw new Error(
        `All values returned for ${String(key)} are not numbers. Please check your data.`
      )
    }

    const p = percentile(n, values as number[])

    return typeof p === 'number' ? p : p[0]
  }

  /**
   * Retrieves stored values for a key without constructing models. Missing
   * fields yield undefined; class defaults are not substituted.
   *
   * You may also specify how you wish the resulting collection to be keyed.
   *
   * Example
   * ```
   * await Posts.where('categoryId', 2).pluck('id');
   * // => [ '1', '2', '3' ]
   */
  async pluck<K extends keyof T>(key: K): Promise<T[K][]> {
    const field = key === 'id' ? '_id' : String(key)
    const documents = await this.readDocuments(
      field === '_id' ? { _id: 1 } : { [field]: 1, _id: 0 }
    )
    return documents.map((document) => {
      const value = document[field]
      return key === 'id' && typeof value !== 'string'
        ? value.toHexString()
        : value
    })
  }

  /**
   * Persist the provided attributes.
   *
   * @param attributes
   * @internal
   */
  async save(attributes: Dictionary): Promise<string> {
    return (await this.persist(attributes)).id
  }

  /** @internal Persists a model while retaining its original BSON identity. */
  async persist(
    attributes: Dictionary,
    rawId?: string | ObjectId
  ): Promise<{
    id: string
    created: boolean
    createdAt: number
    updatedAt: number | null
  }> {
    attributes = normalizeAttributes(sanitize(attributes))
    if (rawId) attributes._id = rawId
    const id = attributes._id
    return this.useCollection(async (collection) => {
      const result = await collection.updateOne(
        { _id: id },
        { $set: attributes },
        { upsert: true }
      )
      return {
        id: typeof id === 'string' ? id : id.toHexString(),
        created: (result?.upsertedCount ?? 0) > 0,
        createdAt: attributes.createdAt,
        updatedAt: attributes.updatedAt
      }
    })
  }

  /**
   * Searches the collection's text index for the given query.
   * https://www.mongodb.com/docs/manual/core/indexes/index-types/index-text/
   *
   * @param query
   * @param caseSensitive
   * @returns
   */
  search(query: string, caseSensitive = false): QueryBuilder<T> {
    this.query = {
      ...this.query,
      ...{
        $text: {
          $search: query,
          $caseSensitive: caseSensitive
        }
      }
    }

    return this
  }

  /**
   * Skips the first `length` models. Useful for pagination.
   *
   * @param length
   */
  skip(length: number): QueryBuilder<T> {
    this.queryOffset = length

    return this
  }

  /**
   * Returns the sum of all the values for the given key.
   *
   * @param key
   */
  async sum<K extends keyof T>(key: K): Promise<number> {
    if (this.adapter !== 'mock') {
      return this.numericAggregate(key, 'sum')
    }
    const values = await this.pluck(key)

    if (!isNumberArray(values)) {
      throw new Error(
        `All values returned for ${String(key)} are not numbers. Please check your data.`
      )
    }

    return values.reduce((sum, value) => sum + (value as number), 0)
  }

  /**
   * Adds a constraint to the current query.
   *
   * @param query - A query object to filter by
   * @param key - Property name to filter by (must be a valid model field)
   * @param operatorOrValue - Comparison operator or value when using 2-param syntax
   * @param value - The value to filter by, type-checked against the model's
   *   property type. Array fields also accept their element type.
   */
  where(query: Query): QueryBuilder<T>
  where<K extends keyof T>(key: K, value: QueryValue<T[K]>): QueryBuilder<T>
  where<K extends keyof T>(
    key: K,
    operator: ComparisonOperator,
    value: QueryValue<T[K]>
  ): QueryBuilder<T>
  where(
    queryOrKey: Query | string,
    operatorOrValue?: ComparisonOperator | any,
    value?: any
  ): QueryBuilder<T> {
    const condition = this.buildConditionQuery(
      queryOrKey,
      operatorOrValue,
      value
    )

    this.mergeCondition(condition)

    return this
  }

  /**
   * Builds a MongoDB query object for a given comparison operator.
   *
   * @param operator - The comparison operator
   * @param value - The value to compare against
   * @returns MongoDB query object or raw value
   */
  private buildOperatorQuery(
    operator: ComparisonOperator,
    value: any
  ): any | Query {
    switch (operator) {
      case '=':
        return value
      case '!=':
      case '<>':
        return { $ne: value }
      case '>':
        return { $gt: value }
      case '>=':
        return { $gte: value }
      case '<':
        return { $lt: value }
      case '<=':
        return { $lte: value }
      default:
        return value
    }
  }

  /**
   * Returns all the models with `key` in the array of `values`.
   *
   * @param key - A property of the model
   * @param values - The values to match, type-checked against the model's
   *   property type. Array fields also accept their element type.
   */
  whereIn<K extends keyof T>(
    key: K,
    values: QueryValue<T[K]>[]
  ): QueryBuilder<T>
  whereIn(key: string, values: any[]): QueryBuilder<T> {
    const keyStr = key === 'id' ? '_id' : key

    this.mergeCondition({
      [keyStr]: {
        $in: sanitize(values)
      }
    })

    return this
  }

  /**
   * Returns all the models with `key` not in the array of `values`.
   *
   * @param key - A property of the model
   * @param values - The values to exclude, type-checked against the model's
   *   property type. Array fields also accept their element type.
   */
  whereNotIn<K extends keyof T>(
    key: K,
    values: QueryValue<T[K]>[]
  ): QueryBuilder<T>
  whereNotIn(key: string, values: any[]): QueryBuilder<T> {
    const keyStr = key === 'id' ? '_id' : key

    this.mergeCondition({
      [keyStr]: {
        $nin: sanitize(values)
      }
    })

    return this
  }

  /**
   * Returns all the models where `key` is present and not `null`.
   * Translates to MongoDB's `$ne` operator, so documents where the field
   * is `null` or missing entirely are excluded.
   *
   * Example
   * ```
   * const enrichedBooks = await Book.whereNotNull('openLibraryEnrichedVersion').get();
   * ```
   *
   * @param key - A property of the model
   */
  whereNotNull<K extends keyof T>(key: K): QueryBuilder<T> {
    const keyStr = (key as string) === 'id' ? '_id' : (key as string)

    this.mergeCondition({
      [keyStr]: {
        $ne: null
      }
    })

    return this
  }

  /**
   * Returns all the models where `key` is `null`. Following MongoDB's
   * null-equality semantics, this matches documents where the field is
   * `null` OR missing entirely.
   *
   * Example
   * ```
   * const unenrichedBooks = await Book.whereNull('openLibraryEnrichedVersion').get();
   * ```
   *
   * @param key - A property of the model
   */
  whereNull<K extends keyof T>(key: K): QueryBuilder<T> {
    const keyStr = (key as string) === 'id' ? '_id' : (key as string)

    this.mergeCondition({
      [keyStr]: null
    })

    return this
  }

  /**
   * Builds a single condition object from the arguments accepted by
   * `where` and `orWhere`, remapping `id` to `_id` and sanitizing values.
   *
   * @param queryOrKey - A query object or a property name
   * @param operatorOrValue - Comparison operator or value when using 2-param syntax
   * @param value - The value to filter by when using 3-param syntax with operator
   */
  private buildConditionQuery(
    queryOrKey: Query | string,
    operatorOrValue?: ComparisonOperator | any,
    value?: any
  ): Query {
    let query: Query

    if (isString(queryOrKey)) {
      const keyStr = queryOrKey === 'id' ? '_id' : queryOrKey

      // Three-parameter syntax: where('age', '>', 18)
      if (value !== undefined) {
        const operator = operatorOrValue as ComparisonOperator
        const sanitizedValue = sanitize(value)
        query = { [keyStr]: this.buildOperatorQuery(operator, sanitizedValue) }
      }
      // Two-parameter syntax: where('status', 'active')
      else {
        query = { [keyStr]: sanitize(operatorOrValue) }
      }
    }
    // Object syntax: where({ status: 'active' })
    else {
      const sanitized = sanitize(queryOrKey) as Query
      query = {}
      for (const [k, v] of Object.entries(sanitized)) {
        query[k === 'id' ? '_id' : k] = v
      }
    }

    return query
  }

  /**
   * Builds the final query object, combining the base query with any OR
   * groups added through `orWhere`.
   */
  private buildQuery(): Query {
    if (this.orQueries.length === 0) {
      return this.query
    }

    if ('$text' in this.query) {
      throw new Error('search() cannot be combined with orWhere().')
    }

    return { $or: [this.query, ...this.orQueries] }
  }

  private createInstance<T>(document: Document): T {
    const instance = new this.ctor() as any

    for (const prop in document) {
      if (prop === '_id') {
        continue
      }

      instance[prop] = document[prop]
    }

    const id = isString(document._id)
      ? document._id
      : (document._id as ObjectId).toHexString()

    instance.id = id
    rememberIdentity(instance, document._id)
    instance.wasRecentlyCreated = false

    bindConnection(instance, this.connection)
    return instance
  }

  private copy(): QueryBuilder<T> {
    const copy = new QueryBuilder(this.ctor, this.connection)
    copy.query = this.query
    copy.orQueries = [...this.orQueries]
    copy.queryOrder = this.queryOrder && { ...this.queryOrder }
    copy.queryOffset = this.queryOffset
    copy.queryLimit = this.queryLimit
    return copy
  }

  private async execute(): Promise<T[]> {
    return (await this.readDocuments()).map((document) =>
      this.createInstance<T>(document)
    )
  }

  private readDocuments(fields?: Fields): Promise<Document[]> {
    const query = this.buildQuery()
    const order = this.queryOrder && { ...this.queryOrder }
    const offset = this.queryOffset
    const limit = this.queryLimit

    return this.useCollection(async (collection) => {
      try {
        let cursor = fields
          ? collection.find(query, { projection: fields })
          : collection.find(query)

        if (order) {
          cursor = cursor.sort(order)
        }

        if (offset) {
          cursor = cursor.skip(offset)
        }

        if (limit) {
          cursor = cursor.limit(limit)
        }

        const documents = await cursor.toArray()

        return documents.filter((document) => document)
      } catch (error) {
        if (isTextIndexMissingError(error, query)) {
          throw new Error(
            `search() requires a text index on the "${collection.collectionName}" collection. ` +
              `Create one with db["${collection.collectionName}"].createIndex({ "<field>": "text" }).`,
            { cause: error }
          )
        }
        throw error
      }
    })
  }

  /**
   * Fetches the next batch of raw documents for keyset pagination. The
   * batch is sorted by `_id` ascending and, when `lastId` is set, only
   * contains documents with an id greater than `lastId`. The base query,
   * including any OR groups added through `orWhere`, is combined with the
   * id constraint using `$and` so existing `_id` conditions (e.g. from
   * `whereIn('id', ...)`) are preserved.
   */
  private async fetchBatch(lastId: unknown, size: number): Promise<Document[]> {
    const baseQuery = this.buildQuery()

    return this.useCollection(async (collection) => {
      let query: Query

      if (lastId === undefined) {
        query = baseQuery
      } else if (Object.keys(baseQuery).length > 0) {
        query = { $and: [baseQuery, { _id: { $gt: lastId } }] }
      } else {
        query = { _id: { $gt: lastId } }
      }

      try {
        const documents = await collection
          .find(query)
          .sort({ _id: 1 })
          .limit(size)
          .toArray()

        return documents.filter((document) => document)
      } catch (error) {
        if (isTextIndexMissingError(error, baseQuery)) {
          throw new Error(
            `search() requires a text index on the "${collection.collectionName}" collection. ` +
              `Create one with db["${collection.collectionName}"].createIndex({ "<field>": "text" }).`,
            { cause: error }
          )
        }
        throw error
      }
    })
  }

  /**
   * Yields models matching the current query one at a time, fetching the
   * underlying documents in batches of `batchSize` via keyset pagination.
   */
  private async *iterate(
    batchSize: number
  ): AsyncGenerator<T, void, undefined> {
    let lastId: unknown = undefined

    while (true) {
      const documents = await this.fetchBatch(lastId, batchSize)

      if (documents.length === 0) {
        return
      }

      lastId = documents[documents.length - 1]._id

      for (const document of documents) {
        yield this.createInstance(document)
      }

      if (documents.length < batchSize) {
        return
      }
    }
  }

  /**
   * Merges a condition into the current query group. Conditions are ANDed
   * into the most recent OR group when one exists, so AND binds tighter
   * than OR.
   *
   * @param condition
   */
  private mergeCondition(condition: Query): void {
    if (this.orQueries.length > 0) {
      const lastIndex = this.orQueries.length - 1

      this.orQueries[lastIndex] = andQueries(
        this.orQueries[lastIndex],
        condition
      )

      return
    }

    this.query = andQueries(this.query, condition)
  }

  private async numericAggregate(
    key: keyof T,
    operator: 'sum' | 'avg' | 'min' | 'max'
  ): Promise<number> {
    const field = key === 'id' ? '_id' : String(key)
    const stages: Record<string, unknown>[] = [{ $match: this.buildQuery() }]
    if (this.queryOrder) stages.push({ $sort: this.queryOrder })
    if (this.queryOffset) stages.push({ $skip: this.queryOffset })
    if (this.queryLimit) stages.push({ $limit: Math.abs(this.queryLimit) })
    stages.push({
      $group: {
        _id: null,
        value: { [`$${operator}`]: `$${field}` },
        invalid: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: [{ $type: `$${field}` }, ['int', 'long', 'double']] },
                  { $gte: [`$${field}`, -Number.MAX_VALUE] },
                  { $lte: [`$${field}`, Number.MAX_VALUE] },
                  {
                    $or: [
                      { $ne: [{ $type: `$${field}` }, 'long'] },
                      {
                        $and: [
                          { $gte: [`$${field}`, -(2 ** 53)] },
                          { $lte: [`$${field}`, 2 ** 53] }
                        ]
                      }
                    ]
                  }
                ]
              },
              0,
              1
            ]
          }
        }
      }
    })
    const [result] = await this.aggregate(stages)
    const value = BSON.Long.isLong(result?.value)
      ? result.value.toNumber()
      : (result?.value ?? 0)
    if (result?.invalid || !Number.isFinite(value))
      throw new Error(
        `All values returned for ${String(key)} are not numbers. Please check your data.`
      )
    return value
  }

  private async useCollection<K>(
    block: (collection: Collection) => Promise<any>
  ): Promise<K> {
    const collectionName = resolveCollectionName(this.ctor)

    const connection = await this.connection.getConnection()

    const collection = await connection.collection(collectionName)

    const logger = resolveQueryLogger()

    const result = await block(
      logger ? withQueryLogging(collection, collectionName, logger) : collection
    )

    return result
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  return 'code' in error && (error as { code?: unknown }).code === 11000
}

function isNumberArray(array: any[]): array is number[] {
  return array.every(
    (item) => typeof item === 'number' && Number.isFinite(item)
  )
}

export function isTextIndexMissingError(
  error: unknown,
  query: { [key: string]: unknown }
): boolean {
  if (!('$text' in query)) {
    return false
  }

  const code =
    error && typeof error === 'object' && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined
  const codeName =
    error && typeof error === 'object' && 'codeName' in error
      ? (error as { codeName?: unknown }).codeName
      : undefined

  if (code === 27 || codeName === 'IndexNotFound') {
    return true
  }

  const message = error instanceof Error ? error.message : String(error ?? '')

  return /text index required for \$text query/i.test(message)
}

function andQueries(left: Query, right: Query): Query {
  if (Object.keys(left).length === 0) return right
  if (Object.keys(right).length === 0) return left
  if (Object.keys(right).every((key) => !(key in left))) {
    return { ...left, ...right }
  }
  return { $and: [left, right] }
}
