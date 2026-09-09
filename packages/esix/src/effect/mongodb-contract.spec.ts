import { Chunk, Effect, Option, Redacted, Stream } from 'effect'
import { MongoClient, ObjectId } from 'mongodb'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BaseModel } from 'esix'
import { Esix } from './service'

class Record extends BaseModel {
  value = 0
  group = ''
  tags: string[] = []
}
const uri = process.env.ESIX_TEST_MONGODB_URI

describe.skipIf(!uri)('Effect native driver contracts', () => {
  const name = `esix_effect_contract_${randomUUID().replaceAll('-', '')}`
  const client = new MongoClient(uri || 'mongodb://127.0.0.1:27028')
  const live = Esix.layer({ url: Redacted.make(uri || ''), database: name })
  const otherLive = Esix.layer({
    url: Redacted.make(uri || ''),
    database: `${name}_other`
  })
  beforeAll(() => client.connect())
  afterAll(async () => {
    try {
      await client.db(name).dropDatabase()
      await client.db(`${name}_other`).dropDatabase()
    } finally {
      await client.close()
    }
  })
  it('supports typed projections, aggregation, mutations, pagination and stream ordering', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const records = (yield* Esix).model(Record)
        for (const [id, value] of [
          ['a', 10],
          ['b', 20],
          ['c', 30]
        ] as const) {
          yield* records.create({ id, value, group: 'numbers', tags: ['tag'] })
        }
        expect(yield* records.count()).toBe(3)
        expect(yield* records.sum('value')).toBe(60)
        expect(yield* records.average('value')).toBe(20)
        expect(yield* records.min('value')).toBe(10)
        expect(yield* records.max('value')).toBe(30)
        expect(yield* records.percentile('value', 50)).toBe(20)
        expect(yield* records.distinct('group')).toEqual(['numbers'])
        expect(
          yield* records.orderBy('value', 'desc').limit(1).pluck('value')
        ).toEqual([30])
        expect((yield* records.paginate(2, 2)).data.map((r) => r.id)).toEqual([
          'c'
        ])
        expect(Option.isSome(yield* records.findBy('value', 10))).toBe(true)
        expect(Option.isSome(yield* records.findOne({ id: 'a' }))).toBe(true)
        yield* records.where('id', 'a').increment('value', 2)
        yield* records.where('id', 'a').decrement('value')
        expect(yield* records.where('id', 'a').pluck('value')).toEqual([11])
        expect(
          yield* records.aggregate([
            { $match: { group: 'numbers' } },
            { $count: 'total' }
          ])
        ).toEqual([{ total: 3 }])
        const stream = records.orderBy('id', 'desc').skip(1).limit(1).stream(2)
        for (let i = 0; i < 2; i++) {
          const rows = yield* Stream.runCollect(stream)
          expect(Chunk.toReadonlyArray(rows).map((r) => r.id)).toEqual([
            'a',
            'b',
            'c'
          ])
        }
        expect(yield* records.whereNotIn('id', ['a']).delete()).toBe(2)
        expect(
          yield* records.whereIn('id', ['a']).whereNotNull('value').count()
        ).toBe(1)
        expect(yield* records.whereNull('value').count()).toBe(0)
        const invalid = yield* records
          .stream(0)
          .pipe(Stream.runDrain, Effect.flip)
        expect(invalid._tag).toBe('EsixQueryError')
      }).pipe(Effect.provide(live))
    )
  })
  it('preserves native BSON identity when saving a hydrated model', async () => {
    const id = new ObjectId()
    await client.db(name).collection('records').insertOne({ _id: id, value: 4 })
    await Effect.runPromise(
      Effect.gen(function* () {
        const records = (yield* Esix).model(Record)
        const record = yield* records.find(id.toHexString())
        expect(Option.isSome(record)).toBe(true)
        if (Option.isSome(record))
          yield* records.update(record.value, { value: 7 })
      }).pipe(Effect.provide(live))
    )
    expect(
      (await client.db(name).collection('records').findOne({ _id: id }))?.value
    ).toBe(7)
  })
  it('handles unique-index violations with catchTag on the module-level API', async () => {
    await client
      .db(name)
      .collection('records')
      .createIndex(
        { group: 1 },
        { unique: true, partialFilterExpression: { group: 'unique' } }
      )
    const records = Esix.model(Record)
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* records.create({ group: 'unique' })
        return yield* records
          .create({ group: 'unique' })
          .pipe(
            Effect.catchTag('EsixDuplicateKeyError', (error) =>
              Effect.succeed(error.code)
            )
          )
      }).pipe(Effect.provide(live))
    )
    expect(result).toBe(11000)
  })
  it('keeps concurrent owned Layers independent and preserves a borrowed client', async () => {
    const write = (value: number) =>
      Effect.gen(function* () {
        const records = (yield* Esix).model(Record)
        return yield* records.create({ id: 'isolated', value })
      })
    await Effect.runPromise(
      Effect.all(
        [
          write(1).pipe(Effect.provide(live)),
          write(2).pipe(Effect.provide(otherLive))
        ],
        { concurrency: 'unbounded' }
      )
    )
    expect(
      (
        await client
          .db(name)
          .collection('records')
          .findOne({ _id: 'isolated' as any })
      )?.value
    ).toBe(1)
    expect(
      (
        await client
          .db(`${name}_other`)
          .collection('records')
          .findOne({ _id: 'isolated' as any })
      )?.value
    ).toBe(2)
    await Effect.runPromise(
      Effect.gen(function* () {
        return yield* (yield* Esix).model(Record).count()
      }).pipe(Effect.provide(Esix.layerFromDb(client.db(name))))
    )
    expect(await client.db(name).command({ ping: 1 })).toMatchObject({ ok: 1 })
  })
})
