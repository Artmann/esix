import * as changeCase from 'change-case'
import { Collection, ObjectId } from 'mongodb'
import percentile from 'percentile'
import pluralize from 'pluralize'

import type BaseModel from './base-model'
import { connectionHandler } from './connection-handler'
import { sanitize } from './sanitize'
import type { Dictionary, Document, ObjectType } from './types'

export type Query = { [index: string]: any }

type Order = { [index: string]: 1 | -1 }
type Fields = { [index: string]: 1 }

function isString(x: any): x is string {
  return typeof x === 'string'
}

function normalizeName(className: string): string {
  return pluralize(changeCase.kebabCase(className))
}

function normalizeAttributes(originalAttributes: Dictionary): Dictionary {
  const attributes = { ...originalAttributes }

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
   * Returns the model with the given id or null if there is no matching model.
   */
  async find(id: string): Promise<T | null> {
    return this.useCollection(async (collection) => {
      let objectId: ObjectId | undefined

      try {
        objectId = ObjectId.createFromHexString(id)
      } catch (error) { }

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
   * Returns an array of models matching the query options.
   */
  async get(): Promise<T[]> {
    return this.execute()
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
   * @param key The key you want to sort by.
   * @param order Defaults to ascending order.
   */
  orderBy(key: string, order: 'asc' | 'desc' = 'asc'): QueryBuilder<T> {
    if (!this.queryOrder) {
      this.queryOrder = {}
    }

    this.queryOrder[key] = order === 'asc' ? 1 : -1

    return this
  }

  /**
   * Returns the nth percentile of all the values for the given key.
   *
   * @param key
   * @param n
   */
  async percentile<K extends keyof T>(key: K, n: number): Promise<number> {
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
    const records = await this.execute({ [(key as string)]: 1 })

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
   * @param key
   * @oaram value
   */
  where(query: Query): QueryBuilder<T>
  where(key: string, value: any): QueryBuilder<T>
  where(queryOrKey: Query | string, value?: any): QueryBuilder<T> {
    const query = isString(queryOrKey) ? { [queryOrKey]: value } : queryOrKey

    this.query = {
      ...this.query,
      ...sanitize(query)
    }

    return this
  }

  /**
   * Returns all the models with `fieldName` in the array of `values`.
   *
   * @param fieldName
   * @param values
   */
  whereIn(fieldName: string, values: any[]): QueryBuilder<T> {
    if (fieldName === 'id') {
      fieldName = '_id'
    }

    const query = {
      [fieldName]: {
        $in: sanitize(values)
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
    })
  }

  private async useCollection<K>(
    block: (collection: Collection) => Promise<any>
  ): Promise<K> {
    const collectionName = normalizeName(this.ctor.name)

    const connection = await connectionHandler.getConnection()

    const collection = await connection.collection(collectionName)

    const result = await block(collection)

    return result
  }
}

function isNumberArray(array: any[]): array is number[] {
  return array.every((item) => typeof item === 'number')
}
