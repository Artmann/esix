---
title: Atomic Counters
description: Use Esix's increment and decrement helpers to build race-free counters for likes, views, and rate-limit buckets in an Express API.
---

Counters are everywhere — likes, view counts, inventory, rate-limit buckets.
The naïve implementation is *read, add one, save* — and it's wrong the moment
two requests land at the same time. This recipe shows the right way: use
Esix's `increment` and `decrement`, which translate to MongoDB's `$inc`
operator and run atomically on the server.

Esix features used: `increment`, `decrement` on `QueryBuilder`.

## What You'll Build

```
POST   /posts/:id/view → record a view (anyone can call)
POST   /posts/:id/like → like a post (authenticated)
DELETE /posts/:id/like → undo a like
```

Each endpoint runs in a single round trip and is safe under arbitrary
concurrency.

## The Post Model

Two counters on the document — no `userId` lists, no per-action collection.
If you also need to know *who* liked a post, model that with a separate `Like`
collection alongside; for the count itself, a number is enough.

```ts
// src/models/post.ts
import { BaseModel } from 'esix'

export default class Post extends BaseModel {
  public title = ''
  public body = ''
  public viewCount = 0
  public likeCount = 0
}
```

## Why Not Read-Modify-Write?

This pattern looks fine and is wrong:

```ts
// ❌ Don't do this.
const post = await Post.find(id)
post.viewCount += 1
await post.save()
```

If two requests run this at the same time, both read the same `viewCount`,
both write `viewCount + 1`, and one of the increments vanishes. The fix is
to push the increment all the way down to MongoDB:

```ts
// ✅ Atomic — translates to $inc.
await Post.where('id', id).increment('viewCount')
```

`increment` returns the number of documents modified (`0` when nothing
matched), which is enough for the route handler to tell "found and updated"
from "not found".

## View Counter

A view endpoint is the simplest case — single field, single increment:

```ts
// src/routes/posts/views.ts
import { Router } from 'express'
import Post from '../../models/post'

const router = Router({ mergeParams: true })

router.post('/view', async (request, response) => {
  const modified = await Post.where('id', request.params.id).increment(
    'viewCount'
  )

  if (modified === 0) {
    return response.status(404).json({ error: 'Post not found' })
  }

  response.status(204).end()
})

export default router
```

## Like and Unlike

Likes are symmetric: one route increments, the mirror route decrements. The
optional second argument lets you bump by something other than `1`:

```ts
// src/routes/posts/likes.ts
import { Router } from 'express'
import Post from '../../models/post'
import { requireAuth } from '../../auth/require-auth'

const router = Router({ mergeParams: true })

router.post('/like', requireAuth, async (request, response) => {
  const modified = await Post.where('id', request.params.id).increment(
    'likeCount'
  )

  if (modified === 0) {
    return response.status(404).json({ error: 'Post not found' })
  }

  response.status(204).end()
})

router.delete('/like', requireAuth, async (request, response) => {
  const modified = await Post.where('id', request.params.id).decrement(
    'likeCount'
  )

  if (modified === 0) {
    return response.status(404).json({ error: 'Post not found' })
  }

  response.status(204).end()
})

export default router
```

> **Note:** `decrement` accepts any positive number — `decrement('likeCount',
> 5)` would subtract five — and it doesn't clamp at zero. If you need a floor,
> guard the call site or use a MongoDB conditional update.

## Bumping by More Than One

Both helpers take an optional second argument. Some everyday examples:

```ts
// Award 10 points for finishing a challenge.
await User.where('id', userId).increment('score', 10)

// Charge a one-off fee against an account balance.
await Account.where('id', accountId).decrement('balance', 25)
```

## Bulk Increments

`increment` runs against the whole `where` clause, so you can bump many
documents at once. This is great for batch reconciliation:

```ts
// Mark every active subscription as having been billed once more.
const updated = await Subscription
  .where('status', 'active')
  .increment('billingCycles')
```

`updated` is the count of documents `$inc` actually touched — useful when you
want to log "processed N records" or feed a progress UI.

## Pattern Notes

- **Counters belong on the parent.** Don't store `viewCount` in a sidecar
  collection — that just turns a one-document write into a join.
- **One increment per request.** Avoid calling `increment` inside a loop; if
  you need to bump by `N`, pass `N` as the second argument.
- **Distinguish "missing" from "no-op".** `increment` returns `0` for both an
  empty `where` and a non-existent id — your route should return `404` in
  either case.

## What's Next

- [REST API for a Blog](/docs/cookbook/express/rest-api) — fold these counter
  endpoints into a full CRUD router.
- [Aggregation Dashboard](/docs/cookbook/express/aggregation-dashboard) —
  expose totals and averages of the counters you're now safely incrementing.
