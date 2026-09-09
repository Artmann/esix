import { Effect, Schema } from 'effect'

export class EsixConnectionError extends Schema.TaggedError<EsixConnectionError>()(
  'EsixConnectionError',
  {
    message: Schema.String,
    cause: Schema.Unknown
  }
) {}

export class EsixQueryError extends Schema.TaggedError<EsixQueryError>()(
  'EsixQueryError',
  {
    message: Schema.String,
    operation: Schema.String,
    collection: Schema.String,
    cause: Schema.Unknown
  }
) {}

export function queryError(
  operation: string,
  collection: string,
  cause: unknown
): EsixQueryError {
  return cause instanceof EsixQueryError
    ? cause
    : new EsixQueryError({
        message: `Esix ${operation} failed`,
        operation,
        collection,
        cause
      })
}

export function queryEffect<A>(
  operation: string,
  collection: string,
  run: () => Promise<A>
): Effect.Effect<A, EsixQueryError> {
  return Effect.tryPromise({
    try: run,
    catch: (cause) => queryError(operation, collection, cause)
  }).pipe(Effect.withSpan(`Esix.${operation}`))
}
