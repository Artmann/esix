---
title: Pagination
description: Handle large datasets efficiently with Esix's pagination features. Learn about the built-in paginate helper, skip, limit, and cursor-based pagination strategies.
---

When working with large datasets, pagination is essential for performance and
user experience. Esix provides a built-in `paginate` helper as well as the
lower-level `skip` and `limit` methods.

## paginate()

`paginate(page, perPage)` returns the requested page of results along with all
the metadata you need to render a paginator. Pages are 1-indexed.

```ts
const result = await Post.where('published', true)
  .orderBy('publishedAt', 'desc')
  .paginate(1, 20)
```

```ts
{
  data: [/* 20 Post records */],
  total: 137,
  page: 1,
  perPage: 20,
  lastPage: 7
}
```

The same method is available as a static helper on the model:

```ts
const { data, total, lastPage } = await Post.paginate(1, 20)
```

```ts
{
  data: [/* 20 Post records */],
  total: 137,
  lastPage: 7
}
```

`paginate` validates its arguments and throws if `page` or `perPage` is not a
positive integer.

## Manual Pagination with skip and limit

When you need finer control, you can use `skip` to offset results and `limit`
to control page size directly:

```ts
const page = 2
const perPage = 10
const offset = (page - 1) * perPage

const products = await Product.where('category', 'electronics')
  .skip(offset)
  .limit(perPage)
  .get()
```

| id                         | name                | category      | price |
|----------------------------|---------------------|---------------|-------|
| `60119e8a9f1b2c4d8e7f3a21` | `Bluetooth Speaker` | `electronics` | 59.00 |
| `60119e8a9f1b2c4d8e7f3a22` | `Smart Bulb`        | `electronics` | 14.99 |
| `60119e8a9f1b2c4d8e7f3a23` | `USB-C Hub`         | `electronics` | 34.50 |

If you are looping over `skip`/`limit` pages to process a whole collection,
use [batch processing](/docs/batch-processing) with `chunk` or `cursor`
instead. Offset loops can skip documents when the loop body modifies them.

## Pagination with Sorting

When paginating, it's important to use consistent sorting to ensure stable
results across pages:

```ts
const getBlogPosts = async (page: number = 1, perPage: number = 10) => {
  return await BlogPost.where('status', 'published')
    .orderBy('createdAt', 'desc')
    .paginate(page, perPage)
}
```

This guide covers the pagination capabilities available in Esix. For more
information about query methods, see the [Retrieving Models](/docs/retrieving-models)
guide.
