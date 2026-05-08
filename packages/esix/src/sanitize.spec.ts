import { describe, expect, it } from 'vitest'

import { sanitize } from './sanitize'

describe('sanitize', () => {
  it('handles objects.', () => {
    const query = {
      password: 'hunter1',
      username: 'john'
    }

    expect(sanitize(query)).toEqual({
      password: 'hunter1',
      username: 'john'
    })
  })

  it('removes keys starting with $.', () => {
    const query = {
      password: { $ne: null },
      username: { $ne: null }
    }

    expect(sanitize(query)).toEqual({
      password: {},
      username: {}
    })
  })

  it.each([
    [null],
    [undefined],
    [32],
    [['5f0aeaeacff57e3ec676b340', '5f0aefba348289a81889a920']],
    ['Hello World'],
    [true],
    [false]
  ])('does not modify %p values.', (value) => {
    expect(sanitize(value)).toEqual(value)
  })

  it('strips operators nested under safe keys.', () => {
    expect(sanitize({ user: { $ne: null } })).toEqual({ user: {} })
  })

  it('strips operator-only objects inside arrays while keeping safe entries.', () => {
    expect(sanitize([{ $gt: 0 }, { id: 1 }])).toEqual([{}, { id: 1 }])
  })

  it.each([['$gt'], ['$lt'], ['$regex'], ['$where'], ['$function'], ['$expr']])(
    'strips %s operator at any depth.',
    (operator) => {
      const input = {
        level1: {
          level2: {
            [operator]: 'malicious',
            safe: 'ok'
          }
        }
      }

      expect(sanitize(input)).toEqual({
        level1: {
          level2: {
            safe: 'ok'
          }
        }
      })
    }
  )

  it('throws when input nesting exceeds the depth limit.', () => {
    let nested: Record<string, unknown> = {}
    const root = nested

    for (let i = 0; i < 100; i++) {
      const next: Record<string, unknown> = {}
      nested.next = next
      nested = next
    }

    expect(() => sanitize(root)).toThrow(/maximum depth/)
  })
})
