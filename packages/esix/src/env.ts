export function env(key: string, defaultValue = ''): string {
  const value = process.env[key]

  return value || defaultValue
}
