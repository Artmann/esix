---
title: Pagination
description: Handle large datasets efficiently with Esix's pagination features. Learn about the built-in paginate helper, skip, limit, and cursor-based pagination strategies.
---

# Pagination

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

console.log(result.data) // Post[] (up to 20 items)
console.log(result.total) // total number of matching documents
console.log(result.page) // 1
console.log(result.perPage) // 20
console.log(result.lastPage) // ceil(total / perPage), or 1 when total is 0
```

The same method is available as a static helper on the model:

```ts
const { data, total, lastPage } = await Post.paginate(1, 20)
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

console.log(`Showing page ${page} with ${products.length} items`)
```

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
