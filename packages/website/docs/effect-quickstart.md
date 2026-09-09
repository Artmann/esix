---
title: Effect Quickstart
description:
  Use existing Esix models with Effect 3, typed queries, and an automatically
  managed MongoDB connection.
---

Use `esix/effect` to run Esix queries inside an Effect program. Your models
still extend `BaseModel`; database operations return lazy Effects.

## Prerequisites

- Node.js 20 or newer.
- MongoDB running locally on port 27017, or a MongoDB connection URL.
- Effect 3.21.3 or newer within major version 3. Effect 4 is not supported by
  this entry point.

## Install

```sh
npm install esix mongodb effect@^3.21.3
npm install --save-dev typescript tsx
```

Or with Yarn:

```sh
yarn add esix mongodb effect@^3.21.3
yarn add --dev typescript tsx
```

Effect is optional for the ordinary Promise API. Only applications importing
`esix/effect` need it.

## Create your first program

Save this complete example as `quickstart.ts`:

```ts
import { BaseModel } from 'esix'
import { Esix } from 'esix/effect'
import { Console, Effect } from 'effect'

class User extends BaseModel {
  name = ''
  age = 0
}

const live = Esix.layer({
  url: 'mongodb://127.0.0.1:27017/esix_effect_quickstart',
  database: 'esix_effect_quickstart'
})

const users = Esix.model(User)

const program = Effect.gen(function* () {
  const alice = yield* users.create({ name: 'Alice', age: 30 })
  const matches = yield* users.where('id', alice.id).get()
  yield* Console.log(matches.map((user) => user.name))
})

Effect.runPromise(program.pipe(Effect.provide(live)))
```

Run it:

```sh
npx tsx quickstart.ts
```

Expected output:

```text
[ 'Alice' ]
```

Each run inserts a new record into the `users` collection. `create()` supplies
the model defaults, id, and timestamps. Constructing the program does no
database work; `Effect.runPromise` executes it.

`Esix.model(User)` can be defined at module scope. Its operations carry the
`Esix` requirement in their types; providing `live` supplies the connection when
they execute.

For environment-based configuration, use `Esix.Default` instead of `live`: it
reads the required `DB_URL` and optional `DB_DATABASE` through Effect Config.
Use `Esix.layerConfig(...)` to customize configuration keys or defaults.

The Layer opens its own MongoDB client and closes it when the program finishes,
including on failure. In a server, provide the Layer for the application's
lifetime so requests share its connection pool.

## Next steps

The [Effect integration guide](/docs/effect) covers missing records with
`Option`, typed errors, updates, relationships, configuration, Streams, and
testing. The existing [model guide](/docs/defining-models) applies to both APIs.
