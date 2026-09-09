import { Effect, Option } from 'effect'
import {
  BaseModel,
  QueryBuilder,
  getDefaultValues,
  resolveCollectionName,
  type ObjectType,
  type QueryConnection
} from 'esix'
import { EffectQuery } from './query'
import { bindingError } from './errors'
import { snapshot } from './snapshot'

/** Effect operations for an existing esix model class. */
export class EffectModel<T extends BaseModel, R = never> extends EffectQuery<
  T,
  R
> {
  /** @internal Use Esix.model() or the provided service accessor. */
  constructor(
    private readonly ctor: ObjectType<T>,
    connection: QueryConnection | Effect.Effect<QueryConnection, never, R>
  ) {
    super(
      Effect.map(
        Effect.isEffect(connection) ? connection : Effect.succeed(connection),
        (connection) => () => new QueryBuilder(ctor, connection)
      ),
      resolveCollectionName(ctor)
    )
  }
  all() {
    return this.get()
  }
  create(attributes: Partial<T>) {
    const captured = snapshot(attributes)
    return this.execute('create', (query) =>
      query.createModel({ ...getDefaultValues(this.ctor), ...captured() })
    )
  }
  firstOrCreate(filter: Partial<T>, attributes?: Partial<T>) {
    const captured = snapshot({ filter, attributes })
    return this.execute('firstOrCreate', async (query) => {
      const { filter, attributes } = captured()
      return (
        await query.firstOrCreate(filter, {
          ...getDefaultValues(this.ctor),
          ...filter,
          ...attributes
        })
      ).model
    })
  }
  private bind(model: T, query: QueryBuilder<T>): T {
    if (!(model instanceof this.ctor))
      throw bindingError(
        this.collectionName,
        'constructor',
        new Error('Model has a different constructor')
      )
    try {
      return query.bindModel(model)
    } catch (cause) {
      throw bindingError(this.collectionName, 'connection', cause)
    }
  }
  save(model: T) {
    return this.execute('save', (query) => this.bind(model, query).save())
  }
  update(model: T, attributes: Partial<T>) {
    const captured = snapshot(attributes)
    return this.execute('update', (query) =>
      this.bind(model, query).update(captured())
    )
  }
  remove(model: T) {
    return this.execute('remove', (query) => this.bind(model, query).delete())
  }
  hasMany<U extends BaseModel>(
    model: T,
    related: ObjectType<U>,
    foreignKey?: string,
    localKey?: string
  ): EffectQuery<U, R> {
    return new EffectQuery(
      Effect.map(
        this.make,
        (make) => () =>
          this.bind(model, make()).hasMany(related, foreignKey, localKey)
      ),
      resolveCollectionName(related)
    )
  }
  hasOne<U extends BaseModel>(
    model: T,
    related: ObjectType<U>,
    foreignKey?: string,
    localKey?: string
  ) {
    return this.execute(
      'hasOne',
      (query) => this.bind(model, query).hasOne(related, foreignKey, localKey),
      resolveCollectionName(related)
    ).pipe(Effect.map(Option.fromNullable))
  }
  belongsTo<U extends BaseModel>(
    model: T,
    related: ObjectType<U>,
    foreignKey?: string,
    ownerKey?: string
  ) {
    return this.execute(
      'belongsTo',
      (query) =>
        this.bind(model, query).belongsTo(related, foreignKey, ownerKey),
      resolveCollectionName(related)
    ).pipe(Effect.map(Option.fromNullable))
  }
}
