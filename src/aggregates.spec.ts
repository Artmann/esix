import mongodb from 'mongo-mock'
import { v1 as createUuid } from 'uuid'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { BaseModel } from './'
import { connectionHandler } from './connection-handler'

mongodb.max_delay = 1

class ResponseTime extends BaseModel {
  public value = 0
  public statusCode = 200
  public endpoint = 'index'
}

describe('Aggregate Functions', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${createUuid()}`
    })
  })

  afterAll(() => {
    connectionHandler.closeConnections()
  })

  describe('Sum', () => {
    it('sums up the values for a given key.', async () => {
      await Promise.all([
        ResponseTime.create({ statusCode: 200, value: 34 }),
        ResponseTime.create({ statusCode: 200, value: 45 }),
        ResponseTime.create({ statusCode: 200, value: 22.1 }),
        ResponseTime.create({ statusCode: 200, value: 99 }),
        ResponseTime.create({ statusCode: 200, value: 129 })
      ])

      const sum = await ResponseTime.where('statusCode', 200).sum('value')

      expect(sum).toEqual(329.1)
    })
  })

  describe('Count', () => {
    it('returns the number of matching records.', async () => {
      await Promise.all([
        ResponseTime.create({ statusCode: 200, value: 34 }),
        ResponseTime.create({ statusCode: 200, value: 45 }),
        ResponseTime.create({ statusCode: 404, value: 22.1 }),
        ResponseTime.create({ statusCode: 503, value: 99 }),
        ResponseTime.create({ statusCode: 200, value: 129 })
      ])

      const count = await ResponseTime.where('statusCode', 200).count()

      expect(count).toEqual(3)
    })

    it('returns zero when there are no matching records.', async () => {
      await Promise.all([
        ResponseTime.create({ statusCode: 200, value: 34 }),
        ResponseTime.create({ statusCode: 200, value: 45 }),
        ResponseTime.create({ statusCode: 404, value: 22.1 }),
        ResponseTime.create({ statusCode: 503, value: 99 }),
        ResponseTime.create({ statusCode: 200, value: 129 })
      ])

      const count = await ResponseTime.where('statusCode', 418).count()

      expect(count).toEqual(0)
    })
  })

  describe('Max', () => {
    it('returns the biggest value for a given key.', async () => {
      await Promise.all([
        ResponseTime.create({ statusCode: 200, value: 34 }),
        ResponseTime.create({ statusCode: 200, value: 45 }),
        ResponseTime.create({ statusCode: 200, value: 22.1 }),
        ResponseTime.create({ statusCode: 200, value: 99 }),
        ResponseTime.create({ statusCode: 200, value: 129 })
      ])

      const max = await ResponseTime.where('statusCode', 200).max('value')

      expect(max).toEqual(129)
    })

    it('works which large collections.', async () => {
      const promises = []

      for (let i = 0; i < 500; i++) {
        const promise = ResponseTime.create({ statusCode: 200, value: i })

        promises.push(promise)
      }

      await Promise.all(promises)

      const max = await ResponseTime.where('statusCode', 200).max('value')

      expect(max).toEqual(499)
    })
  })

  describe('Min', () => {
    it('returns the smallest value for a given key.', async () => {
      await Promise.all([
        ResponseTime.create({ statusCode: 200, value: 34 }),
        ResponseTime.create({ statusCode: 200, value: 45 }),
        ResponseTime.create({ statusCode: 200, value: 22.1 }),
        ResponseTime.create({ statusCode: 200, value: 99 }),
        ResponseTime.create({ statusCode: 200, value: 129 })
      ])

      const min = await ResponseTime.where('statusCode', 200).min('value')

      expect(min).toEqual(22.1)
    })

    it('works which large collections.', async () => {
      const promises = []

      for (let i = 0; i < 500; i++) {
        const promise = ResponseTime.create({ statusCode: 200, value: i })

        promises.push(promise)
      }

      await Promise.all(promises)

      const min = await ResponseTime.where('statusCode', 200).min('value')

      expect(min).toEqual(0)
    })
  })

  describe('Average', () => {
    it('returns the average value for a given key.', async () => {
      await Promise.all([
        ResponseTime.create({ statusCode: 200, value: 78 }),
        ResponseTime.create({ statusCode: 200, value: 265 }),
        ResponseTime.create({ statusCode: 200, value: 401 }),
        ResponseTime.create({ statusCode: 200, value: 126 }),
        ResponseTime.create({ statusCode: 200, value: 232 }),
        ResponseTime.create({ statusCode: 200, value: 154 }),
        ResponseTime.create({ statusCode: 200, value: 226 }),
        ResponseTime.create({ statusCode: 200, value: 196 }),
        ResponseTime.create({ statusCode: 200, value: 1 })
      ])

      const average = await ResponseTime.where('statusCode', 200).average(
        'value'
      )

      expect(average).toEqual(186.55555555555554)
    })

    it('works without values.', async () => {
      const average = await ResponseTime.where('statusCode', 200).average(
        'value'
      )

      expect(average).toEqual(0)
    })
  })

  describe('Percentile', () => {
    it('works without values.', async () => {
      const median = await ResponseTime.where('statusCode', 200).percentile(
        'value',
        50
      )

      expect(median).toEqual(0)
    })

    it('returns the median value for a given key.', async () => {
      await Promise.all([
        ResponseTime.create({ statusCode: 200, value: 78 }),
        ResponseTime.create({ statusCode: 200, value: 265 }),
        ResponseTime.create({ statusCode: 200, value: 401 }),
        ResponseTime.create({ statusCode: 200, value: 126 }),
        ResponseTime.create({ statusCode: 200, value: 232 }),
        ResponseTime.create({ statusCode: 200, value: 154 }),
        ResponseTime.create({ statusCode: 200, value: 226 }),
        ResponseTime.create({ statusCode: 200, value: 196 }),
        ResponseTime.create({ statusCode: 200, value: 1 })
      ])

      const median = await ResponseTime.where('statusCode', 200).percentile(
        'value',
        50
      )

      expect(median).toEqual(196)
    })

    it('returns the 75th percentile for a given key.', async () => {
      await Promise.all([
        ResponseTime.create({ statusCode: 200, value: 78 }),
        ResponseTime.create({ statusCode: 200, value: 265 }),
        ResponseTime.create({ statusCode: 200, value: 401 }),
        ResponseTime.create({ statusCode: 200, value: 126 }),
        ResponseTime.create({ statusCode: 200, value: 232 }),
        ResponseTime.create({ statusCode: 200, value: 154 }),
        ResponseTime.create({ statusCode: 200, value: 226 }),
        ResponseTime.create({ statusCode: 200, value: 196 }),
        ResponseTime.create({ statusCode: 200, value: 1 })
      ])

      const percentile = await ResponseTime.where('statusCode', 200).percentile(
        'value',
        75
      )

      expect(percentile).toEqual(232)
    })

    it('returns the 99th percentile for a given key.', async () => {
      await Promise.all([
        ResponseTime.create({ statusCode: 200, value: 78 }),
        ResponseTime.create({ statusCode: 200, value: 265 }),
        ResponseTime.create({ statusCode: 200, value: 401 }),
        ResponseTime.create({ statusCode: 200, value: 126 }),
        ResponseTime.create({ statusCode: 200, value: 232 }),
        ResponseTime.create({ statusCode: 200, value: 154 }),
        ResponseTime.create({ statusCode: 200, value: 226 }),
        ResponseTime.create({ statusCode: 200, value: 196 }),
        ResponseTime.create({ statusCode: 200, value: 1 })
      ])

      const percentile = await ResponseTime.where('statusCode', 200).percentile(
        'value',
        99
      )

      expect(percentile).toEqual(401)
    })
  })
})
