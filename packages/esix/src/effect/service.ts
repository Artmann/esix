import { Context, Effect, Layer, Redacted } from 'effect'
import { MongoClient, type Db, type MongoClientOptions } from 'mongodb'
import type { BaseModel, ObjectType, QueryConnection } from 'esix'
import { EffectModel } from './model'
import { EsixConnectionError } from './errors'

export interface EsixOptions {
  readonly url: Redacted.Redacted<string>
  readonly database?: string
  readonly clientOptions?: MongoClientOptions
}

export interface EsixService {
  readonly model: <T extends BaseModel>(ctor: ObjectType<T>) => EffectModel<T>
}

function service(connection: QueryConnection): EsixService {
  return { model: (ctor) => new EffectModel(ctor, connection) }
}

/** A database service. Provide one Layer for the lifetime of your application. */
export class Esix extends Context.Tag('esix/Esix')<Esix, EsixService>() {
  /** Owns a client and closes it when this Layer's scope ends. */
  static layer(options: EsixOptions): Layer.Layer<Esix, EsixConnectionError> {
    const connectionError = (cause: unknown) =>
      new EsixConnectionError({ message: 'Esix connection failed', cause })
    return Layer.scoped(
      Esix,
      Effect.gen(function* () {
        let closed = false
        const client = yield* Effect.acquireRelease(
          Effect.try({
            try: () =>
              new MongoClient(
                Redacted.value(options.url),
                options.clientOptions
              ),
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
          try: () => client.db(options.database),
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
  static layerFromDb(db: Db): Layer.Layer<Esix> {
    return Layer.succeed(
      Esix,
      service({ adapter: 'default', getConnection: async () => db })
    )
  }
}
