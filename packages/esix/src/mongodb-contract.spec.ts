import {
  Binary,
  Decimal128,
  Double,
  Long,
  MongoClient,
  ObjectId
} from 'mongodb'
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
    expect(explicit.createdAt).toBeGreaterThan(0)
    expect(explicit.createdAt).toBe(
      (await RecordModel.find('explicit'))!.createdAt
    )
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
      { _id: 'child' as any, parentId: id },
      { _id: 'string-child' as any, parentId: id.toHexString() }
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
  it('atomically creates once under contention with a unique index', async () => {
    const c = client.db(databaseName).collection('records')
    await c.createIndex({ uniqueKey: 1 }, { unique: true, sparse: true })
    const records = await Promise.all(
      Array.from({ length: 12 }, () =>
        RecordModel.firstOrCreate({ uniqueKey: 'shared' } as any)
      )
    )
    expect(new Set(records.map((record) => record.id)).size).toBe(1)
    expect(records.filter((record) => record.wasRecentlyCreated)).toHaveLength(
      1
    )
    expect(await c.countDocuments({ uniqueKey: 'shared' })).toBe(1)
  })
  it('propagates duplicate inserts without marking a model as created', async () => {
    await RecordModel.create({ id: 'unique' })
    await expect(RecordModel.create({ id: 'unique' })).rejects.toMatchObject({
      code: 11000
    })
  })
  it('supports zero custom relationship keys and absent owners', async () => {
    const c = client.db(databaseName).collection('records')
    await c.insertMany([
      { _id: 'parent-zero' as any, owner: 0 },
      { _id: 'child-zero' as any, parent: 0 }
    ])
    const child = await RecordModel.find('child-zero')
    expect((await child!.belongsTo(RecordModel, 'parent', 'owner'))!.id).toBe(
      'parent-zero'
    )
    const parent = await RecordModel.find('parent-zero')
    expect((await parent!.hasOne(RecordModel, 'parent', 'owner'))!.id).toBe(
      'child-zero'
    )
    expect(await new RecordModel().belongsTo(RecordModel, 'missing')).toBeNull()
  })
  it('iterates homogeneous ObjectIds once while deleting each batch', async () => {
    const c = client.db(databaseName).collection('records')
    const ids = [new ObjectId(), new ObjectId(), new ObjectId()]
    await c.insertMany(ids.map((_id) => ({ _id, group: 'batch' })))
    const seen: string[] = []
    await RecordModel.where('group', 'batch')
      .orderBy('value', 'desc')
      .skip(99)
      .limit(1)
      .chunk(2, async (records) => {
        seen.push(...records.map((record) => record.id))
        await Promise.all(records.map((record) => record.delete()))
      })
    expect(seen).toEqual(ids.map((id) => id.toHexString()))
    expect(await c.countDocuments({ group: 'batch' })).toBe(0)
  })
  it('retains the documented all-matching semantics of bulk increments', async () => {
    expect(
      await RecordModel.where('group', 'one')
        .limit(1)
        .skip(1)
        .increment('value', 2)
    ).toBe(2)
    const c = client.db(databaseName).collection('records')
    expect((await c.findOne({ _id: 'a' as any }))!.value).toBe(22)
    expect((await c.findOne({ _id: 'c' as any }))!.value).toBe(7)
    expect((await c.findOne({ _id: 'a' as any }))!.updatedAt).toBeUndefined()
  })
  it('returns stored scalar values without substituting model defaults', async () => {
    await client
      .db(databaseName)
      .collection('records')
      .insertOne({ _id: 'missing' as any })
    expect(await RecordModel.where('id', 'missing').pluck('value')).toEqual([
      undefined
    ])
    await expect(
      RecordModel.where('id', 'missing').sum('value')
    ).rejects.toThrow(/numbers/)
    expect((await RecordModel.find('missing'))!.value).toBe(0)
  })
  it('requires a text index and returns indexed text matches', async () => {
    const c = client.db(databaseName).collection('records')
    await expect(RecordModel.limit(1).search('one').get()).rejects.toThrow(
      /text index/
    )
    await c.createIndex({ group: 'text' })
    expect(
      (await RecordModel.limit(3).search('two').get()).map(
        (record) => record.id
      )
    ).toEqual(['b'])
    await c.dropIndex('group_text')
  })
  it('returns a number when safe numeric inputs produce a BSON Long sum', async () => {
    const c = client.db(databaseName).collection('records')
    await c.insertMany([
      { group: 'longs', value: Long.fromString('9007199254740991') },
      { group: 'longs', value: Long.fromString('9007199254740991') }
    ])
    expect(await RecordModel.where('group', 'longs').sum('value')).toBe(
      18014398509481982
    )
  })
  it('rejects stored Long objects outside the driver numeric promotion range', async () => {
    const c = client.db(databaseName).collection('records')
    await c.insertMany([
      { group: 'unsafe-longs', value: Long.fromString('9007199254740993') },
      { group: 'unsafe-longs', value: Long.fromString('-9007199254740993') }
    ])
    await expect(
      RecordModel.where('group', 'unsafe-longs').sum('value')
    ).rejects.toThrow(/numbers/)
  })

  it('retains BSON numeric storage types when creating a snapshot', async () => {
    const created = await RecordModel.create({
      value: Long.fromString('42'),
      double: new Double(42)
    } as any)
    const [types] = await client
      .db(databaseName)
      .collection('records')
      .aggregate([
        { $match: { _id: created.id } },
        {
          $project: {
            valueType: { $type: '$value' },
            doubleType: { $type: '$double' }
          }
        }
      ])
      .toArray()
    expect(types.valueType).toBe('long')
    expect(types.doubleType).toBe('double')
    expect(created.value).toBe(42)
  })
  it('accepts both inclusive BSON Long promotion boundaries', async () => {
    const c = client.db(databaseName).collection('records')
    await c.insertMany([
      { group: 'boundary-longs', value: Long.fromString('9007199254740992') },
      { group: 'boundary-longs', value: Long.fromString('-9007199254740992') }
    ])
    expect(
      await RecordModel.where('group', 'boundary-longs').sum('value')
    ).toBe(0)
    expect(
      await RecordModel.where('group', 'boundary-longs').min('value')
    ).toBe(-9007199254740992)
    expect(
      await RecordModel.where('group', 'boundary-longs').max('value')
    ).toBe(9007199254740992)
  })
})
