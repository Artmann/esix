import { paramCase } from 'change-case';
import MongoMock from 'mongo-mock';
import { Collection, MongoClient, ObjectId } from 'mongodb';
import pluralize from 'pluralize';
import { Dictionary, Document, ObjectType } from './types';

export type Query = { [index: string]: any };

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

export default class QueryBuilder<T> {
  private readonly ctor: ObjectType<T>;

  private query: Query = {};

  constructor(ctor: ObjectType<T>) {
    this.ctor = ctor;
  }

  async create(attributes: { [index: string]: any }): Promise<string> {
    attributes = normalizeAttributes(attributes);

    return this.useCollection(async(collection) => {
      const { insertedId } = await collection.insertOne(attributes);

      return insertedId;
    });
  }

  async findOne(query: Query): Promise<T | null> {
    return this.useCollection(async(collection) => {
      const document = await collection.findOne(query);

      if (!document) {
        return null;
      }

      return this.createInstance(document);
    });
  }

  async first(): Promise<T | null> {
    const models = await this.execute();

    if (models.length === 0) {
      return null;
    }

    return models[0];
  }

  async get(): Promise<T[]> {
    return this.execute();
  }

  async save(attributes: Dictionary): Promise<string> {
    attributes = normalizeAttributes(attributes);

    const id = attributes._id;

    return this.useCollection(async(collection) => {
      const filter = { _id: id };
      const options = {
        upsert: true
      };

      await collection.updateOne(filter, attributes, options);

      return id;
    });
  }

  where(query: Query): QueryBuilder<T>;
  where(key: string, value: any): QueryBuilder<T>;
  where(queryOrKey: Query | string, value?: any): QueryBuilder<T> {
    const query = isString(queryOrKey) ? { [queryOrKey]: value } : queryOrKey;

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

  private async getClient(): Promise<MongoClient> {
    const adapterName = (process.env['DB_ADAPTER'] || 'default').toLowerCase();
    const url = process.env['DB_URL'] || 'mongodb://127.0.0.1:27017/';
    const poolSize = parseInt(process.env['DB_POOL_SIZE'] || '10', 10);

    const MockClient = (MongoMock.MongoClient as unknown) as typeof MongoClient;

    const adapters: { [index: string]: typeof MongoClient } = {
      default: MongoClient,
      mock: MockClient
    };

    if (!adapters.hasOwnProperty(adapterName)) {
      const validAdapterNames = Object.keys(adapters)
        .map(name => `'${name}'`)
        .join(', ');

      throw new Error(`${ adapterName } is not a valid adapter name. Must be one of ${ validAdapterNames }.`);
    }

    const adapter = process.env['CI'] ? adapters.mock : adapters[adapterName];
    const client = await adapter.connect(url, {
      poolSize,
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    return client;
  }

  private execute(): Promise<T[]> {
    return this.useCollection(async(collection) => {
      const documents = await collection.find(this.query).toArray();
      const records = documents
      .filter(document => document)
      .map((document): T => this.createInstance(document));

      return records;
    });
  }

  private async useCollection<K>(block: (collection: Collection) => Promise<any>): Promise<K> {
    const databaseName = process.env['DB_DATABASE'] || ''

    const collectionName = normalizeName(this.ctor.name);

    const client = await this.getClient();
    const database = await client.db(databaseName);
    const collection = await database.collection(collectionName);

    const result = await block(collection);

    if (client.close) {
      await client.close();
    }

    return result;
  }
}
