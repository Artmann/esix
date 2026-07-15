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

/**
 * The values accepted when querying a field of type `V`. Scalar fields
 * accept `V` itself. Array fields also accept their element type, since
 * MongoDB matches documents where the array contains the given value.
 */
export type QueryValue<V> = V | (V extends readonly (infer E)[] ? E : never)

/**
 * Result of QueryBuilder.paginate() / BaseModel.paginate(). Bundles the
 * page of models with the metadata needed to render pagination UIs.
 */
export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  perPage: number
  lastPage: number
}
