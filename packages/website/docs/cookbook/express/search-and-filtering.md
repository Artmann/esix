---
title: Search and Filtering
description: Build a product catalog endpoint with multi-parameter filtering, sorting, and full-text search using Esix's query builder.
---

Catalog and listing endpoints almost always accept a grab bag of filters from
the URL — category, price range, sort, search term. This recipe shows how to
turn untrusted query strings into a safe, chained Esix query without writing
your own ad-hoc SQL-like parser.

Esix features used: `where` with comparison operators, `whereIn`, `orderBy`,
`search`, and `paginate`.

## What You'll Build

```
GET /products?category=lamps&category=desks&minPrice=20&maxPrice=200&sort=price&order=asc&q=brass&page=1
```

Every parameter is optional. Any combination should compose cleanly.

## The Product Model

```ts
// src/models/product.ts
import { BaseModel } from 'esix'

export default class Product extends BaseModel {
  public name = ''
  public category = ''
  public price = 0
  public inStock = true
}
```

> **Note:** Full-text search requires a [text
> index](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-text/)
> on the fields you want to search (typically `name` and `description`). Create
> it once with `db.products.createIndex({ name: 'text' })`.

## Parsing the Query Safely

The trick is to translate raw query params into a typed shape before touching
Esix. A zod schema gives you that translation, validation, and the TypeScript
type all in one definition:

```ts
// src/routes/products/schema.ts
import { z } from 'zod'

export const ProductFiltersSchema = z.object({
  category: z
    .union([z.string(), z.array(z.string())])
    .transform((value) => (Array.isArray(value) ? value : [value]))
    .optional()
    .default([]),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  q: z.string().min(1).optional(),
  sort: z.enum(['price', 'name', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20)
})

export type ProductFilters = z.infer<typeof ProductFiltersSchema>
```

Two important guards live here: `z.enum(['price', 'name', 'createdAt'])` is an
allowlist of sortable fields (so callers can't sort by `passwordHash`), and
`max(100)` is an upper bound on `perPage` (so they can't ask for a million
records). `z.coerce.number()` handles the fact that query string values arrive
as strings.

## Building the Query

Apply each filter conditionally. Esix's fluent interface keeps this readable:

```ts
// src/routes/products/index.ts
import { Router } from 'express'
import Product from '../../models/product'
import { ProductFiltersSchema } from './schema'

const router = Router()

router.get('/', async (request, response) => {
  const filters = ProductFiltersSchema.parse(request.query)

  let query = filters.q
    ? Product.search(filters.q)
    : Product.where('inStock', true)

  if (filters.category.length > 0) {
    query = query.whereIn('category', filters.category)
  }

  if (filters.minPrice !== undefined) {
    query = query.where('price', '>=', filters.minPrice)
  }

  if (filters.maxPrice !== undefined) {
    query = query.where('price', '<=', filters.maxPrice)
  }

  query = query.orderBy(filters.sort, filters.order)

  const { data, ...pagination } = await query.paginate(
    filters.page,
    filters.perPage
  )

  response.json({ products: data, pagination })
})

export default router
```

A few patterns worth pointing out:

- **`search` is the first link in the chain.** When the request includes a
  search term, it kicks off the query; otherwise you start with a `where`. Both
  return a `QueryBuilder`, so the rest of the chain doesn't care.
- **`whereIn` handles array params naturally.** The schema normalises both
  `?category=lamps` and `?category=lamps&category=desks` into a string array,
  which is exactly what `whereIn` wants.
- **Comparison operators handle the price range.** `where('price', '>=',
  minPrice)` and the matching `<=` give you a numeric between without leaving
  the query builder.

## Trying It Out

```sh
curl 'http://localhost:3000/products?category=lamps&category=desks&minPrice=20&maxPrice=200&sort=price&order=asc'
```

```ts
{
  products: [
    {
      id: '60119e8a9f1b2c4d8e7f3a21',
      name: 'Desk Lamp',
      category: 'lamps',
      price: 24.99,
      inStock: true
    },
    {
      id: '60119e8a9f1b2c4d8e7f3a22',
      name: 'Reading Lamp',
      category: 'lamps',
      price: 39.50,
      inStock: true
    }
  ],
  pagination: {
    total: 2,
    page: 1,
    perPage: 20,
    lastPage: 1
  }
}
```

A search request looks identical from the client:

```sh
curl 'http://localhost:3000/products?q=brass'
```

## Pattern Notes

- **Always parse before you query.** `ProductFiltersSchema.parse(...)` is the
  cleanest way to keep injection-style bugs out of your handlers — and you get
  the inferred TypeScript type as a bonus.
- **Allowlist sortable fields.** `z.enum([...])` is the smallest,
  highest-value piece of validation you can add to a listing endpoint.
- **Sensible defaults beat optional everything.** zod's `.default(...)` keeps
  every filter sensible when the client sends nothing — your tests and your
  front-end will thank you.

## What's Next

- [Aggregation Dashboard](/docs/cookbook/express/aggregation-dashboard) — apply
  the same chained-query pattern to summary metrics.
- [Retrieving Models](/docs/retrieving-models) — the full reference for `where`,
  `whereIn`, `orderBy`, and `search`.
- [Pagination](/docs/pagination) — more on `paginate` response shape.
