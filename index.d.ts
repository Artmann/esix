declare module 'mongo-mock' {
  import { MongoClient as OriginalMongoClient, MongoClientOptions } from 'mongodb';

  export class MongoClient {
    connect: (url: string, options?: MongoClientOptions) => Promise<OriginalMongoClient>;
  }

  export let max_delay: number;
}
