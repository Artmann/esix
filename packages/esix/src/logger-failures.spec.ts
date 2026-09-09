import { describe, expect, it } from 'vitest'
import { withQueryLogging, type QueryLogEntry } from './query-logger'
describe('logger failure isolation', () => {
  it('isolates asynchronous logger rejection', async () => {
    const wrapped = withQueryLogging(
      { updateOne: async () => 42 },
      'records',
      async () => {
        throw new Error('logger offline')
      }
    )
    expect(await wrapped.updateOne()).toBe(42)
    await new Promise((resolve) => setImmediate(resolve))
  })
  it('logs a synchronous driver failure and preserves its identity', async () => {
    const error = new Error('driver failure')
    const entries: QueryLogEntry[] = []
    const wrapped = withQueryLogging(
      {
        updateOne: () => {
          throw error
        }
      },
      'records',
      (entry) => entries.push(entry)
    )
    expect(() => wrapped.updateOne()).toThrow(error)
    expect(entries).toHaveLength(1)
    expect(entries[0].error).toBe(error)
  })
})
