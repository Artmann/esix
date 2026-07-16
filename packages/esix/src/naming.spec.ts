import { describe, expect, it } from 'vitest'

import { getCollectionName, resolveCollectionName } from './naming'

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

describe('resolveCollectionName', () => {
  it('returns the custom name when collectionName is set', () => {
    class User {
      static collectionName = 'app_users'
    }

    expect(resolveCollectionName(User)).toEqual('app_users')
  })

  it('falls back to the inferred name when collectionName is unset', () => {
    class BlogPost {}

    expect(resolveCollectionName(BlogPost)).toEqual('blog-posts')
  })

  it('inherits the custom name in subclasses', () => {
    class User {
      static collectionName = 'app_users'
    }
    class AdminUser extends User {}

    expect(resolveCollectionName(AdminUser)).toEqual('app_users')
  })

  it('lets a subclass override the inherited custom name', () => {
    class User {
      static collectionName = 'app_users'
    }
    class AdminUser extends User {
      static collectionName = 'app_admins'
    }

    expect(resolveCollectionName(AdminUser)).toEqual('app_admins')
  })

  it('throws for an empty string', () => {
    class User {
      static collectionName = ''
    }

    expect(() => resolveCollectionName(User)).toThrow(
      new TypeError('User.collectionName must be a non-empty string.')
    )
  })

  it('throws for a whitespace-only string', () => {
    class User {
      static collectionName = '  '
    }

    expect(() => resolveCollectionName(User)).toThrow(
      new TypeError('User.collectionName must be a non-empty string.')
    )
  })
})
