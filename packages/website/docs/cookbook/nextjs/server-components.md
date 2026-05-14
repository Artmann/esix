---
title: Querying in Server Components
description: Use Esix inside async React Server Components to fetch data directly — no API route required. Includes list and detail pages, and graceful handling of missing records.
---

React Server Components let you `await` straight inside a component, which
means an entire layer of API plumbing — the `/api/products` route, the
`fetch('/api/products')` call, the JSON marshalling — can disappear. Your
component asks Esix for what it needs, and that's it.

Esix features used: `all`, `find`. Next.js features used: async server
components, dynamic route segments, and `notFound()`.

> **Note:** Esix talks to MongoDB and must run on the server. The patterns
> below all live in server components (no `'use client'` directive). If you
> need to surface data inside a client component, fetch it in a server parent
> and pass it as a prop.

## What You'll Build

```
/products            → server-rendered product list
/products/[id]       → server-rendered product detail page (404s cleanly)
```

## Project Setup

Inside a Next.js App Router project:

```sh
yarn add esix mongodb
```

Configure the connection by setting `DB_URL` and `DB_DATABASE` in
`.env.local`. Esix picks them up automatically the first time it opens a
collection.

## The Product Model

A Server Component can import the model directly — there's no separate "API
layer" to keep in sync:

```ts
// app/models/product.ts
import { BaseModel } from 'esix'

export default class Product extends BaseModel {
  public name = ''
  public description = ''
  public price = 0
  public inStock = true
}
```

## The List Page

A server component is just an `async` function — `await` the query and render
the result:

```tsx
// app/products/page.tsx
import Link from 'next/link'
import Product from '../models/product'

export default async function ProductsPage() {
  const products = await Product.where('inStock', true)
    .orderBy('name', 'asc')
    .get()

  return (
    <main>
      <h1>Products</h1>
      <ul>
        {products.map((product) => (
          <li key={product.id}>
            <Link href={`/products/${product.id}`}>{product.name}</Link>
            <span> — ${product.price.toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

No `useEffect`, no loading state, no `fetch`. The HTML for the list is
generated on the server with data already inlined.

## The Detail Page

Dynamic route segments arrive as the `params` prop. When `find` returns
`null`, hand off to Next.js's built-in `notFound()` helper — it renders the
nearest `not-found.tsx` and sets a 404 status:

```tsx
// app/products/[id]/page.tsx
import { notFound } from 'next/navigation'
import Product from '../../models/product'

interface PageProps {
  params: { id: string }
}

export default async function ProductPage({ params }: PageProps) {
  const product = await Product.find(params.id)

  if (!product) {
    notFound()
  }

  return (
    <main>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <strong>${product.price.toFixed(2)}</strong>
    </main>
  )
}
```

`find` accepts ObjectId hex strings and plain string ids, and it never
throws on bad input — perfect for trusting whatever Next.js routes hand you.

## Generating Static Pages at Build Time

If your catalog doesn't change often, you can pre-render every product page
with `generateStaticParams`. Esix queries run during the build just like any
other server code:

```tsx
// app/products/[id]/page.tsx (additional export)
import Product from '../../models/product'

export async function generateStaticParams() {
  const products = await Product.pluck('id')
  return products.map((id) => ({ id }))
}
```

`pluck` returns a flat array of values for a single field — exactly the shape
`generateStaticParams` wants.

## Caching and Revalidation

Server components inherit Next.js's caching model. The two most common
patterns:

```tsx
// Re-render the page at most every 60 seconds.
export const revalidate = 60

// Always run fresh on every request.
export const dynamic = 'force-dynamic'
```

Pick `revalidate` for a catalog page, `force-dynamic` for anything personalised
(carts, dashboards).

## Pattern Notes

- **No API tier needed.** A Server Component calling Esix replaces the
  `/api/products → fetch → component` triangle with a single function.
- **Pass models down, not into client components directly.** Class instances
  with methods don't serialise. If you need to hand data to a client child,
  spread the fields you actually use into a plain object first.
- **`notFound()` is the right escape hatch.** It plays nicely with `<Link>`
  prefetching and gives you the correct status code for free.

## What's Next

- [Mutations with Server Actions](/docs/cookbook/nextjs/server-actions) — the
  matching pattern for writes.
- [Filter and Paginate](/docs/cookbook/nextjs/filter-and-paginate) — drive
  this list page from URL search params.
- [Retrieving Models](/docs/retrieving-models) — full reference for the query
  methods used here.
