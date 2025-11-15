/**
 * Represents a constructor type for a given model class.
 * Used internally for type-safe model instantiation.
 */
export type ObjectType<T> = { new (): T }

/**
 * Represents a generic key-value dictionary object.
 * Used for flexible data structures and query parameters.
 */
export type Dictionary = { [index: string]: any }

/**
 * Represents a MongoDB document structure.
 * Used for raw document data before model instantiation.
 */
export type Document = { [index: string]: any }

/**
 * Comparison operators supported for query conditions.
 * Maps to MongoDB query operators.
 */
export type ComparisonOperator = '=' | '!=' | '<>' | '>' | '>=' | '<' | '<='
