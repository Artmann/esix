---
title: REST API for a Blog
description: Build a JSON REST API for blog posts with Express and Esix. Covers list, read, create, update, and delete endpoints with paginated results.
---

In this recipe you'll build a small Express API that exposes a `Post`
collection over five JSON endpoints — the kind of CRUD surface every web app
ends up needing. Along the way you'll touch most of the Esix surface area you
will use every day: `find`, `all`, `create`, `save`, `delete`, and `paginate`.

## What You'll Build

```
GET    /posts        → paginated list of posts
GET    /posts/:id    → a single post
POST   /posts        → create a new post
PATCH  /posts/:id    → update an existing post
DELETE /posts/:id    → remove a post
```

## Project Setup

Install the dependencies you'll need:

```sh
yarn add esix mongodb express zod
yarn add -D typescript @types/express
```

> **Note:** Esix reads its connection settings from environment variables. Set
> `DB_URL` and `DB_DATABASE` before starting the server, or rely on the defaults
> (`mongodb://127.0.0.1:27017/` and your project name).

## The Post Model

Models in Esix are plain TypeScript classes that extend `BaseModel`. Public
class fields become document properties:

```ts
// src/models/post.ts
import { BaseModel } from 'esix'

export default class Post extends BaseModel {
  public title = ''
  public body = ''
  public authorId = ''
  public published = false
}
```

`BaseModel` automatically provides `id`, `createdAt`, and `updatedAt`, so the
model definition stays focused on the fields that are specific to your domain.

## Validating Request Bodies

Define a zod schema for each shape of input. `CreatePostSchema` describes the
full payload for `POST`, and `UpdatePostSchema` derives a partial version for
`PATCH` so any subset of fields is valid:

```ts
// src/routes/posts/schemas.ts
import { z } from 'zod'

export const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  authorId: z.string().min(1),
  published: z.boolean().optional().default(false)
})

export const UpdatePostSchema = CreatePostSchema.partial()

export const ListPostsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20)
})
```

`z.coerce.number()` is exactly what query strings need — values arrive as
strings, and the schema converts and validates them in one step.

## Wiring Up Express

A single router file is enough to host all five endpoints. Each handler parses
its input with zod, then assigns validated fields onto the model one at a
time — that way the route is the only place that decides which fields a client
is allowed to write:

```ts
// src/routes/posts/index.ts
import { Router } from 'express'
import Post from '../../models/post'
import {
  CreatePostSchema,
  ListPostsQuerySchema,
  UpdatePostSchema
} from './schemas'

const router = Router()

router.get('/', async (request, response) => {
  const { page, perPage } = ListPostsQuerySchema.parse(request.query)

  const { data, ...pagination } = await Post.where('published', true)
    .orderBy('createdAt', 'desc')
    .paginate(page, perPage)

  response.json({ posts: data, pagination })
})

router.get('/:id', async (request, response) => {
  const post = await Post.find(request.params.id)

  if (!post) {
    return response.status(404).json({ error: 'Post not found' })
  }

  response.json({ post })
})

router.post('/', async (request, response) => {
  const input = CreatePostSchema.parse(request.body)

  const post = await Post.create({
    title: input.title,
    body: input.body,
    authorId: input.authorId,
    published: input.published
  })

  response.status(201).json({ post })
})

router.patch('/:id', async (request, response) => {
  const post = await Post.find(request.params.id)

  if (!post) {
    return response.status(404).json({ error: 'Post not found' })
  }

  const input = UpdatePostSchema.parse(request.body)

  if (input.title !== undefined) post.title = input.title
  if (input.body !== undefined) post.body = input.body
  if (input.published !== undefined) post.published = input.published

  await post.save()

  response.json({ post })
})

router.delete('/:id', async (request, response) => {
  const post = await Post.find(request.params.id)

  if (!post) {
    return response.status(404).json({ error: 'Post not found' })
  }

  await post.delete()

  response.status(204).end()
})

export default router
```

Two patterns to call out:

- **Validate, then assign one field at a time.** Spreading or `Object.assign`
  into the model lets a client pass `id`, `createdAt`, or `authorId` and have
  them silently land in the database. A handful of `if (input.x !== undefined)
  post.x = input.x` lines spell out the allowlist explicitly.
- **Wrap JSON responses in a root key.** `{ post }`, `{ posts, pagination }`,
  `{ user, token }` — a single top-level field gives you room to add metadata
  (errors, warnings, links) later without breaking clients.

Mount the router on an Express app:

```ts
// src/index.ts
import express from 'express'
import posts from './routes/posts'

const app = express()
app.use(express.json())
app.use('/posts', posts)

app.listen(3000, () => {
  console.log('API listening on http://localhost:3000')
})
```

> **Note:** `CreatePostSchema.parse(...)` throws a `ZodError` when validation
> fails. Add an Express error handler that converts those into a `400` JSON
> response (`{ error, issues }`) so clients get a useful message instead of a
> stack trace.

## Trying It Out

Create a post:

```sh
curl -X POST http://localhost:3000/posts \
  -H 'Content-Type: application/json' \
  -d '{ "title": "Hello Esix", "body": "First post", "published": true }'
```

The response includes the generated `id` and timestamps under a `post` root
key:

```ts
{
  post: {
    id: '6011a52b9f1b2c4d8e7f3a21',
    title: 'Hello Esix',
    body: 'First post',
    authorId: 'author-1',
    published: true,
    createdAt: 1747180800000,
    updatedAt: 1747180800000
  }
}
```

Fetch the list:

```sh
curl 'http://localhost:3000/posts?page=1&perPage=10'
```

```ts
{
  posts: [/* up to 10 Post records */],
  pagination: {
    total: 1,
    page: 1,
    perPage: 10,
    lastPage: 1
  }
}
```

## A Few Notes on Patterns

- **Filtering at the list endpoint.** The example only returns published posts.
  Move the filter behind a query parameter when you need an admin view that
  shows drafts too — see the [Search and
  Filtering](/docs/cookbook/express/search-and-filtering) recipe for a complete
  example.
- **One schema per shape.** `CreatePostSchema` and `UpdatePostSchema` describe
  the two write shapes the API accepts. `partial()` keeps the `PATCH` schema in
  sync with the create schema for free — add a field once and both endpoints
  pick it up.
- **`find` never throws on bad input.** Pass any string and you'll either get a
  model back or `null`, which keeps your route handlers tidy.

## What's Next

- [Authentication with JWT](/docs/cookbook/express/authentication) — load the
  current user on each request.
- [Pagination](/docs/pagination) — the full reference for `paginate`, `skip`,
  and `limit`.
- [Inserting and Updating Models](/docs/inserting-and-updating-models) — more
  on `create`, `save`, and bulk updates.
