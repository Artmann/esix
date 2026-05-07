import { describe, expect, it } from 'vitest'

import { getCollectionName } from './naming'

describe('getCollectionName', () => {
  it.each([
    ['User', 'users'],
    ['BlogPost', 'blog-posts'],
    ['URL', 'urls'],
    ['A', 'as'],
    ['User2', 'user2s'],
    ['OAuthToken', 'o-auth-tokens']
  ])('maps %s -> %s', (className, expected) => {
    expect(getCollectionName(className)).toEqual(expected)
  })
})
