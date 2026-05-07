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

  const keys = Object.keys(input)

  return keys.reduce((carry, key) => {
    if (isString(key) && key.startsWith('$')) {
      return carry
    }

    return {
      ...carry,
      [key]: _sanitize((input as Record<string, any>)[key], depth + 1)
    }
  }, {} as T)
}

function isObject(x: any): x is Record<any, any> {
  return typeof x === 'object' && x !== null
}

function isString(x: any): x is string {
  return typeof x === 'string' || x instanceof String
}
