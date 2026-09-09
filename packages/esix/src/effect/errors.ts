import { Effect, Schema } from 'effect'

const connectionFields = {
  message: Schema.String,
  code: Schema.optional(Schema.Number)
}
const operationFields = {
  ...connectionFields,
  operation: Schema.String,
  collection: Schema.String
}

export class EsixConnectionError extends Schema.TaggedError<EsixConnectionError>()(
  'EsixConnectionError',
  connectionFields
) {
  declare readonly cause: unknown
}
export class EsixQueryError extends Schema.TaggedError<EsixQueryError>()(
  'EsixQueryError',
  operationFields
) {
  declare readonly cause: unknown
}
export class EsixDuplicateKeyError extends Schema.TaggedError<EsixDuplicateKeyError>()(
  'EsixDuplicateKeyError',
  operationFields
) {
  declare readonly cause: unknown
}
export class EsixTimeoutError extends Schema.TaggedError<EsixTimeoutError>()(
  'EsixTimeoutError',
  operationFields
) {
  declare readonly cause: unknown
}
export class EsixModelBindingError extends Schema.TaggedError<EsixModelBindingError>()(
  'EsixModelBindingError',
  {
    ...operationFields,
    reason: Schema.Literal('constructor', 'connection')
  }
) {
  declare readonly cause: unknown
}

export type EsixOperationError =
  | EsixQueryError
  | EsixDuplicateKeyError
  | EsixTimeoutError
  | EsixModelBindingError

// Retain diagnostics in-process without serializing arbitrary driver objects.
function withCause<E extends Error>(error: E, cause: unknown): E {
  return Object.defineProperty(error, 'cause', {
    value: cause,
    enumerable: false
  })
}
function driverCode(cause: unknown): number | undefined {
  if (
    cause &&
    typeof cause === 'object' &&
    'code' in cause &&
    typeof cause.code === 'number'
  )
    return cause.code
  return undefined
}
export function connectionError(cause: unknown): EsixConnectionError {
  return withCause(
    new EsixConnectionError({
      message: 'Esix connection failed',
      code: driverCode(cause)
    }),
    cause
  )
}
export function bindingError(
  collection: string,
  reason: 'constructor' | 'connection',
  cause: unknown
): EsixModelBindingError {
  return withCause(
    new EsixModelBindingError({
      message: `Model has a different ${reason}`,
      operation: 'bindModel',
      collection,
      reason
    }),
    cause
  )
}
export function queryError(
  operation: string,
  collection: string,
  cause: unknown
): EsixOperationError {
  if (
    cause instanceof EsixQueryError ||
    cause instanceof EsixDuplicateKeyError ||
    cause instanceof EsixTimeoutError ||
    cause instanceof EsixModelBindingError
  )
    return cause
  const code = driverCode(cause)
  const fields = {
    message: `Esix ${operation} on ${collection} failed${code === undefined ? '' : ` (MongoDB code ${code})`}`,
    operation,
    collection,
    code
  }
  if (code === 11000) return withCause(new EsixDuplicateKeyError(fields), cause)
  const name = cause instanceof Error ? cause.name : undefined
  if (
    code === 50 ||
    code === 262 ||
    name === 'MongoNetworkTimeoutError' ||
    name === 'MongoOperationTimeoutError'
  )
    return withCause(new EsixTimeoutError(fields), cause)
  return withCause(new EsixQueryError(fields), cause)
}

export function queryEffect<A>(
  operation: string,
  collection: string,
  run: () => Promise<A>
): Effect.Effect<A, EsixOperationError> {
  return Effect.tryPromise({
    try: run,
    catch: (cause) => queryError(operation, collection, cause)
  }).pipe(
    Effect.withSpan(`Esix.${operation}`, {
      attributes: {
        'db.system': 'mongodb',
        'db.collection.name': collection,
        'db.operation.name': operation
      }
    })
  )
}
