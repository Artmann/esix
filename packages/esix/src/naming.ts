import * as changeCase from 'change-case'
import pluralize from 'pluralize'

/**
 * Returns the canonical MongoDB collection name for a model class name.
 * Example: `BlogPost` → `blog-posts`.
 */
export function getCollectionName(className: string): string {
  return pluralize(changeCase.kebabCase(className))
}
