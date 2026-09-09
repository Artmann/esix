import { Binary, Decimal128, MongoClient, ObjectId } from 'mongodb'
import { randomUUID } from 'node:crypto'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
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
    client = await MongoClient.connect(uri!, { monitorCommands: true })
  })
  afterEach(() => vi.restoreAllMocks())
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
  it('preserves BSON values through save and query sanitization', async () => {
    const c = client.db(databaseName).collection('records')
    const date = new Date('2024-01-02T00:00:00Z')
    const ref = new ObjectId()
    await c.insertOne({
      _id: 'bson' as any,
      date,
      ref,
      nested: [date],
      decimal: Decimal128.fromString('1.25'),
      binary: new Binary(Buffer.from([1, 2]))
    })
    const model = await RecordModel.find('bson')
    await model!.save()
    const stored = await c.findOne({ _id: 'bson' as any })
    expect(stored!.date).toEqual(date)
    expect(stored!.ref).toEqual(ref)
    expect(stored!.nested).toEqual([date])
    expect(stored!.decimal.toString()).toBe('1.25')
    expect(stored!.binary.value()).toEqual(Buffer.from([1, 2]))
    expect(await RecordModel.limit(1).where({ date, ref }).count()).toBe(1)
    const created = await RecordModel.firstOrCreate({ group: 'new' }, {
      date,
      ref
    } as any)
    expect((await c.findOne({ _id: created.id as any }))!.date).toEqual(date)
  })
  it('updates the exact BSON identity when a matching string ID exists', async () => {
    const c = client.db(databaseName).collection('records')
    const id = new ObjectId()
    await c.insertMany([
      { _id: id, group: 'native' },
      { _id: id.toHexString() as any, group: 'string' }
    ])
    const model = await RecordModel.where('group', 'native').first()
    await model!.update({ value: 42 })
    expect((await c.findOne({ _id: id }))!.value).toBe(42)
    expect(
      (await c.findOne({ _id: id.toHexString() as any }))!.value
    ).toBeUndefined()
    expect(await model!.delete()).toBe(1)
    expect(await c.findOne({ _id: id })).toBeNull()
    expect(await c.findOne({ _id: id.toHexString() as any })).not.toBeNull()
  })
  it('deletes selected ObjectId records in bulk', async () => {
    const c = client.db(databaseName).collection('records')
    await c.insertMany([
      { _id: new ObjectId(), group: 'native' },
      { _id: new ObjectId(), group: 'native' }
    ])
    expect(await RecordModel.where('group', 'native').limit(2).delete()).toBe(2)
    expect(await c.countDocuments({ group: 'native' })).toBe(0)
  })
  it('sets creation metadata only after successful persistence', async () => {
    const model = new RecordModel()
    const spy = vi
      .spyOn(connectionHandler, 'getConnection')
      .mockRejectedValueOnce(new Error('offline'))
    await expect(model.save()).rejects.toThrow('offline')
    expect(model.wasRecentlyCreated).toBe(false)
    spy.mockRestore()
    await model.save()
    expect(model.wasRecentlyCreated).toBe(true)
    const explicit = new RecordModel()
    explicit.id = 'explicit'
    await explicit.save()
    expect(explicit.wasRecentlyCreated).toBe(true)
    expect((await RecordModel.find('explicit'))!.wasRecentlyCreated).toBe(false)
  })
  it('projects scalar reads without constructing models', async () => {
    let constructions = 0
    class Scalar extends RecordModel {
      constructor() {
        super()
        constructions++
      }
    }
    const commands: any[] = []
    const listener = (event: any) => commands.push(event.command)
    client.on('commandStarted', listener)
    vi.spyOn(connectionHandler, 'getConnection').mockResolvedValue(
      client.db(databaseName)
    )
    try {
      expect(await Scalar.orderBy('id').pluck('value')).toEqual([20, 70, 5])
      expect(constructions).toBe(0)
      expect(commands.find((command) => command.find)?.projection).toEqual({
        value: 1,
        _id: 0
      })
    } finally {
      client.off('commandStarted', listener)
    }
  })
  it('aggregates on the server with filter, sort and window semantics', async () => {
    const commands: any[] = []
    const listener = (event: any) => commands.push(event.command)
    client.on('commandStarted', listener)
    vi.spyOn(connectionHandler, 'getConnection').mockResolvedValue(
      client.db(databaseName)
    )
    try {
      expect(
        await RecordModel.where('value', '>', 0)
          .orderBy('value')
          .skip(1)
          .limit(1)
          .sum('value')
      ).toBe(20)
      expect(commands.some((command) => command.aggregate)).toBe(true)
      expect(commands.some((command) => command.find)).toBe(false)
    } finally {
      client.off('commandStarted', listener)
    }
  })
  it('keeps scalar aggregation errors and empty results consistent', async () => {
    const c = client.db(databaseName).collection('records')
    await c.insertOne({ _id: 'invalid' as any, value: 'bad', group: 'invalid' })
    for (const method of ['sum', 'average', 'min', 'max'] as const) {
      await expect(
        RecordModel.where('group', 'invalid')[method]('value')
      ).rejects.toThrow(/not numbers/)
      expect(await RecordModel.where('group', 'missing')[method]('value')).toBe(
        0
      )
    }
  })
  it('deletes an unbounded scope with no prefetch', async () => {
    const commands: any[] = []
    const listener = (event: any) => commands.push(event.command)
    client.on('commandStarted', listener)
    vi.spyOn(connectionHandler, 'getConnection').mockResolvedValue(
      client.db(databaseName)
    )
    try {
      expect(await RecordModel.where('group', 'one').delete()).toBe(2)
      expect(commands.some((command) => command.find)).toBe(false)
      expect(await RecordModel.count()).toBe(1)
    } finally {
      client.off('commandStarted', listener)
    }
  })
  it('creates with one write and returns an independent persisted snapshot', async () => {
    const commands: any[] = []
    const listener = (event: any) => commands.push(event.command)
    client.on('commandStarted', listener)
    vi.spyOn(connectionHandler, 'getConnection').mockResolvedValue(
      client.db(databaseName)
    )
    try {
      const attributes = { group: 'created', nested: { value: 1 } }
      const created = await RecordModel.create(attributes as any)
      expect(created.wasRecentlyCreated).toBe(true)
      expect(created.createdAt).toBeGreaterThan(0)
      attributes.nested.value = 2
      expect((created as any).nested.value).toBe(1)
      expect(commands.filter((command) => command.find)).toHaveLength(0)
      expect(commands.filter((command) => command.insert)).toHaveLength(1)
    } finally {
      client.off('commandStarted', listener)
    }
  })
  it('deduplicates whole values on the server without string/object collisions', async () => {
    const c = client.db(databaseName).collection('records')
    await c.insertMany([
      { group: 'distinct', item: { a: 1 } },
      { group: 'distinct', item: '{"a":1}' },
      { group: 'distinct', item: ['x', 'y'] },
      { group: 'distinct', item: ['x', 'y'] },
      { group: 'distinct', item: null },
      { group: 'distinct' }
    ])
    const commands: any[] = []
    const listener = (event: any) => commands.push(event.command)
    client.on('commandStarted', listener)
    vi.spyOn(connectionHandler, 'getConnection').mockResolvedValue(
      client.db(databaseName)
    )
    try {
      const values = await RecordModel.where('group', 'distinct').distinct(
        'item' as any
      )
      expect(values).toHaveLength(3)
      expect(values).toEqual(
        expect.arrayContaining([{ a: 1 }, '{"a":1}', ['x', 'y']])
      )
      expect(commands.some((command) => command.find)).toBe(false)
    } finally {
      client.off('commandStarted', listener)
    }
  })
  it('does not let first or pagination mutate a reused query', async () => {
    const query = RecordModel.orderBy('id')
    expect((await query.first())!.id).toBe('a')
    expect((await query.get()).map((item) => item.id)).toEqual(['a', 'b', 'c'])
    await query.paginate(2, 1)
    expect((await query.get()).map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })
  it('captures sort and limit before asynchronous execution', async () => {
    const query = RecordModel.orderBy('id')
    const first = query.get()
    query.orderBy('id', 'desc').limit(1)
    expect((await first).map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect((await query.get()).map((item) => item.id)).toEqual(['c'])
  })
  it('rejects non-finite numeric inputs and stored values', async () => {
    for (const value of [NaN, Infinity, -Infinity]) {
      await expect(
        RecordModel.where('id', 'a').increment('value', value)
      ).rejects.toThrow(/finite/)
      await client
        .db(databaseName)
        .collection('records')
        .updateOne({ _id: 'a' as any }, { $set: { value } })
      for (const method of ['sum', 'average', 'min', 'max'] as const) {
        await expect(
          RecordModel.where('id', 'a')[method]('value')
        ).rejects.toThrow(/numbers/)
      }
    }
  })
  it('uses BSON foreign keys without crossing a colliding string identity', async () => {
    const c = client.db(databaseName).collection('records')
    const id = new ObjectId()
    await c.insertMany([
      { _id: id, group: 'parent' },
      { _id: id.toHexString() as any, group: 'other' },
      { _id: 'child' as any, parentId: id }
    ])
    const child = await RecordModel.find('child')
    expect((await child!.belongsTo(RecordModel, 'parentId'))!.group).toBe(
      'parent'
    )
    const parent = await RecordModel.where('group', 'parent').first()
    expect(
      (await parent!.hasMany(RecordModel, 'parentId').get()).map(
        (record) => record.id
      )
    ).toEqual(['child'])
  })
  it('does not return unrelated children for an unsaved parent', async () => {
    await client
      .db(databaseName)
      .collection('records')
      .insertOne({ parentId: '' })
    expect(
      await new RecordModel().hasMany(RecordModel, 'parentId').get()
    ).toEqual([])
  })
})
