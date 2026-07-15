import BaseModel from './base-model'
import { ConnectionHandler, connectionHandler } from './connection-handler'
import { getCollectionName } from './naming'
import QueryBuilder, { type Query } from './query-builder'
import {
  type ComparisonOperator,
  type ObjectType,
  type Dictionary,
  type Document,
  type Paginated
} from './types'

export {
  BaseModel,
  ConnectionHandler,
  QueryBuilder,
  connectionHandler,
  getCollectionName
}
export type {
  ComparisonOperator,
  Query,
  ObjectType,
  Dictionary,
  Document,
  Paginated
}
