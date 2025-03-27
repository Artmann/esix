// Removes keys from object which starts with '$' to help
// avoid NoSQL injections.
export function sanitize<T>(input: T): T | T[] {
  if (!isObject(input)) {
    return input
  }

  if (Array.isArray(input)) {
    return input.map((value) => sanitize(value))
  }

  const keys = Object.keys(input)

  return keys.reduce((carry, key) => {
    if (isString(key) && key.startsWith('$')) {
      return carry
    }

    return {
      ...carry,
      [key]: sanitize((input as Record<string, any>)[key])
    }
  }, {} as T)
}

function isObject(x: any): x is Record<any, any> {
  return typeof x === 'object' && x !== null
}

function isString(x: any): x is string {
  return typeof x === 'string' || x instanceof String
}
