import { paramCase } from 'change-case';
import { Collection, ObjectId } from 'mongodb';
import percentile from 'percentile';
import pluralize from 'pluralize';

import { connectionHandler } from './connection-handler.js';
import { sanitize } from './sanitize.js';
import { Dictionary, Document, ObjectType } from './types.js';

export type Query = { [index: string]: any };

type Order = { [ index: string ]: 1 | -1 };
type Fields = { [ index: string ]: 1 };

function isString(x: any): x is string {
  return typeof x === 'string';
}

function normalizeName(className: string): string {
  return pluralize(paramCase(className));
}

function normalizeAttributes(originalAttributes: Dictionary): Dictionary {
  const attributes = { ...originalAttributes };

  if (!attributes.id) {
    attributes.id = new ObjectId().toHexString();
  }

  if (attributes.hasOwnProperty('id')) {
    attributes._id = attributes.id;
    delete attributes.id;
  }

  if (!attributes['createdAt']) {
    attributes.createdAt = Date.now();
  }

  if (!attributes['updatedAt']) {
    attributes.updatedAt = null;
  }

  return attributes;
}

export default class QueryBuilder<T extends Dictionary> {
  private readonly ctor: ObjectType<T>;

  private query: Query = {};

  private queryLimit?: number;
  private queryOrder?: Order;

  constructor(ctor: ObjectType<T>) {
    this.ctor = ctor;
  }

  /**
   * Direct access to Mongo's aggregation functions.
   *
   * @param stages
   * @returns The result of the aggregations
   */
  async aggregate(stages: Record<string, unknown>[]) {
    return this.useCollection(async(collection) => {
      const cursor = await collection.aggregate(stages);

      return cursor.toArray();
    });
  }

  /**
   * Returns the average of all the values for the given key.
   *
   * @param key
   */
   async average(key: string): Promise<number> {
    const values = await this.pluck(key);

    if (values.length === 0) {
      return 0;
    }

    const sum = values.reduce((sum, value) => sum + value, 0);

    return sum / values.length;
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
  async count(): Promise<number>  {
    const count = await this.useCollection<number>((collection): Promise<number> => {
      return collection.count(this.query);
    });

    return count
  }

  /**
   * Creates a new document with the given attributes.
   *
   * @internal
   */
  async create(attributes: { [index: string]: any }): Promise<string> {
    attributes = normalizeAttributes(attributes);

    return this.useCollection(async(collection) => {
      const { insertedId } = await collection.insertOne(attributes);

      return insertedId;
    });
  }

  /**
   * Deletes the Models matching the current query options.
   *
   * @returns Returns the number of models deleted.
   */
  async delete(): Promise<number> {
    const ids = await this.pluck('id') || [];

    return this.useCollection(async(collection) => {
      if (ids.length === 0) {
        return 0;
      }

      if (ids.length === 1) {
        const [ id ] = ids;
        const { deletedCount } = await collection.deleteOne({
          _id: id
        });

        return deletedCount;
      }

      const { deletedCount } = await collection.deleteMany({
        _id: {
          $in: ids
        }
      });

      return deletedCount;
    });
  }

  /**
   * Returns the model with the given id or null if there is no matching model.
   */
  async find(id: string): Promise<T | null> {
    return this.useCollection(async collection => {
      let objectId: ObjectId | undefined;

      try {
        objectId = ObjectId.createFromHexString(id);
      } catch (error) {}

      const query = objectId ? {
        $or: [
          { _id: objectId },
          { _id: sanitize(id) }
        ]
      } : { _id: sanitize(id) };

      const document = await collection.findOne(query);

      if (!document) {
        return null;
      }

      return this.createInstance(document);
    });
  }

  /**
   * Returns the first model matching the query options.
   *
   * @internal
   */
  async findOne(query: Query): Promise<T | null> {
    return this.useCollection(async(collection) => {
      const document = await collection.findOne(sanitize(query));

      if (!document) {
        return null;
      }

      return this.createInstance(document);
    });
  }

  /**
   * Returns the first model matching the query options.
   */
  async first(): Promise<T | null> {
    this.queryLimit = 1;

    const models = await this.execute();

    if (models.length === 0) {
      return null;
    }

    return models[0];
  }

  /**
   * Returns an array of models matching the query options.
   */
  async get(): Promise<T[]> {
    return this.execute();
  }

  /**
   * Limits the number of models returned.
   *
   * @param length
   */
  limit(length: number): QueryBuilder<T> {
    this.queryLimit = length;

    return this;
  }

  /**
   * Returns the largest value for the given key.
   *
   * @param key
   */
   async max(key: string): Promise<number> {
    const values = await this.pluck(key);

    return Math.max(...values)
  }

  /**
   * Returns the smallest value for the given key.
   *
   * @param key
   */
   async min(key: string): Promise<number> {
    const values = await this.pluck(key);

    return Math.min(...values);
  }

  /**
   * Sorts the models by the given key.
   *
   * @param key The key you want to sort by.
   * @param order Defaults to ascending order.
   */
  orderBy(key: string, order: 'asc' | 'desc' = 'asc'): QueryBuilder<T> {
    if (!this.queryOrder) {
      this.queryOrder = {};
    }

    this.queryOrder[key] = order === 'asc' ? 1 : -1;

    return this;
  }

  /**
   * Returns the nth percentile of all the values for the given key.
   *
   * @param key
   * @param n
   */
   async percentile(key: string, n: number): Promise<number> {
    const values = await this.pluck(key);

    if (values.length === 0) {
      return 0;
    }

    return percentile(n, values);
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
   *
   * await Products.where('size', 'large').pluck('price', 'name');
   * // => [ { name: 'Shirt 1', price: 14.99 } ]
   * ```
   */
  async pluck(...keys: string[]): Promise<any[]> {
    if (keys.length === 0) {
      return [];
    }

    const fields: Fields = keys.reduce((carry, key) => ({
      ...carry,
      [key]: 1
    }), {});

    const records = await this.execute(fields);

    if (keys.length === 1) {
      const [ key ] = keys;

      return records.map((record: any) => record[key]);
    }

    const transform = (item: Dictionary): any => {
      return keys.reduce((carry: any, key: string): any => ({
        ...carry,
        [key]: item[key]
      }), {});
    };

    return records.map(transform);
  }

  /**
   * Persist the provided attributes.
   *
   * @param attributes
   * @internal
   */
  async save(attributes: Dictionary): Promise<string> {
    attributes = normalizeAttributes(
      sanitize(
        attributes
      )
    );

    const id = attributes._id;

    return this.useCollection(async(collection) => {
      const filter = { _id: id };
      const options = {
        upsert: true
      };

      await collection.updateOne(filter, { $set: attributes }, options);

      return id;
    });
  }

  /**
   * Returns the sum of all the values for the given key.
   *
   * @param key
   */
  async sum(key: string): Promise<number> {
    const values = await this.pluck(key);

    return values.reduce((sum, value) => sum + value, 0);
  }

  /**
   * Adds a constraint to the current query.
   *
   * @param key
   * @oaram value
   */
  where(query: Query): QueryBuilder<T>;
  where(key: string, value: any): QueryBuilder<T>;
  where(queryOrKey: Query | string, value?: any): QueryBuilder<T> {
    const query = isString(queryOrKey) ? { [queryOrKey]: value } : queryOrKey;

    this.query = {
      ...this.query,
      ...sanitize(query)
    };

    return this;
  }

  /**
   * Returns all the models with `fieldName` in the array of `values`.
   *
   * @param fieldName
   * @param values
   */
  whereIn(fieldName: string, values: any[]): QueryBuilder<T> {
    if (fieldName === 'id') {
      fieldName = '_id';
    }

    const query ={
      [fieldName]: {
        $in: sanitize(values)
      }
    };

    this.query = {
      ...this.query,
      ...query
    };

    return this;
  }

  private createInstance<T>(document: Document): T {
    const instance = new this.ctor() as any;

    for (const prop in document) {
      if (prop === '_id') {
        continue;
      }

      instance[prop] = document[prop];
    }

    const id = isString(document._id)
      ? document._id
      : (document._id as ObjectId).toHexString();

    instance.id = id;

    return instance;
  }

  private execute(fields?: Fields): Promise<T[]> {
    return this.useCollection(async(collection) => {
      let cursor = fields
        ? collection.find(this.query, fields)
        : collection.find(this.query);

      if (this.queryOrder) {
        cursor = cursor.sort(this.queryOrder);
      }

      if (this.queryLimit) {
        cursor = cursor.limit(this.queryLimit);
      }

      const documents = await cursor.toArray();

      const records = documents
        .filter(document => document)
        .map((document): T => this.createInstance(document));

      return records;
    });
  }

  private async useCollection<K>(block: (collection: Collection) => Promise<any>): Promise<K> {
    const collectionName = normalizeName(this.ctor.name);

    const connection = await connectionHandler.getConnection();

    const collection = await connection.collection(collectionName);

    const result = await block(collection);

    return result;
  }
}
