import { performance } from 'node:perf_hooks'
import { randomUUID } from 'node:crypto'
import { BSON, MongoClient } from 'mongodb'
import * as current from '../dist/index.js'

const uri = process.env.ESIX_TEST_MONGODB_URI
if (!uri)
  throw new Error('Set ESIX_TEST_MONGODB_URI to a disposable MongoDB server.')
const baseline = process.env.ESIX_BENCH_BASELINE
  ? await import(process.env.ESIX_BENCH_BASELINE)
  : null
const databaseName = `esix_benchmark_${randomUUID().replaceAll('-', '')}`
process.env.DB_ADAPTER = 'default'
process.env.DB_URL = uri
process.env.DB_DATABASE = databaseName
const originalConnect = MongoClient.connect
const setup = await originalConnect.call(MongoClient, uri)
let sample
MongoClient.connect = async function (url, options) {
  const client = await originalConnect.call(this, url, {
    ...options,
    monitorCommands: true
  })
  client.on('commandSucceeded', (event) => {
    if (!sample) return
    sample.operations++
    const documents =
      event.reply.cursor?.firstBatch ?? event.reply.cursor?.nextBatch ?? []
    sample.documents += documents.length
    sample.bsonBytes += documents.reduce(
      (bytes, document) => bytes + BSON.calculateObjectSize(document),
      0
    )
  })
  return client
}
const rows = []
const count = 20000
const collection = setup.db(databaseName).collection('samples')
async function measure(version, name, run) {
  await run()
  const runs = []
  for (let index = 0; index < 5; index++) {
    global.gc?.()
    const startHeap = process.memoryUsage().heapUsed
    sample = { operations: 0, documents: 0, bsonBytes: 0 }
    const started = performance.now()
    await run()
    runs.push({
      ms: performance.now() - started,
      heapDeltaBytes: process.memoryUsage().heapUsed - startHeap,
      ...sample
    })
    sample = undefined
  }
  const median = (key) => [...runs].sort((a, b) => a[key] - b[key])[2][key]
  rows.push({
    version,
    operation: name,
    medianMs: +median('ms').toFixed(2),
    heapDeltaBytes: median('heapDeltaBytes'),
    operations: median('operations'),
    documents: median('documents'),
    bsonBytes: median('bsonBytes')
  })
}
try {
  await collection.insertMany(
    Array.from({ length: count }, (_, value) => ({
      _id: `record-${String(value).padStart(6, '0')}`,
      value,
      tag: `tag-${value % 10}`,
      payload: 'x'.repeat(1024)
    }))
  )
  for (const [version, library] of [
    ['before', baseline],
    ['after', current]
  ]) {
    if (!library) continue
    class Sample extends library.BaseModel {
      static collectionName = 'samples'
      value = 0
      tag = ''
    }
    await measure(version, 'pluck', () => Sample.pluck('value'))
    await measure(version, 'sum', () => Sample.sum('value'))
    await measure(version, 'distinct', () => Sample.distinct('tag'))
    await measure(version, 'create', async () => {
      class Created extends library.BaseModel {
        static collectionName = 'created'
      }
      await Created.create({})
    })
    await library.connectionHandler.closeConnections()
  }
  console.log(
    JSON.stringify(
      {
        node: process.version,
        documents: count,
        payloadBytes: 1024,
        repetitions: 5,
        instrumentation:
          'command count and returned BSON documents; heap delta is not peak memory',
        rows
      },
      null,
      2
    )
  )
} finally {
  sample = undefined
  MongoClient.connect = originalConnect
  await Promise.all([
    current.connectionHandler.closeConnections(),
    baseline?.connectionHandler.closeConnections()
  ])
  await setup.db(databaseName).dropDatabase()
  await setup.close()
}
