import { Config, Context, Effect, Layer, Redacted } from 'effect'
import { MongoClient, type Db, type MongoClientOptions } from 'mongodb'
import type { BaseModel, ObjectType, QueryConnection } from 'esix'
import { EffectModel } from './model'
import { connectionError, type EsixConnectionError } from './errors'

export interface EsixOptions {
  readonly url: string | Redacted.Redacted<string>
  readonly database?: string
  readonly clientOptions?: MongoClientOptions
}

export interface EsixService {
  readonly connection: QueryConnection
  readonly model: <T extends BaseModel>(ctor: ObjectType<T>) => EffectModel<T>
}

function service(connection: QueryConnection): EsixService {
  return { connection, model: (ctor) => new EffectModel(ctor, connection) }
}

/** A database service. Provide one Layer for the lifetime of your application. */
export class Esix extends Context.Tag('esix/Esix')<Esix, EsixService>() {
  /** Describe reusable queries whose database is supplied at execution. */
  static model<T extends BaseModel>(ctor: ObjectType<T>): EffectModel<T, Esix> {
    return new EffectModel(
      ctor,
      Effect.map(Esix, (service) => service.connection)
    )
  }

  /** Read DB_URL and optional DB_DATABASE through Effect's ConfigProvider. */
  static layerConfig(
    options: Config.Config.Wrap<EsixOptions> = {
      url: Config.redacted('DB_URL'),
      database: Config.string('DB_DATABASE').pipe(Config.withDefault(''))
    }
  ) {
    return Layer.unwrapEffect(
      Effect.map(Config.unwrap(options), (options) => Esix.layer(options))
    )
  }

  static readonly Default = Esix.layerConfig()

  /** Owns a client and closes it when this Layer's scope ends. */
  static layer(options: EsixOptions): Layer.Layer<Esix, EsixConnectionError> {
    const { url: rawUrl, database, clientOptions } = options
    const url = typeof rawUrl === 'string' ? Redacted.make(rawUrl) : rawUrl
    return Layer.scoped(
      Esix,
      Effect.gen(function* () {
        let closed = false
        const client = yield* Effect.acquireRelease(
          Effect.try({
            try: () => new MongoClient(Redacted.value(url), clientOptions),
            catch: connectionError
          }),
          (client) =>
            Effect.sync(() => {
              closed = true
            }).pipe(Effect.zipRight(Effect.promise(() => client.close())))
        )
        // A driver Promise cannot be cancelled. Finish acquisition before closing it.
        yield* Effect.tryPromise({
          try: () => client.connect(),
          catch: connectionError
        }).pipe(Effect.uninterruptible)
        const db = yield* Effect.try({
          try: () => client.db(database || undefined),
          catch: connectionError
        })
        return service({
          adapter: 'default',
          getConnection: async () => {
            if (closed) throw new Error('Esix connection scope is closed')
            return db
          }
        })
      })
    )
  }

  /** Borrows a native Db. The caller remains responsible for closing its client. */
  static layerFromDb(
    db: Db,
    options: { readonly adapter?: 'default' | 'mock' } = {}
  ): Layer.Layer<Esix> {
    return Layer.succeed(
      Esix,
      service({
        adapter: options.adapter ?? 'default',
        getConnection: async () => db
      })
    )
  }
}
