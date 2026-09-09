import { Effect, Option, Stream } from 'effect'
import type {
  BaseModel,
  QueryBuilder,
  Query,
  ComparisonOperator,
  QueryValue,
  NumericKey
} from 'esix'
import { queryEffect, queryError } from './errors'
import { snapshot } from './snapshot'

/** An immutable query description. Each execution creates a fresh core builder. */
export class EffectQuery<T extends BaseModel> {
  constructor(
    protected readonly make: () => QueryBuilder<T>,
    protected readonly collectionName: string
  ) {}

  protected derive(
    change: (query: QueryBuilder<T>) => QueryBuilder<T>
  ): EffectQuery<T> {
    return new EffectQuery(() => change(this.make()), this.collectionName)
  }

  where(query: Query): EffectQuery<T>
  where<K extends keyof T>(key: K, value: QueryValue<T[K]>): EffectQuery<T>
  where<K extends keyof T>(
    key: K,
    operator: ComparisonOperator,
    value: QueryValue<T[K]>
  ): EffectQuery<T>
  where(
    queryOrKey: Query | keyof T,
    operatorOrValue?: unknown,
    value?: unknown
  ): EffectQuery<T> {
    const args = snapshot([queryOrKey, operatorOrValue, value] as const)
    return this.derive((query) => {
      const [key, op, val] = args()
      if (typeof key === 'object') return query.where(key)
      return val === undefined
        ? query.where(key, op as QueryValue<T[keyof T]>)
        : query.where(
            key,
            op as ComparisonOperator,
            val as QueryValue<T[keyof T]>
          )
    })
  }

  orWhere(query: Query): EffectQuery<T>
  orWhere<K extends keyof T>(key: K, value: QueryValue<T[K]>): EffectQuery<T>
  orWhere<K extends keyof T>(
    key: K,
    operator: ComparisonOperator,
    value: QueryValue<T[K]>
  ): EffectQuery<T>
  orWhere(
    queryOrKey: Query | keyof T,
    operatorOrValue?: unknown,
    value?: unknown
  ): EffectQuery<T> {
    const args = snapshot([queryOrKey, operatorOrValue, value] as const)
    return this.derive((query) => {
      const [key, op, val] = args()
      if (typeof key === 'object') return query.orWhere(key)
      return val === undefined
        ? query.orWhere(key, op as QueryValue<T[keyof T]>)
        : query.orWhere(
            key,
            op as ComparisonOperator,
            val as QueryValue<T[keyof T]>
          )
    })
  }

  whereIn<K extends keyof T>(
    key: K,
    values: QueryValue<T[K]>[]
  ): EffectQuery<T> {
    const captured = snapshot(values)
    return this.derive((query) => query.whereIn(key, captured()))
  }
  whereNotIn<K extends keyof T>(
    key: K,
    values: QueryValue<T[K]>[]
  ): EffectQuery<T> {
    const captured = snapshot(values)
    return this.derive((query) => query.whereNotIn(key, captured()))
  }
  whereNull<K extends keyof T>(key: K): EffectQuery<T> {
    return this.derive((query) => query.whereNull(key))
  }
  whereNotNull<K extends keyof T>(key: K): EffectQuery<T> {
    return this.derive((query) => query.whereNotNull(key))
  }
  orderBy<K extends keyof T>(
    key: K,
    order: 'asc' | 'desc' = 'asc'
  ): EffectQuery<T> {
    return this.derive((query) => query.orderBy(key, order))
  }
  limit(length: number): EffectQuery<T> {
    return this.derive((query) => query.limit(length))
  }
  skip(length: number): EffectQuery<T> {
    return this.derive((query) => query.skip(length))
  }
  search(text: string, caseSensitive = false): EffectQuery<T> {
    return this.derive((query) => query.search(text, caseSensitive))
  }
  stream(batchSize = 1000) {
    return Stream.unwrap(
      Effect.try({
        try: () =>
          Stream.fromAsyncIterable(this.make().cursor(batchSize), (cause) =>
            queryError('stream', this.collectionName, cause)
          ),
        catch: (cause) => queryError('stream', this.collectionName, cause)
      })
    )
  }
  get() {
    return queryEffect('get', this.collectionName, () => this.make().get())
  }
  count() {
    return queryEffect('count', this.collectionName, () => this.make().count())
  }
  delete() {
    return queryEffect('delete', this.collectionName, () =>
      this.make().delete()
    )
  }
  first() {
    return queryEffect('first', this.collectionName, () =>
      this.make().first()
    ).pipe(Effect.map(Option.fromNullable))
  }
  find(id: string) {
    return queryEffect('find', this.collectionName, () =>
      this.make().find(id)
    ).pipe(Effect.map(Option.fromNullable))
  }
  findOne(query: Query) {
    const captured = snapshot(query)
    return queryEffect('findOne', this.collectionName, () =>
      this.make().findOne(captured())
    ).pipe(Effect.map(Option.fromNullable))
  }
  findBy<K extends keyof T>(key: K, value: QueryValue<T[K]>) {
    return this.where(key, value).first()
  }
  paginate(page: number, perPage: number) {
    return queryEffect('paginate', this.collectionName, () =>
      this.make().paginate(page, perPage)
    )
  }
  pluck<K extends keyof T>(key: K) {
    return queryEffect('pluck', this.collectionName, () =>
      this.make().pluck(key)
    )
  }
  distinct<K extends keyof T>(key: K) {
    return queryEffect('distinct', this.collectionName, () =>
      this.make().distinct(key)
    )
  }
  sum<K extends keyof T>(key: K) {
    return queryEffect('sum', this.collectionName, () => this.make().sum(key))
  }
  average<K extends keyof T>(key: K) {
    return queryEffect('average', this.collectionName, () =>
      this.make().average(key)
    )
  }
  min<K extends keyof T>(key: K) {
    return queryEffect('min', this.collectionName, () => this.make().min(key))
  }
  max<K extends keyof T>(key: K) {
    return queryEffect('max', this.collectionName, () => this.make().max(key))
  }
  percentile<K extends keyof T>(key: K, n: number) {
    return queryEffect('percentile', this.collectionName, () =>
      this.make().percentile(key, n)
    )
  }
  aggregate(stages: Record<string, unknown>[]) {
    const captured = snapshot(stages)
    return queryEffect('aggregate', this.collectionName, () =>
      this.make().aggregate(captured())
    )
  }
  increment<K extends NumericKey<T>>(key: K, by = 1) {
    return queryEffect('increment', this.collectionName, () =>
      this.make().increment(key, by)
    )
  }
  decrement<K extends NumericKey<T>>(key: K, by = 1) {
    return queryEffect('decrement', this.collectionName, () =>
      this.make().decrement(key, by)
    )
  }
}
