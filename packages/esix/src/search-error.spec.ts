import { describe, expect, it } from 'vitest'

import { isTextIndexMissingError } from './query-builder'

describe('isTextIndexMissingError', () => {
  it('returns false when the query does not use $text.', () => {
    const error = Object.assign(new Error('text index required for $text query'), {
      code: 27,
      codeName: 'IndexNotFound'
    })

    expect(isTextIndexMissingError(error, { name: 'foo' })).toEqual(false)
  })

  it('returns true when the error has Mongo code 27.', () => {
    const error = Object.assign(new Error('something went wrong'), {
      code: 27,
      codeName: 'IndexNotFound'
    })

    expect(isTextIndexMissingError(error, { $text: { $search: 'foo' } })).toEqual(
      true
    )
  })

  it('returns true when the error message names the missing text index.', () => {
    const error = new Error('text index required for $text query')

    expect(isTextIndexMissingError(error, { $text: { $search: 'foo' } })).toEqual(
      true
    )
  })

  it('returns false for unrelated $text errors so the original error survives.', () => {
    const error = new Error('something else went wrong while running $text')

    expect(isTextIndexMissingError(error, { $text: { $search: 'foo' } })).toEqual(
      false
    )
  })

  it('handles non-Error throwables without crashing.', () => {
    expect(
      isTextIndexMissingError('plain string', { $text: { $search: 'foo' } })
    ).toEqual(false)
    expect(isTextIndexMissingError(null, { $text: { $search: 'foo' } })).toEqual(
      false
    )
  })
})
