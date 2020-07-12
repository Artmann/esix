import { paramCase } from 'change-case';
import MongoMock from 'mongo-mock';
import { Collection, Db, MongoClient, ObjectID } from 'mongodb';
import pluralize from 'pluralize';

type Document = { [index: string]: any };
type ObjectType<T> = { new(): T, };
type Query = { [index: string]: any };

function isString(x: any): x is string {
  return typeof x === 'string';
}

function normalizeName(className: string): string {
  return pluralize(paramCase(className));
}

export default class QueryBuilder<T> {
  private readonly ctor: ObjectType<T>;

  private query: Query = {};

  constructor(ctor: ObjectType<T>) {
    this.ctor = ctor;
  }

  async findOne(query: Query): Promise<T | null> {
    const collection = await this.getCollection();
    const document = await collection.findOne(query);

    if (!document) {
      return null;
    }

    return this.createInstance(document);
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

  async get(): Promise<T[]> {
    const collection = await this.getCollection();
    const documents = await collection.find(this.query).toArray();

    const records = documents
      .filter(document => document)
      .map((document): T => this.createInstance(document));

    return records;
  }

  private createInstance<T>(document: Document): T {
    const instance = new this.ctor() as any;

    for (const prop in document) {
      if (prop === '_id') {
        continue;
      }

      instance[prop] = document[prop];
    }

    const id = typeof document._id === 'string'
      ? document._id
      : (document._id as ObjectID).toHexString();

    instance.id = id;

    return instance;
  }

  private async getCollection(): Promise<Collection> {
    const collectionName = normalizeName(this.ctor.name);
    const database = await this.getDatabase();

    return database.collection(collectionName);
  }

  private async getDatabase(): Promise<Db> {
    const adapterName = (process.env['DB_ADAPTER'] || 'default').toLowerCase();
    const url = process.env['DB_URL'] || '';
    const databaseName = process.env['DB_DATABASE'] || ''
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

    const adapter = adapters[adapterName];
    const client = await adapter.connect(url, {
      poolSize,
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    const database = client.db(databaseName);

    return database;
  }
}
