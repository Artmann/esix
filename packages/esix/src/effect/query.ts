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
export class EffectQuery<T extends BaseModel, R = never> {
  protected readonly make: Effect.Effect<() => QueryBuilder<T>, never, R>
  /** @internal Use Esix.model() or the provided service's model() accessor. */
  constructor(
    make:
      | (() => QueryBuilder<T>)
      | Effect.Effect<() => QueryBuilder<T>, never, R>,
    protected readonly collectionName: string
  ) {
    this.make = typeof make === 'function' ? Effect.succeed(make) : make
  }

  protected derive(
    change: (query: QueryBuilder<T>) => QueryBuilder<T>
  ): EffectQuery<T, R> {
    return new EffectQuery(
      Effect.map(this.make, (make) => () => change(make())),
      this.collectionName
    )
  }

  protected execute<A>(
    operation: string,
    run: (query: QueryBuilder<T>) => Promise<A>,
    collection = this.collectionName
  ) {
    return Effect.flatMap(this.make, (make) =>
      queryEffect(operation, collection, () => run(make()))
    )
  }

  where(query: Query): EffectQuery<T, R>
  where<K extends keyof T>(key: K, value: QueryValue<T[K]>): EffectQuery<T, R>
  where<K extends keyof T>(
    key: K,
    operator: ComparisonOperator,
    value: QueryValue<T[K]>
  ): EffectQuery<T, R>
  where(
    queryOrKey: Query | keyof T,
    operatorOrValue?: unknown,
    value?: unknown
  ): EffectQuery<T, R> {
    const keyArg = snapshot(queryOrKey)
    const opArg = snapshot(operatorOrValue)
    const valueArg = snapshot(value)
    return this.derive((query) => {
      const key = keyArg(),
        op = opArg(),
        val = valueArg()
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

  orWhere(query: Query): EffectQuery<T, R>
  orWhere<K extends keyof T>(key: K, value: QueryValue<T[K]>): EffectQuery<T, R>
  orWhere<K extends keyof T>(
    key: K,
    operator: ComparisonOperator,
    value: QueryValue<T[K]>
  ): EffectQuery<T, R>
  orWhere(
    queryOrKey: Query | keyof T,
    operatorOrValue?: unknown,
    value?: unknown
  ): EffectQuery<T, R> {
    const keyArg = snapshot(queryOrKey)
    const opArg = snapshot(operatorOrValue)
    const valueArg = snapshot(value)
    return this.derive((query) => {
      const key = keyArg(),
        op = opArg(),
        val = valueArg()
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
  ): EffectQuery<T, R> {
    const captured = snapshot(values)
    return this.derive((query) => query.whereIn(key, captured()))
  }
  whereNotIn<K extends keyof T>(
    key: K,
    values: QueryValue<T[K]>[]
  ): EffectQuery<T, R> {
    const captured = snapshot(values)
    return this.derive((query) => query.whereNotIn(key, captured()))
  }
  whereNull<K extends keyof T>(key: K): EffectQuery<T, R> {
    return this.derive((query) => query.whereNull(key))
  }
  whereNotNull<K extends keyof T>(key: K): EffectQuery<T, R> {
    return this.derive((query) => query.whereNotNull(key))
  }
  orderBy<K extends keyof T>(
    key: K,
    order: 'asc' | 'desc' = 'asc'
  ): EffectQuery<T, R> {
    return this.derive((query) => query.orderBy(key, order))
  }
  limit(length: number): EffectQuery<T, R> {
    return this.derive((query) => query.limit(length))
  }
  skip(length: number): EffectQuery<T, R> {
    return this.derive((query) => query.skip(length))
  }
  search(text: string, caseSensitive = false): EffectQuery<T, R> {
    return this.derive((query) => query.search(text, caseSensitive))
  }
  stream(batchSize = 1000) {
    return Stream.unwrap(
      Effect.flatMap(this.make, (make) =>
        Effect.try({
          try: () =>
            Stream.fromAsyncIterable(make().cursor(batchSize), (cause) =>
              queryError('stream', this.collectionName, cause)
            ),
          catch: (cause) => queryError('stream', this.collectionName, cause)
        })
      )
    )
  }
  get() {
    return this.execute('get', (query) => query.get())
  }
  count() {
    return this.execute('count', (query) => query.count())
  }
  delete() {
    return this.execute('delete', (query) => query.delete())
  }
  first() {
    return this.execute('first', (query) => query.first()).pipe(
      Effect.map(Option.fromNullable)
    )
  }
  find(id: string) {
    return this.execute('find', (query) => query.find(id)).pipe(
      Effect.map(Option.fromNullable)
    )
  }
  findOne(query: Query) {
    const captured = snapshot(query)
    return this.execute('findOne', (query) => query.findOne(captured())).pipe(
      Effect.map(Option.fromNullable)
    )
  }
  findBy<K extends keyof T>(key: K, value: QueryValue<T[K]>) {
    return this.where(key, value).first()
  }
  paginate(page: number, perPage: number) {
    return this.execute('paginate', (query) => query.paginate(page, perPage))
  }
  pluck<K extends keyof T>(key: K) {
    return this.execute('pluck', (query) => query.pluck(key))
  }
  distinct<K extends keyof T>(key: K) {
    return this.execute('distinct', (query) => query.distinct(key))
  }
  sum<K extends keyof T>(key: K) {
    return this.execute('sum', (query) => query.sum(key))
  }
  average<K extends keyof T>(key: K) {
    return this.execute('average', (query) => query.average(key))
  }
  min<K extends keyof T>(key: K) {
    return this.execute('min', (query) => query.min(key))
  }
  max<K extends keyof T>(key: K) {
    return this.execute('max', (query) => query.max(key))
  }
  percentile<K extends keyof T>(key: K, n: number) {
    return this.execute('percentile', (query) => query.percentile(key, n))
  }
  aggregate(stages: Record<string, unknown>[]) {
    const captured = snapshot(stages)
    return this.execute('aggregate', (query) => query.aggregate(captured()))
  }
  increment<K extends NumericKey<T>>(key: K, by = 1) {
    return this.execute('increment', (query) => query.increment(key, by))
  }
  decrement<K extends NumericKey<T>>(key: K, by = 1) {
    return this.execute('decrement', (query) => query.decrement(key, by))
  }
}
