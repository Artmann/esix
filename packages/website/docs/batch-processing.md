---
title: Batch Processing
description: Process large collections without loading everything into memory. Learn how to iterate over models in batches with Esix's chunk helper and async cursor.
---

Methods like `all()` and `get()` load every matching document into memory at
once. That's fine for a few hundred records, but batch jobs that enrich,
migrate, or clean up whole collections need a way to work through documents a
handful at a time. Esix provides two helpers for this: `chunk` and `cursor`.

Both fetch documents in batches using keyset pagination on the id, so memory
usage stays flat no matter how large the collection is.

## chunk()

`chunk(size, callback)` fetches models in batches of `size` and hands each
batch to your callback along with a page number, starting at 1:

```ts
await Book.chunk(500, async (books, page) => {
  console.log(`Processing page ${page} with ${books.length} books`)

  for (const book of books) {
    await enrich(book)
  }
})
```

```
Processing page 1 with 500 books
Processing page 2 with 500 books
Processing page 3 with 137 books
```

`chunk` works on any query, so you can constrain which documents are
processed:

```ts
await Post.where('published', false).chunk(100, async (posts) => {
  for (const post of posts) {
    post.published = true

    await post.save()
  }
})
```

`chunk` resolves to `true` once every batch has been processed.

### Stopping Early

Return `false` from the callback to stop processing further batches. `chunk`
then resolves to `false`:

```ts
const completed = await Order.chunk(100, async (orders) => {
  const failed = await processPayments(orders)

  if (failed) {
    return false
  }
})

console.log(completed)
```

```
false
```

## cursor()

When you'd rather work with one model at a time, `cursor()` returns an async
iterator. Documents are still fetched in batches behind the scenes (1,000 per
batch by default), but your loop sees a steady stream of models:

```ts
for await (const book of Book.cursor()) {
  await enrich(book)
}
```

You can tune the batch size and combine it with queries:

```ts
for await (const post of Post.where('published', true).cursor(250)) {
  console.log(post.title)
}
```

Query builders are also directly async iterable, so you can skip the `cursor()`
call entirely:

```ts
for await (const post of Post.where('published', true)) {
  console.log(post.title)
}
```

Breaking out of a `for await` loop is safe and stops fetching further batches:

```ts
for await (const user of User.cursor()) {
  if (await needsAttention(user)) {
    await notify(user)

    break
  }
}
```

## Iteration Order and Mutation Safety

Both `chunk` and `cursor` iterate documents by id in ascending order. After
each batch, the next batch is fetched with an "id greater than the last one
seen" condition rather than a numeric offset. This has two important
consequences:

- **Mutation safety.** It is safe to update or delete the models you've been
  handed while iterating. A hand-rolled `skip`/`limit` loop silently skips
  documents when the loop body changes which documents match the query;
  keyset pagination does not.
- **Fixed ordering.** Any `orderBy()`, `limit()`, or `skip()` set on the
  query is ignored by `chunk` and `cursor`. Resumable keyset pagination
  requires a unique total order, so iteration is always by id ascending.

One limitation to be aware of: the collection's `_id`s must all be the same
BSON type. Documents created through Esix always use string ids, and
collections created by other tools usually use `ObjectId`s throughout —
both work fine. But a mixed-type collection will only iterate the first
type bracket, because MongoDB's `$gt` never matches across BSON types.

If you need results in a custom order or a single bounded page, use
[pagination](/docs/pagination) instead.
