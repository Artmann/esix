import * as changeCase from 'change-case'
import pluralize from 'pluralize'

import type { ObjectType } from './types'

/**
 * Returns the canonical MongoDB collection name for a model class name.
 * Example: `BlogPost` → `blog-posts`.
 */
export function getCollectionName(className: string): string {
  return pluralize(changeCase.kebabCase(className))
}

/**
 * Returns the MongoDB collection name for a model class. Uses the class's
 * static `collectionName` property when set, and falls back to the name
 * inferred from the class name otherwise.
 *
 * @param ctor The model class to resolve the collection name for.
 * @returns The collection name to use for the model.
 * @throws {TypeError} If `collectionName` is set but isn't a non-empty string.
 */
export function resolveCollectionName<T>(ctor: ObjectType<T>): string {
  const { collectionName } = ctor

  if (collectionName === undefined) {
    return getCollectionName(ctor.name)
  }

  if (typeof collectionName !== 'string' || collectionName.trim() === '') {
    throw new TypeError(
      `${ctor.name}.collectionName must be a non-empty string.`
    )
  }

  return collectionName
}
