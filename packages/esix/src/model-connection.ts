import type { Db } from 'mongodb'
import type BaseModel from './base-model'

/** A database provider for queries and the models they hydrate. */
export interface QueryConnection {
  getConnection(): Promise<Db>
  readonly adapter?: 'default' | 'mock'
}

const connections = new WeakMap<BaseModel, QueryConnection>()
export const connectionFor = (model: BaseModel): QueryConnection | undefined =>
  connections.get(model)

export function bindConnection<T extends BaseModel>(
  model: T,
  connection: QueryConnection
): T {
  const previous = connections.get(model)
  if (previous && previous !== connection)
    throw new Error('Model belongs to a different connection')
  connections.set(model, connection)
  return model
}
