import BaseModel from './base-model'
import { ConnectionHandler, connectionHandler } from './connection-handler'
import { getCollectionName } from './naming'
import QueryBuilder, { type Query } from './query-builder'
import {
  type ComparisonOperator,
  type Dictionary,
  type Document,
  type ObjectType,
  type Paginated,
  type QueryValue
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
  Dictionary,
  Document,
  ObjectType,
  Paginated,
  Query,
  QueryValue
}
