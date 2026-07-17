import mongodb from 'mongo-mock'
import { v1 as createUuid } from 'uuid'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { BaseModel, setQueryLogger, type QueryLogEntry } from './'
import { connectionHandler } from './connection-handler'
import { withQueryLogging } from './query-logger'

mongodb.max_delay = 1

class Invoice extends BaseModel {
  public amount = 0
  public name = ''
}

describe('Query Logging', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${createUuid()}`
    })
  })

  afterEach(() => {
    setQueryLogger(null)

    delete process.env.DB_LOG_QUERIES

    vi.restoreAllMocks()
  })

  afterAll(() => {
    connectionHandler.closeConnections()
  })

  it('logs insertOne entries for created models', async () => {
    const entries: QueryLogEntry[] = []

    setQueryLogger((entry) => {
      entries.push(entry)
    })

    await Invoice.create({ name: 'INV-001', amount: 100 })

    const entry = entries.find((entry) => entry.operation === 'insertOne')

    expect(entry).toBeDefined()
    expect(entry?.collectionName).toBe('invoices')
    expect(Array.isArray(entry?.args)).toBe(true)
    expect(Number.isFinite(entry?.durationMs)).toBe(true)
    expect(entry?.durationMs).toBeGreaterThanOrEqual(0)
    expect(entry?.error).toBeUndefined()
  })

  it('logs find entries once the cursor is consumed', async () => {
    await Invoice.create({ name: 'INV-002', amount: 25 })
    await Invoice.create({ name: 'INV-002', amount: 75 })

    const entries: QueryLogEntry[] = []

    setQueryLogger((entry) => {
      entries.push(entry)
    })

    const invoices = await Invoice.where('name', 'INV-002')
      .orderBy('amount', 'desc')
      .limit(1)
      .get()

    expect(invoices).toHaveLength(1)
    expect(invoices[0].amount).toBe(75)

    const findEntries = entries.filter((entry) => entry.operation === 'find')

    expect(findEntries).toHaveLength(1)
    expect(findEntries[0].collectionName).toBe('invoices')
    expect(findEntries[0].args[0]).toEqual({ name: 'INV-002' })
    expect(Number.isFinite(findEntries[0].durationMs)).toBe(true)
    expect(findEntries[0].durationMs).toBeGreaterThanOrEqual(0)
  })

  it('logs updateOne entries when a model is saved', async () => {
    const invoice = await Invoice.create({ name: 'INV-003', amount: 10 })

    const existingInvoice = await Invoice.find(invoice.id)

    expect(existingInvoice).not.toBeNull()

    if (!existingInvoice) {
      return
    }

    const entries: QueryLogEntry[] = []

    setQueryLogger((entry) => {
      entries.push(entry)
    })

    existingInvoice.amount = 20

    await existingInvoice.save()

    const entry = entries.find((entry) => entry.operation === 'updateOne')

    expect(entry).toBeDefined()
    expect(entry?.collectionName).toBe('invoices')
    expect(entry?.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('logs aggregate entries', async () => {
    await Invoice.create({ name: 'INV-004', amount: 5 })

    // mongo-mock does not implement aggregate, so stub it with a
    // cursor-like object to exercise the full logging path.
    const connection = await connectionHandler.getConnection()
    const collection = await connection.collection('invoices')

    vi.spyOn(collection, 'aggregate').mockReturnValue({
      toArray: () => Promise.resolve([{ total: 5 }])
    } as any)

    const entries: QueryLogEntry[] = []

    setQueryLogger((entry) => {
      entries.push(entry)
    })

    const stages = [{ $group: { _id: null, total: { $sum: '$amount' } } }]
    const results = await Invoice.aggregate(stages)

    expect(results).toEqual([{ total: 5 }])

    const entry = entries.find((entry) => entry.operation === 'aggregate')

    expect(entry).toBeDefined()
    expect(entry?.collectionName).toBe('invoices')
    expect(entry?.args[0]).toEqual(stages)
    expect(entry?.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('logs to console.debug when DB_LOG_QUERIES is enabled', async () => {
    process.env.DB_LOG_QUERIES = 'true'

    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})

    const invoice = await Invoice.create({ name: 'INV-005', amount: 42 })
    const foundInvoice = await Invoice.find(invoice.id)

    expect(foundInvoice?.name).toBe('INV-005')
    expect(debugSpy).toHaveBeenCalled()

    const messages = debugSpy.mock.calls.map((call) => call[0])

    expect(
      messages.some(
        (message) =>
          typeof message === 'string' &&
          message.includes('invoices.insertOne(') &&
          / took \d+(\.\d+)?ms$/.test(message)
      )
    ).toBe(true)
  })

  it('does not log when logging is disabled', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})

    const invoice = await Invoice.create({ name: 'INV-006', amount: 7 })
    const foundInvoice = await Invoice.find(invoice.id)

    expect(foundInvoice?.name).toBe('INV-006')
    expect(debugSpy).not.toHaveBeenCalled()
  })

  it('prefers the custom logger over the console logger', async () => {
    process.env.DB_LOG_QUERIES = 'true'

    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})

    const entries: QueryLogEntry[] = []

    setQueryLogger((entry) => {
      entries.push(entry)
    })

    await Invoice.create({ name: 'INV-007', amount: 3 })

    expect(entries.length).toBeGreaterThan(0)
    expect(debugSpy).not.toHaveBeenCalled()
  })
})

describe('withQueryLogging', () => {
  it('logs the error and still rejects when an operation fails', async () => {
    const failure = new Error('write failed')

    const fakeCollection = {
      insertOne: (): Promise<never> => Promise.reject(failure)
    }

    const entries: QueryLogEntry[] = []

    const collection = withQueryLogging(fakeCollection, 'books', (entry) => {
      entries.push(entry)
    })

    await expect(collection.insertOne()).rejects.toThrow('write failed')

    expect(entries).toHaveLength(1)
    expect(entries[0].collectionName).toBe('books')
    expect(entries[0].error).toBe(failure)
    expect(entries[0].operation).toBe('insertOne')
    expect(entries[0].durationMs).toBeGreaterThanOrEqual(0)
  })

  it('logs a chained find exactly once with the original arguments', async () => {
    const documents = [{ title: 'Dune' }]

    interface FakeCursor {
      limit: (count: number) => FakeCursor
      sort: (order: Record<string, number>) => FakeCursor
      toArray: () => Promise<Record<string, string>[]>
    }

    const fakeCursor: FakeCursor = {
      limit: () => fakeCursor,
      sort: () => fakeCursor,
      toArray: () => Promise.resolve(documents)
    }

    const fakeCollection = {
      find: (query: Record<string, unknown>): FakeCursor => {
        expect(query).toEqual({ title: 'Dune' })

        return fakeCursor
      }
    }

    const entries: QueryLogEntry[] = []

    const collection = withQueryLogging(fakeCollection, 'books', (entry) => {
      entries.push(entry)
    })

    const result = await collection
      .find({ title: 'Dune' })
      .sort({ title: 1 })
      .limit(1)
      .toArray()

    expect(result).toEqual(documents)

    expect(entries).toHaveLength(1)
    expect(entries[0].args).toEqual([{ title: 'Dune' }])
    expect(entries[0].collectionName).toBe('books')
    expect(entries[0].operation).toBe('find')
    expect(entries[0].durationMs).toBeGreaterThanOrEqual(0)
  })

  it('passes non-logged properties through untouched', () => {
    const fakeCollection = {
      collectionName: 'books',
      createIndex: (keys: Record<string, number>): string => {
        return `index:${Object.keys(keys).join(',')}`
      },
      namespace: 'library.books'
    }

    const collection = withQueryLogging(fakeCollection, 'books', () => {
      throw new Error('The logger should not be called.')
    })

    expect(collection.collectionName).toBe('books')
    expect(collection.namespace).toBe('library.books')
    expect(collection.createIndex({ title: 1 })).toBe('index:title')
  })
})
