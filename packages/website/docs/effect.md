---
title: Effect Integration
description:
  Typed lazy queries, Option lookups, scoped MongoDB connections, and Streams
  for Effect 3 applications.
---

Start with the [Effect Quickstart](/docs/effect-quickstart) for installation and
a runnable first program. `esix/effect` supports Effect 3.21.3 and later 3.x
versions. The Promise API remains available from `esix` without installing
Effect.

## Queries and missing records

Obtain a model facade with `const users = db.model(User)`. Fluent methods return
independent query descriptions: deriving one query never changes another. Every
execution constructs a fresh query, and mutable query inputs are copied when the
query is described.

`find`, `findBy`, `findOne`, and `first` return `Option<User>`. An absent record
is `Option.none()`, not a query failure.

```ts
import { BaseModel } from 'esix'
import { Esix } from 'esix/effect'
import { Effect, Option } from 'effect'

class User extends BaseModel {
  name = ''
  age = 0
}

export const findName = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Esix
    const found = yield* db.model(User).find(id)
    return Option.match(found, {
      onNone: () => 'Unknown user',
      onSome: (user) => user.name
    })
  })
```

| Promise API                               | Effect facade                               |
| ----------------------------------------- | ------------------------------------------- |
| `await User.all()`                        | `yield* users.all()`                        |
| `await User.where('age', '>=', 18).get()` | `yield* users.where('age', '>=', 18).get()` |
| `await User.find(id)` → model or null     | `yield* users.find(id)` → Option            |
| `await user.save()`                       | `yield* users.save(user)`                   |
| `await user.update({ age: 31 })`          | `yield* users.update(user, { age: 31 })`    |
| `await user.delete()`                     | `yield* users.deleteModel(user)`            |
| `User.cursor(500)`                        | `users.stream(500)`                         |

Filtering includes `where`, `orWhere`, membership/null checks, sorting,
pagination, and text search. Terminal methods also include `count`, `pluck`,
`distinct`, `sum`, `average`, `min`, `max`, `percentile`, `aggregate`,
`increment`, `decrement`, and query `delete`. Field types and numeric increment
restrictions are preserved. Raw query objects retain the existing sanitization
rules.

## Writes and relationships

`create` and `firstOrCreate` preserve model defaults and `wasRecentlyCreated`.
Instance writes execute only when their Effect runs. Query `delete()` deletes
matching records; `deleteModel(model)` deletes one model.

```ts
import { BaseModel } from 'esix'
import { Esix } from 'esix/effect'
import { Effect } from 'effect'

class User extends BaseModel {
  name = ''
  age = 0
}
class Post extends BaseModel {
  userId = ''
  title = ''
}

export const createAuthor = Effect.gen(function* () {
  const db = yield* Esix
  const users = db.model(User)
  const author = yield* users.create({ name: 'Alice' })
  yield* users.update(author, { age: 31 })
  yield* db.model(Post).create({ userId: author.id, title: 'Hello' })
  return yield* users.hasMany(author, Post).get()
})
```

`hasMany` returns an Effect query; `hasOne` and `belongsTo` return Effects of
Option. Their optional foreign/local/owner key arguments follow the
[relationship guide](/docs/relationships).

Hydrated instances retain their database connection. Their original Promise
methods, including relationship helpers, use that same connection. Custom
methods remain Promise methods; the adapter does not rewrite them. Static
methods such as `User.find()` continue using the default global connection.
Saving a model through a facade for a different connection fails instead of
moving the model silently. New, unbound instances can be saved through their
facade.

## Typed errors

`EsixConnectionError` describes Layer acquisition failure. `EsixQueryError`
describes failed terminal operations and carries `operation`, `collection`, and
the original `cause`. Generated messages omit the connection URL. Treat driver
causes as potentially sensitive if you log them.

```ts
import { BaseModel } from 'esix'
import { Esix } from 'esix/effect'
import { Effect } from 'effect'

class User extends BaseModel {
  name = ''
}

export const countUsers = Effect.gen(function* () {
  const db = yield* Esix
  return yield* db
    .model(User)
    .count()
    .pipe(
      Effect.catchTag('EsixQueryError', (error) =>
        Effect.logError('User count failed', {
          operation: error.operation
        }).pipe(Effect.zipRight(Effect.fail(error)))
      )
    )
})
```

There are no automatic retries. Apply retry policies deliberately, especially
for writes that might have reached MongoDB before an error was returned. A
client-close failure is retained as a finalizer defect.

## Configuration and connection lifetime

`Esix.layer({ url, database?, clientOptions? })` owns a native MongoDB client.
The URL is a `Redacted<string>`. Options are explicit and do not change
`DB_URL`, `DB_DATABASE`, or `DB_ADAPTER` used by the Promise API. Native Effect
connections always use native driver behavior, even if the global adapter is set
to mock.

To read environment configuration with Effect:

```ts
import { Esix } from 'esix/effect'
import { Config, Effect, Layer } from 'effect'

export const EsixLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const url = yield* Config.redacted('DB_URL')
    return Esix.layer({ url, clientOptions: { maxPoolSize: 10 } })
  })
)
```

Provide one Layer for the application's lifetime. Owned connections close when
their scope ends; captured models and queries cannot reopen a closed connection.
Separate Layer instances own separate clients. For a client managed elsewhere,
use `Esix.layerFromDb(db)`; it never connects or closes the borrowed client's
resources.

## Streaming

Use Stream combinators instead of a Promise callback to process batches:

```ts
import { BaseModel } from 'esix'
import { Esix } from 'esix/effect'
import { Effect, Stream } from 'effect'

class User extends BaseModel {
  name = ''
  age = 0
}

export const processAdults = Effect.gen(function* () {
  const db = yield* Esix
  return yield* db
    .model(User)
    .where('age', '>=', 18)
    .stream(500)
    .pipe(
      Stream.take(100),
      Stream.runForEach((user) => Effect.log(user.name))
    )
})
```

Streams use the existing [keyset batch iteration](/docs/batch-processing):
ascending id, homogeneous BSON id types, and no query sort/skip/limit. Use
`Stream.take` to stop consumption. Each run gets a fresh iterator. Ending
consumption closes the iterator and prevents further batches.

Interruption cannot cancel or roll back an already-running MongoDB Promise.
Iterator cleanup may wait for a pending batch; connection acquisition likewise
settles before cleanup. Configure driver timeouts when bounded waits matter.

## Testing with a borrowed database

Use a disposable database and provide it as a Layer. This example accepts a Db
owned by the test fixture:

```ts
import { BaseModel } from 'esix'
import { Esix } from 'esix/effect'
import { Effect } from 'effect'
import type { Db } from 'mongodb'

class User extends BaseModel {
  name = ''
}

export const countInTestDatabase = (database: Db) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const db = yield* Esix
      return yield* db.model(User).count()
    }).pipe(Effect.provide(Esix.layerFromDb(database)))
  )
```

The test fixture remains responsible for cleaning its database and closing its
client. Application services can also replace their repository dependencies with
test Layers. See [testing](/docs/testing) for the ordinary Promise API's mock
adapter.
