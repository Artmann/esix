import { describe, expect, it, vi } from 'vitest'
import { BaseModel, QueryBuilder } from './index'
class Measurement extends BaseModel {
  value = 0
}
describe('large numeric reductions', () => {
  it.each(['min', 'max'] as const)(
    '%s handles more values than the JS argument limit',
    async (method) => {
      vi.stubEnv('DB_ADAPTER', 'mock')
      const builder = new QueryBuilder(Measurement)
      vi.spyOn(builder, 'pluck').mockResolvedValue(Array(200000).fill(1))
      expect(await builder[method]('value')).toBe(1)
    }
  )
})
