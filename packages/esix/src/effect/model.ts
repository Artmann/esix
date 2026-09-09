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
import { queryEffect } from './errors'
import { snapshot } from './snapshot'

/** Effect operations for an existing esix model class. */
export class EffectModel<T extends BaseModel> extends EffectQuery<T> {
  constructor(
    private readonly ctor: ObjectType<T>,
    connection: QueryConnection
  ) {
    super(() => new QueryBuilder(ctor, connection), resolveCollectionName(ctor))
  }
  query(): EffectQuery<T> {
    return new EffectQuery(this.make, this.collectionName)
  }
  all() {
    return this.get()
  }
  create(attributes: Partial<T>) {
    const captured = snapshot(attributes)
    return queryEffect('create', this.collectionName, () =>
      this.make().createModel({ ...getDefaultValues(this.ctor), ...captured() })
    )
  }
  firstOrCreate(filter: Partial<T>, attributes?: Partial<T>) {
    const captured = snapshot({ filter, attributes })
    return queryEffect('firstOrCreate', this.collectionName, async () => {
      const { filter, attributes } = captured()
      return (
        await this.make().firstOrCreate(filter, {
          ...getDefaultValues(this.ctor),
          ...filter,
          ...attributes
        })
      ).model
    })
  }
  private bind(model: T): T {
    if (!(model instanceof this.ctor))
      throw new Error('Model has a different constructor')
    return this.make().bindModel(model)
  }
  save(model: T) {
    return queryEffect('save', this.collectionName, () =>
      this.bind(model).save()
    )
  }
  update(model: T, attributes: Partial<T>) {
    const captured = snapshot(attributes)
    return queryEffect('update', this.collectionName, () =>
      this.bind(model).update(captured())
    )
  }
  deleteModel(model: T) {
    return queryEffect('deleteModel', this.collectionName, () =>
      this.bind(model).delete()
    )
  }
  hasMany<U extends BaseModel>(
    model: T,
    related: ObjectType<U>,
    foreignKey?: string,
    localKey?: string
  ): EffectQuery<U> {
    return new EffectQuery(
      () => this.bind(model).hasMany(related, foreignKey, localKey),
      resolveCollectionName(related)
    )
  }
  hasOne<U extends BaseModel>(
    model: T,
    related: ObjectType<U>,
    foreignKey?: string,
    localKey?: string
  ) {
    return queryEffect('hasOne', resolveCollectionName(related), () =>
      this.bind(model).hasOne(related, foreignKey, localKey)
    ).pipe(Effect.map(Option.fromNullable))
  }
  belongsTo<U extends BaseModel>(
    model: T,
    related: ObjectType<U>,
    foreignKey?: string,
    ownerKey?: string
  ) {
    return queryEffect('belongsTo', resolveCollectionName(related), () =>
      this.bind(model).belongsTo(related, foreignKey, ownerKey)
    ).pipe(Effect.map(Option.fromNullable))
  }
}
