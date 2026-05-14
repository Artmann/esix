---
title: Authentication with JWT
description: Build signup, login, and protected routes in Express using Esix models and JSON Web Tokens. Includes password hashing and a requireAuth middleware.
---

In this recipe you'll add email-and-password authentication to an Express API
backed by Esix. You'll define a `User` model that stores a hashed password,
build signup and login endpoints, and write a small middleware that loads the
current user from a JWT on every request.

Esix features used: `findBy`, `create`, instance methods, and `find` for
loading the current user.

## What You'll Build

```
POST /auth/signup → create a user and return a JWT
POST /auth/login  → exchange credentials for a JWT
GET  /me          → return the current user (protected)
```

## Dependencies

```sh
yarn add esix mongodb express bcryptjs jsonwebtoken zod
yarn add -D @types/express @types/bcryptjs @types/jsonwebtoken
```

> **Note:** Never store plaintext passwords. The model below hashes on save and
> exposes a `verifyPassword` method so route handlers never touch the raw
> hash.

## The User Model

Encapsulate password handling inside the model so callers can't forget to hash:

```ts
// src/models/user.ts
import { BaseModel } from 'esix'
import bcrypt from 'bcryptjs'

export default class User extends BaseModel {
  public email = ''
  public name = ''
  public passwordHash = ''

  static async register(attributes: {
    email: string
    name: string
    password: string
  }): Promise<User> {
    const passwordHash = await bcrypt.hash(attributes.password, 12)

    return User.create({
      email: attributes.email.toLowerCase().trim(),
      name: attributes.name,
      passwordHash
    })
  }

  verifyPassword(plaintext: string): Promise<boolean> {
    return bcrypt.compare(plaintext, this.passwordHash)
  }
}
```

A static `register` factory keeps hashing in one place, and the instance method
`verifyPassword` lets login handlers stay tiny.

## Signing and Verifying Tokens

A pair of tiny helpers wrap `jsonwebtoken`:

```ts
// src/auth/tokens.ts
import jwt from 'jsonwebtoken'

const secret = process.env.JWT_SECRET ?? 'change-me-in-production'

export function sign(userId: string): string {
  return jwt.sign({ sub: userId }, secret, { expiresIn: '7d' })
}

export function verify(token: string): { sub: string } {
  return jwt.verify(token, secret) as { sub: string }
}
```

## The requireAuth Middleware

This middleware loads the current user from the `Authorization` header. By
attaching the resolved model to `request.user`, downstream handlers don't have
to repeat the lookup:

```ts
// src/auth/require-auth.ts
import { NextFunction, Request, Response } from 'express'
import User from '../models/user'
import { verify } from './tokens'

declare global {
  namespace Express {
    interface Request {
      user?: User
    }
  }
}

export async function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  const header = request.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    response.status(401).json({ error: 'Missing authorization header' })
    return
  }

  try {
    const { sub } = verify(token)
    const user = await User.find(sub)

    if (!user) {
      response.status(401).json({ error: 'User no longer exists' })
      return
    }

    request.user = user
    next()
  } catch {
    response.status(401).json({ error: 'Invalid token' })
  }
}
```

## Auth Schemas

Validate the request body with zod before reaching for the database. Defining
the schemas alongside the routes keeps the auth surface area in one place:

```ts
// src/routes/auth/schemas.ts
import { z } from 'zod'

export const SignupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(72)
})

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})
```

## Auth Routes

```ts
// src/routes/auth/index.ts
import { Router } from 'express'
import User from '../../models/user'
import { sign } from '../../auth/tokens'
import { LoginSchema, SignupSchema } from './schemas'

const router = Router()

router.post('/signup', async (request, response) => {
  const input = SignupSchema.parse(request.body)

  const existing = await User.findBy('email', input.email.toLowerCase())

  if (existing) {
    return response.status(409).json({ error: 'Email already in use' })
  }

  const user = await User.register({
    email: input.email,
    name: input.name,
    password: input.password
  })

  const token = sign(user.id)

  response.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name }
  })
})

router.post('/login', async (request, response) => {
  const input = LoginSchema.parse(request.body)

  const user = await User.findBy('email', input.email.toLowerCase())

  if (!user || !(await user.verifyPassword(input.password))) {
    return response.status(401).json({ error: 'Invalid email or password' })
  }

  const token = sign(user.id)

  response.json({
    token,
    user: { id: user.id, email: user.email, name: user.name }
  })
})

export default router
```

Note the use of `findBy` to look up users by email — this is the idiomatic way
to query a single record by any indexed field.

## Protected Route

Mount the middleware in front of any handler that needs an authenticated user:

```ts
// src/routes/me.ts
import { Router } from 'express'
import { requireAuth } from '../auth/require-auth'

const router = Router()

router.get('/', requireAuth, (request, response) => {
  const user = request.user!
  response.json({
    user: { id: user.id, email: user.email, name: user.name }
  })
})

export default router
```

## Trying It Out

Sign up:

```sh
curl -X POST http://localhost:3000/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{ "email": "ada@example.com", "name": "Ada", "password": "s3cret!" }'
```

```ts
{
  token: 'eyJhbGciOi...',
  user: {
    id: '6011a52b9f1b2c4d8e7f3a21',
    email: 'ada@example.com',
    name: 'Ada'
  }
}
```

Call the protected endpoint:

```sh
curl http://localhost:3000/me \
  -H 'Authorization: Bearer eyJhbGciOi...'
```

```ts
{
  user: {
    id: '6011a52b9f1b2c4d8e7f3a21',
    email: 'ada@example.com',
    name: 'Ada'
  }
}
```

## Pattern Notes

- **Hashing in a static factory.** Putting `register` on the model means the
  hash never leaks into route code, and there's only one place to change the
  hashing algorithm later.
- **Look-up by email is just `findBy`.** Add a unique index on `email` in
  MongoDB so the race-free upsert path is handled at the database layer.
- **Validate before you query.** `SignupSchema.parse(request.body)` is a
  one-liner that turns "anything the client sends" into a typed object —
  enforce minimums on password length here rather than after the database
  round trip.
- **Don't return the hash.** The responses above only echo safe fields. If you
  find yourself reaching for a generic `toJSON`, build one on `User` that
  omits `passwordHash`.

## What's Next

- [REST API for a Blog](/docs/cookbook/express/rest-api) — the patterns above
  drop straight into a CRUD API.
- [Defining Models](/docs/defining-models) — more on instance methods and
  schema conventions.
- [Testing](/docs/testing) — verify your auth flows against the in-memory
  adapter.
