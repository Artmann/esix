import { Collection, ObjectId } from 'mongodb'
import percentile from 'percentile'

import type BaseModel from './base-model'
import { connectionHandler } from './connection-handler'
import { getCollectionName } from './naming'
import { sanitize } from './sanitize'
import type {
  ComparisonOperator,
  Dictionary,
  Document,
  ObjectType,
  Paginated
} from './types'

/**
 * Represents a MongoDB query object with flexible field-value pairs.
 * Used for building database queries with various operators and conditions.
 */
export type Query = { [index: string]: unknown }

type Order = { [index: string]: 1 | -1 }
type Fields = { [index: string]: 1 }

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

  private query: Query = {}

  private queryLimit?: number
  private queryOffset?: number
  private queryOrder?: Order

  constructor(ctor: ObjectType<T>) {
    this.ctor = ctor
  }

  /**
   * Direct access to Mongo's aggregation functions.
   *
   * @param stages
   * @returns The result of the aggregations
   */
  async aggregate(stages: Record<string, unknown>[]) {
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
   * Returns the number of documents matching the given query.
   *
   * Example
   *
   * ```
   * const numberOfPayingCustomers = await Customer.where('hasPaidTheLastInvoice', true).count();
   * ```
   */
  async count(): Promise<number> {
    const count = await this.useCollection<number>(
      (collection): Promise<number> => {
        return collection.count(this.query)
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

  /**
   * Deletes the Models matching the current query options.
   *
   * @returns Returns the number of models deleted.
   */
  async delete(): Promise<number> {
    const ids = await this.pluck('id')

    return this.useCollection(async (collection) => {
      if (ids.length === 0) {
        return 0
      }

      if (ids.length === 1) {
        const [id] = ids
        const { deletedCount } = await collection.deleteOne({
          _id: id as any
        })

        return deletedCount
      }

      const { deletedCount } = await collection.deleteMany({
        _id: {
          $in: ids as any[]
        }
      })

      return deletedCount
    })
  }

  /**
   * Decrements the given numeric key by `by` for every document matching
   * the current query. Translates to MongoDB's `$inc` operator.
   *
   * Example
   * ```
   * await Account.where('id', accountId).decrement('balance', 25);
   * ```
   *
   * @returns The number of documents that were modified.
   */
  async decrement<K extends keyof T>(key: K, by: number = 1): Promise<number> {
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
    return this.useCollection(async (collection) => {
      const keyStr = (key as string) === 'id' ? '_id' : (key as string)
      const documents = await collection
        .find(this.query, { projection: { [keyStr]: 1 } })
        .toArray()

      const seen = new Set<unknown>()
      const result: T[K][] = []

      for (const document of documents) {
        const value = (document as Record<string, unknown>)[keyStr]
        if (value === null || value === undefined) {
          continue
        }
        const dedupeKey =
          typeof value === 'object' ? JSON.stringify(value) : value
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

      const document = await collection.findOne(query as any)

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
      const document = await collection.findOne(sanitize(query))

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
    this.queryLimit = 1

    const models = await this.execute()

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
   *
   * Example
   * ```
   * await Post.where('id', postId).increment('views');
   * await User.where('isActive', true).increment('score', 5);
   * ```
   *
   * @returns The number of documents that were modified.
   */
  async increment<K extends keyof T>(key: K, by: number = 1): Promise<number> {
    return this.useCollection(async (collection) => {
      const { modifiedCount } = await collection.updateMany(this.query as any, {
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
    const values = await this.pluck(key)

    if (values.length === 0) {
      return 0
    }

    if (!isNumberArray(values)) {
      throw new Error(
        `All values returned for ${String(key)} are not numbers. Please check your data.`
      )
    }

    return Math.max(...values)
  }

  /**
   * Returns the smallest value for the given key.
   *
   * @param key
   */
  async min<K extends keyof T>(key: K): Promise<number> {
    const values = await this.pluck(key)

    if (values.length === 0) {
      return 0
    }

    if (!isNumberArray(values)) {
      throw new Error(
        `All values returned for ${String(key)} are not numbers. Please check your data.`
      )
    }

    return Math.min(...values)
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

    this.queryOrder[key] = order === 'asc' ? 1 : -1

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

    const total = await this.count()

    this.queryOffset = (page - 1) * perPage
    this.queryLimit = perPage

    const data = await this.execute()
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
   * The pluck method retrieves all of the values for a given key.
   *
   * You may also specify how you wish the resulting collection to be keyed.
   *
   * Example
   * ```
   * await Posts.where('categoryId', 2).pluck('id');
   * // => [ '1', '2', '3' ]
   */
  async pluck<K extends keyof T>(key: K): Promise<T[K][]> {
    const records = await this.execute({ [key as string]: 1 })

    const values = records.map((record) => record[key])

    return values
  }

  /**
   * Persist the provided attributes.
   *
   * @param attributes
   * @internal
   */
  async save(attributes: Dictionary): Promise<string> {
    attributes = normalizeAttributes(sanitize(attributes))

    const id = attributes._id

    return this.useCollection(async (collection) => {
      const filter = { _id: id }
      const options = {
        upsert: true
      }

      await collection.updateOne(filter, { $set: attributes }, options)

      return id
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
   * @param value - The value to filter by when using 3-param syntax with operator
   */
  where(query: Query): QueryBuilder<T>
  where<K extends keyof T>(key: K, value: any): QueryBuilder<T>
  where<K extends keyof T>(
    key: K,
    operator: ComparisonOperator,
    value: any
  ): QueryBuilder<T>
  where(
    queryOrKey: Query | string,
    operatorOrValue?: ComparisonOperator | any,
    value?: any
  ): QueryBuilder<T> {
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

    this.query = {
      ...this.query,
      ...query
    }

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
   * @param values
   */
  whereIn<K extends keyof T>(key: K, values: any[]): QueryBuilder<T>
  whereIn(key: string, values: any[]): QueryBuilder<T> {
    const keyStr = key === 'id' ? '_id' : key

    const query = {
      [keyStr]: {
        $in: sanitize(values)
      }
    }

    this.query = {
      ...this.query,
      ...query
    }

    return this
  }

  /**
   * Returns all the models with `key` not in the array of `values`.
   *
   * @param key - A property of the model
   * @param values
   */
  whereNotIn<K extends keyof T>(key: K, values: any[]): QueryBuilder<T>
  whereNotIn(key: string, values: any[]): QueryBuilder<T> {
    const keyStr = key === 'id' ? '_id' : key

    const query = {
      [keyStr]: {
        $nin: sanitize(values)
      }
    }

    this.query = {
      ...this.query,
      ...query
    }

    return this
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

    return instance
  }

  private execute(fields?: Fields): Promise<T[]> {
    return this.useCollection(async (collection) => {
      try {
        let cursor = fields
          ? collection.find(this.query, fields)
          : collection.find(this.query)

        if (this.queryOrder) {
          cursor = cursor.sort(this.queryOrder)
        }

        if (this.queryOffset) {
          cursor = cursor.skip(this.queryOffset)
        }

        if (this.queryLimit) {
          cursor = cursor.limit(this.queryLimit)
        }

        const documents = await cursor.toArray()

        const records = documents
          .filter((document) => document)
          .map((document): T => this.createInstance(document))

        return records
      } catch (error) {
        if (isTextIndexMissingError(error, this.query)) {
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

  private async useCollection<K>(
    block: (collection: Collection) => Promise<any>
  ): Promise<K> {
    const collectionName = getCollectionName(this.ctor.name)

    const connection = await connectionHandler.getConnection()

    const collection = await connection.collection(collectionName)

    const result = await block(collection)

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
  return array.every((item) => typeof item === 'number')
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
