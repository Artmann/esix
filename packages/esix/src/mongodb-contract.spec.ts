import { MongoClient, ObjectId } from 'mongodb'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { BaseModel, connectionHandler } from './index'

class RecordModel extends BaseModel {
  static collectionName = 'records'
  value = 0
  group = ''
}

const uri = process.env.ESIX_TEST_MONGODB_URI

describe.skipIf(!uri)('MongoDB driver contracts', () => {
  const databaseName = `esix_contract_${randomUUID().replaceAll('-', '')}`
  let client: MongoClient
  beforeAll(async () => {
    process.env.DB_ADAPTER = 'default'
    process.env.DB_URL = uri!
    process.env.DB_DATABASE = databaseName
    client = await MongoClient.connect(uri!)
  })
  beforeEach(async () => {
    await client.db(databaseName).collection('records').deleteMany({})
    await client
      .db(databaseName)
      .collection('records')
      .insertMany([
        { _id: 'c' as any, value: 5, group: 'one' },
        { _id: 'a' as any, value: 20, group: 'one' },
        { _id: 'b' as any, value: 70, group: 'two' }
      ])
  })
  afterAll(async () => {
    await connectionHandler.closeConnections()
    await client?.db(databaseName).dropDatabase()
    await client?.close()
  })

  it('retains both range bounds', async () => {
    expect(
      await RecordModel.where('value', '>=', 18)
        .where('value', '<=', 65)
        .pluck('value')
    ).toEqual([20])
  })
  it('retains repeated operators and contradictory equalities', async () => {
    expect(
      await RecordModel.where('value', '>', 18)
        .where('value', '>', 0)
        .pluck('value')
    ).toEqual([20, 70])
    expect(
      await RecordModel.where('value', 5).where('value', 20).get()
    ).toEqual([])
  })
  it('intersects memberships within an OR branch', async () => {
    const values = await RecordModel.where('value', 70)
      .orWhere('group', 'one')
      .whereIn('value', [5])
      .whereIn('value', [20])
      .pluck('value')
    expect(values).toEqual([70])
  })
  it('keeps scopes when finding string and BSON IDs', async () => {
    expect(await RecordModel.where('group', 'two').find('a')).toBeNull()
    const id = new ObjectId()
    await client
      .db(databaseName)
      .collection('records')
      .insertOne({ _id: id, group: 'one' })
    expect(
      await RecordModel.where('group', 'two')
        .orWhere('value', 999)
        .find(id.toHexString())
    ).toBeNull()
  })
  it('finds the public id alias', async () => {
    expect((await RecordModel.findBy('id', 'a'))?.value).toBe(20)
  })
  it('sorts and paginates by the public id', async () => {
    expect(await RecordModel.orderBy('id').pluck('id')).toEqual(['a', 'b', 'c'])
    expect(
      (await RecordModel.orderBy('id', 'desc').paginate(2, 1)).data[0].id
    ).toBe('b')
  })
})
