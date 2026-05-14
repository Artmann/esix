---
title: Filter and Paginate with searchParams
description: Drive a paginated, filterable catalog page from URL search params using Esix's paginate helper and the Next.js App Router.
---

When list state lives in the URL — `/products?category=lamps&page=2` — pages
become shareable, the back button works, and the server has everything it
needs on the first request. This recipe shows how to build that page in the
App Router with Esix doing the heavy lifting.

Esix features used: `paginate`, `where`, `whereIn`, `orderBy`. Next.js
features used: `searchParams` prop on async server components.

## What You'll Build

A page at `/products` that reads filters from the URL, runs a single Esix
query, and renders the results plus next/prev links:

```
/products?category=lamps&category=desks&minPrice=20&maxPrice=200&page=2
```

## The Product Model

```ts
// app/models/product.ts
import { BaseModel } from 'esix'

export default class Product extends BaseModel {
  public name = ''
  public category = ''
  public price = 0
  public inStock = true
}
```

## Parsing Search Params

`searchParams` arrives as `Record<string, string | string[] | undefined>` —
narrow it to a typed shape before touching Esix. A zod schema gives you the
parsing, validation, and the TypeScript type from a single definition:

```sh
yarn add zod
```

```ts
// app/products/schema.ts
import { z } from 'zod'

export const ProductFiltersSchema = z.object({
  category: z
    .union([z.string(), z.array(z.string())])
    .transform((value) => (Array.isArray(value) ? value : [value]))
    .optional()
    .default([]),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20)
})

export type ProductFilters = z.infer<typeof ProductFiltersSchema>
```

The same parsing strategy you'd use in an [Express
endpoint](/docs/cookbook/express/search-and-filtering) — typed shape in,
defaults applied, upper bound on `perPage`. `z.coerce.number()` is the key
piece: every search param arrives as a string, and the schema converts and
validates in one step.

## The Page Component

`searchParams` is passed directly to the page as a prop. Build the query
conditionally and call `paginate` once:

```tsx
// app/products/page.tsx
import Link from 'next/link'
import Product from '../models/product'
import { ProductFiltersSchema } from './schema'

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const filters = ProductFiltersSchema.parse(searchParams)

  let query = Product.where('inStock', true)

  if (filters.category.length > 0) {
    query = query.whereIn('category', filters.category)
  }

  if (filters.minPrice !== undefined) {
    query = query.where('price', '>=', filters.minPrice)
  }

  if (filters.maxPrice !== undefined) {
    query = query.where('price', '<=', filters.maxPrice)
  }

  const { data, page, lastPage, total } = await query
    .orderBy('name', 'asc')
    .paginate(filters.page, filters.perPage)

  return (
    <main>
      <h1>Products ({total})</h1>

      <ul>
        {data.map((product) => (
          <li key={product.id}>
            <Link href={`/products/${product.id}`}>{product.name}</Link>
            <span> — ${product.price.toFixed(2)}</span>
          </li>
        ))}
      </ul>

      <Pager
        page={page}
        lastPage={lastPage}
        searchParams={searchParams}
      />
    </main>
  )
}
```

`paginate` returns everything you need to render the navigation — `page`,
`lastPage`, `total`, `perPage`, and the page of `data` itself.

## Building Page Links

Pager links should preserve every other filter — drop the user back where they
were, just on a different page. A tiny helper rebuilds the query string:

```tsx
// app/products/pager.tsx
import Link from 'next/link'

interface Props {
  page: number
  lastPage: number
  searchParams: Record<string, string | string[] | undefined>
}

function buildHref(
  searchParams: Record<string, string | string[] | undefined>,
  page: number
): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'page') continue
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v)
    } else if (typeof value === 'string') {
      params.append(key, value)
    }
  }

  params.set('page', String(page))
  return `?${params.toString()}`
}

export default function Pager({ page, lastPage, searchParams }: Props) {
  return (
    <nav>
      {page > 1 && (
        <Link href={buildHref(searchParams, page - 1)}>← Previous</Link>
      )}
      <span> Page {page} of {lastPage} </span>
      {page < lastPage && (
        <Link href={buildHref(searchParams, page + 1)}>Next →</Link>
      )}
    </nav>
  )
}
```

`<Link>` does client-side navigation when possible, but on the server side the
page re-runs with the new `searchParams`, the Esix query re-runs, and the new
HTML streams down. The catalog stays fully indexable and shareable.

## Filter UI

A plain HTML form is enough — point it at the current page with `method="get"`
and the browser does the URL building for you:

```tsx
// app/products/filter-form.tsx
export default function FilterForm({
  defaults
}: {
  defaults: { minPrice: number | null; maxPrice: number | null }
}) {
  return (
    <form action="/products" method="get">
      <label>
        Min price
        <input
          name="minPrice"
          type="number"
          defaultValue={defaults.minPrice ?? ''}
        />
      </label>
      <label>
        Max price
        <input
          name="maxPrice"
          type="number"
          defaultValue={defaults.maxPrice ?? ''}
        />
      </label>
      <button type="submit">Apply</button>
    </form>
  )
}
```

No client state, no `useState` hook — submitting reloads the page with the
new search params, which is exactly what we want.

## Pattern Notes

- **URL is the state machine.** Every filter that influences what the page
  shows belongs in `searchParams`. Server components re-render on URL change
  for free.
- **Cap `perPage`.** `z.coerce.number().max(100)` does the work — a client
  setting `?perPage=1000000` would otherwise be the path of least resistance
  to an OOM.
- **`paginate` over hand-rolled `skip/limit`.** You get `total` and `lastPage`
  back, which is exactly what the Pager component needs — and Esix validates
  the inputs for you.

## What's Next

- [Querying in Server Components](/docs/cookbook/nextjs/server-components) —
  the foundational patterns this page builds on.
- [Streaming Aggregations](/docs/cookbook/nextjs/streaming-aggregations) —
  pair this list view with summary metrics that stream in.
- [Pagination](/docs/pagination) — reference for the `paginate` response.
