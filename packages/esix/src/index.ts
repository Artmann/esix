import BaseModel from './base-model'
import { ConnectionHandler, connectionHandler } from './connection-handler'
import { getCollectionName, resolveCollectionName } from './naming'
import QueryBuilder, { type Query } from './query-builder'
import {
  setQueryLogger,
  type QueryLogEntry,
  type QueryLogger
} from './query-logger'
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
  getCollectionName,
  resolveCollectionName,
  setQueryLogger
}
export type {
  ComparisonOperator,
  Dictionary,
  Document,
  ObjectType,
  Paginated,
  Query,
  QueryLogEntry,
  QueryLogger,
  QueryValue
}
