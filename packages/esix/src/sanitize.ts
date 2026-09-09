import { BSON } from 'mongodb'

// Removes keys from object which starts with '$' to help
// avoid NoSQL injections.
const MAX_DEPTH = 32

export function sanitize<T>(input: T): T | T[] {
  return _sanitize(input, 0)
}

function _sanitize<T>(input: T, depth: number): T | T[] {
  if (depth > MAX_DEPTH) {
    throw new Error(
      `sanitize() exceeded maximum depth of ${MAX_DEPTH}. Input is too deeply nested.`
    )
  }

  if (!isObject(input)) {
    return input
  }

  if (Array.isArray(input)) {
    return input.map((value) => _sanitize(value, depth + 1))
  }

  if (
    input instanceof Date ||
    input instanceof RegExp ||
    input instanceof Uint8Array ||
    input instanceof BSON.BSONValue
  ) {
    return input
  }

  const keys = Object.keys(input)

  const result: Record<string, unknown> = {}
  for (const key of keys) {
    if (key.startsWith('$')) continue
    Object.defineProperty(result, key, {
      value: _sanitize(input[key], depth + 1),
      enumerable: true,
      configurable: true,
      writable: true
    })
  }
  return result as T
}

function isObject(x: any): x is Record<any, any> {
  return typeof x === 'object' && x !== null
}
