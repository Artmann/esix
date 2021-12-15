import 'jest-expect-message';

import chalk from 'chalk';
import { isArray, isObject } from 'lodash';
import { resolve } from 'path';
import mongodb from 'mongo-mock';
import { MongoClient } from 'mongodb';

mongodb.max_delay = 1;

import { Example, loadExamples } from './examples';
import { randomDatabaseName } from './tests';

describe('Examples', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      'DB_ADAPTER': 'mock'
    });
  });

  it('returns the expected output for each example', async () => {
    const exampleDirectory = resolve(__dirname, '..', 'docs', 'examples');
    const examples = await loadExamples(exampleDirectory);

    for (const example of examples) {
      Object.assign(process.env, {
        'DB_DATABASE': randomDatabaseName()
      });

      await loadDataset(example.dataset);

      const result = await example.code();

      const expectedResult = (ex: Example): any => {
        if (isArray(ex.output)) {
          return ex.output.map((row: any) => ({
            ...row,
            createdAt: 0,
            updatedAt: null
          }))
        }

        if (isObject(ex.output)) {
          return {
            ...ex.output,
            createdAt: 0,
            updatedAt: null
          };
        }

        return ex.output;
      };

      expect(
        result,
        chalk.red(`The ${ chalk.bold(example.name) } example didn't return the correct output.`)
      ).toEqual(expectedResult(example));
    }
  });
});

async function loadDataset(dataset: Record<string, any[]>): Promise<void> {
  const client = (mongodb.MongoClient as unknown) as typeof MongoClient;
  const connection = await client.connect(process.env['DB_URL'] || 'mongodb://127.0.0.1:27017/');
  const db = await connection.db(process.env['DB_DATABASE']);

  for (const [ collectionName, data ] of Object.entries(dataset)) {
    const collection = await db.collection(collectionName);

    for (const document of data)
    {
      document._id = document.id;

      await collection.insertOne(document);
    }
  }

}
