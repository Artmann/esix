import { BSON } from 'mongodb'

// Preserve driver values and undefined without JSON's lossy conversions.
function copy<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== 'object') return value
  if (value instanceof Date) return new Date(value.getTime()) as T
  if (value instanceof RegExp) return new RegExp(value.source, value.flags) as T
  if (Buffer.isBuffer(value)) return Buffer.from(value) as T
  if (value instanceof Uint8Array) return value.slice() as T
  if (value instanceof BSON.BSONValue) {
    return BSON.deserialize(BSON.serialize({ value }), { promoteValues: false })
      .value as T
  }
  if (seen.has(value)) return seen.get(value) as T
  const result = (Array.isArray(value) ? [] : {}) as Record<string, unknown>
  seen.set(value, result)
  for (const key of Object.keys(value)) {
    Object.defineProperty(result, key, {
      value: copy((value as Record<string, unknown>)[key], seen),
      enumerable: true,
      writable: true,
      configurable: true
    })
  }
  return result as T
}

/** Capture now, but report unsupported inputs only when the operation executes. */
export function snapshot<T>(value: T): () => T {
  try {
    const saved = copy(value)
    return () => copy(saved)
  } catch (cause) {
    return () => {
      throw cause
    }
  }
}
