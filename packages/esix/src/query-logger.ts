import { env } from './env'

/**
 * Describes a single MongoDB operation performed by esix.
 */
export interface QueryLogEntry {
  /**
   * The arguments that were passed to the driver method.
   */
  args: unknown[]

  /**
   * The name of the collection the operation ran against.
   */
  collectionName: string

  /**
   * How long the operation took to complete, in milliseconds.
   */
  durationMs: number

  /**
   * The error the operation rejected with, if any. The rejection still
   * propagates to the caller.
   */
  error?: unknown

  /**
   * The name of the driver method that was invoked, e.g. `updateOne`.
   */
  operation: string
}

/**
 * A function that receives a `QueryLogEntry` for every MongoDB operation
 * esix runs. Errors thrown by the logger are ignored, so a faulty logger
 * never changes the outcome of the operation it observes.
 */
export type QueryLogger = (entry: QueryLogEntry) => void

type AnyFunction = (...args: unknown[]) => unknown

interface CursorLogContext {
  args: unknown[]
  collectionName: string
  logger: QueryLogger
  operation: string
  startedAt: number
}

const CURSOR_OPERATIONS: ReadonlySet<string> = new Set(['aggregate', 'find'])

const PROMISE_OPERATIONS: ReadonlySet<string> = new Set([
  'count',
  'deleteMany',
  'deleteOne',
  'findOne',
  'findOneAndUpdate',
  'insertOne',
  'updateMany',
  'updateOne'
])

let customLogger: QueryLogger | null = null

/**
 * Returns the active query logger. A custom logger set with `setQueryLogger`
 * takes precedence. When no custom logger is set and the `DB_LOG_QUERIES`
 * environment variable is `1` or `true` (case-insensitive), a built-in
 * logger that writes to `console.debug` is returned.
 *
 * @returns The active logger, or `null` when query logging is disabled.
 */
export function resolveQueryLogger(): QueryLogger | null {
  if (customLogger) {
    return customLogger
  }

  const flag = env('DB_LOG_QUERIES').toLowerCase()

  if (flag === '1' || flag === 'true') {
    return consoleLogger
  }

  return null
}

/**
 * Sets a custom logger that receives a `QueryLogEntry` for every MongoDB
 * operation esix runs.
 *
 * @param logger The logger to use, or `null` to clear the custom logger.
 */
export function setQueryLogger(logger: QueryLogger | null): void {
  customLogger = logger
}

/**
 * Wraps a collection in a proxy that reports every MongoDB operation to the
 * given logger. Operations that return cursors (`aggregate` and `find`) are
 * logged when the cursor is consumed with `toArray`, so their duration
 * covers the whole operation including any `sort`, `skip`, or `limit`
 * chaining. All other properties pass through untouched.
 *
 * @param collection The collection to wrap.
 * @param collectionName The name of the collection, included in log entries.
 * @param logger The logger to report operations to.
 * @returns A proxy that behaves like the given collection.
 */
export function withQueryLogging<T extends object>(
  collection: T,
  collectionName: string,
  logger: QueryLogger
): T {
  return new Proxy(collection, {
    get(target, property) {
      const value = Reflect.get(target, property) as unknown

      if (typeof value !== 'function') {
        return value
      }

      const method = value as AnyFunction

      if (typeof property === 'string') {
        if (PROMISE_OPERATIONS.has(property)) {
          return createPromiseOperation(
            target,
            property,
            method,
            collectionName,
            logger
          )
        }

        if (CURSOR_OPERATIONS.has(property)) {
          return createCursorOperation(
            target,
            property,
            method,
            collectionName,
            logger
          )
        }
      }

      return method.bind(target)
    }
  })
}

function consoleLogger(entry: QueryLogEntry): void {
  const { args, collectionName, durationMs, operation } = entry

  console.debug(
    `esix ${collectionName}.${operation}(${safeStringify(args)}) took ${durationMs.toFixed(1)}ms`
  )
}

function createCursorOperation(
  target: object,
  operation: string,
  method: AnyFunction,
  collectionName: string,
  logger: QueryLogger
): AnyFunction {
  return (...args: unknown[]) => {
    const startedAt = performance.now()

    const cursor = method.apply(target, args) as object

    return wrapCursor(cursor, {
      args,
      collectionName,
      logger,
      operation,
      startedAt
    })
  }
}

function createPromiseOperation(
  target: object,
  operation: string,
  method: AnyFunction,
  collectionName: string,
  logger: QueryLogger
): (...args: unknown[]) => Promise<unknown> {
  return (...args: unknown[]) => {
    const startedAt = performance.now()

    const result = method.apply(target, args) as Promise<unknown>

    return result.then(
      (value) => {
        safeLog(logger, {
          args,
          collectionName,
          durationMs: performance.now() - startedAt,
          operation
        })

        return value
      },
      (error: unknown) => {
        safeLog(logger, {
          args,
          collectionName,
          durationMs: performance.now() - startedAt,
          error,
          operation
        })

        throw error
      }
    )
  }
}

function safeLog(logger: QueryLogger, entry: QueryLogEntry): void {
  try {
    logger(entry)
  } catch {
    // A faulty logger must never change the outcome of the operation.
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return '[unserializable]'
  }
}

function wrapCursor(cursor: object, context: CursorLogContext): object {
  const { args, collectionName, logger, operation, startedAt } = context

  const proxy: object = new Proxy(cursor, {
    get(target, property) {
      const value = Reflect.get(target, property) as unknown

      if (typeof value !== 'function') {
        return value
      }

      const method = value as AnyFunction

      if (property === 'toArray') {
        return (...toArrayArgs: unknown[]) => {
          const result = method.apply(target, toArrayArgs) as Promise<unknown>

          return result.then(
            (documents) => {
              safeLog(logger, {
                args,
                collectionName,
                durationMs: performance.now() - startedAt,
                operation
              })

              return documents
            },
            (error: unknown) => {
              safeLog(logger, {
                args,
                collectionName,
                durationMs: performance.now() - startedAt,
                error,
                operation
              })

              throw error
            }
          )
        }
      }

      return (...methodArgs: unknown[]) => {
        const result = method.apply(target, methodArgs)

        return result === target ? proxy : result
      }
    }
  })

  return proxy
}
