---
title: Pagination
---

# Pagination

When working with large datasets, pagination is essential for performance and
user experience. Esix provides simple but powerful pagination capabilities using
the `skip` and `limit` methods.

## Basic Pagination

The most common pagination pattern uses `skip` to offset results and `limit` to
control page size:

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

## Complete Pagination Example

Here's a complete pagination implementation that includes total count:

```ts
class PaginationService {
  static async paginate<T>(
    query: QueryBuilder<T>,
    page: number = 1,
    perPage: number = 10
  ) {
    const offset = (page - 1) * perPage

    // Get total count for pagination info
    const total = await query.count()

    // Get the actual results
    const data = await query.skip(offset).limit(perPage).get()

    return {
      data,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
        hasNextPage: page < Math.ceil(total / perPage),
        hasPreviousPage: page > 1
      }
    }
  }
}

// Usage
const result = await PaginationService.paginate(
  User.where('status', 'active'),
  2,
  20
)

console.log(result.data) // Array of 20 users
console.log(result.pagination) // Pagination metadata
```

## Pagination with Sorting

When paginating, it's important to use consistent sorting to ensure stable
results:

```ts
const getBlogPosts = async (page: number = 1, perPage: number = 10) => {
  const offset = (page - 1) * perPage

  return await BlogPost.where('status', 'published')
    .orderBy('createdAt', 'desc') // Consistent sorting
    .skip(offset)
    .limit(perPage)
    .get()
}
```

This guide covers the pagination capabilities available in Esix. For more
information about query methods, see the [Retrieving Models](/retrieving-models)
guide.
