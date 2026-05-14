---
title: Streaming Aggregations with Suspense
description: Build an admin dashboard where each metric tile streams in independently using React Suspense, Server Components, and Esix's aggregation helpers.
---

A dashboard typically renders four or five independent metrics. If you await
them all at the page level, the whole page waits for the slowest one. Server
Components plus Suspense let each tile stream in on its own schedule — fast
metrics paint immediately, the percentile query keeps spinning until it's
ready.

Esix features used: `count`, `sum`, `average`, `percentile`. React features
used: `<Suspense>` boundaries, async server components.

## What You'll Build

An admin dashboard with four tiles:

- Orders today
- Revenue today
- Average order value
- p95 fulfillment time

Each tile is its own async server component, wrapped in its own Suspense
boundary, with its own fallback skeleton.

## The Order Model

```ts
// app/models/order.ts
import { BaseModel } from 'esix'

export default class Order extends BaseModel {
  public customerId = ''
  public amount = 0
  public placedAt = 0
  public fulfilledAt: number | null = null
  public fulfillmentMs = 0
}
```

## One Component Per Metric

Each tile owns its own query. Keeping them separate is the whole point — it's
what lets Suspense stream them in independently:

```tsx
// app/admin/tiles.tsx
import Order from '../models/order'

function startOfToday(): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.getTime()
}

const todayOrders = () => Order.where('placedAt', '>=', startOfToday())

export async function OrdersTodayTile() {
  const count = await todayOrders().count()
  return <Tile label="Orders today" value={count.toLocaleString()} />
}

export async function RevenueTodayTile() {
  const revenue = await todayOrders().sum('amount')
  return (
    <Tile
      label="Revenue today"
      value={`$${revenue.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`}
    />
  )
}

export async function AverageOrderValueTile() {
  const aov = await todayOrders().average('amount')
  return (
    <Tile label="Average order value" value={`$${aov.toFixed(2)}`} />
  )
}

export async function P95FulfillmentTile() {
  const p95 = await todayOrders()
    .where('fulfilledAt', '!=', null)
    .percentile('fulfillmentMs', 95)
  return <Tile label="p95 fulfillment" value={`${Math.round(p95)} ms`} />
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
    </div>
  )
}
```

A couple of patterns worth flagging:

- **`todayOrders()` is a factory.** It returns a fresh `QueryBuilder` each
  time. You can't reuse a single builder across `count()` and `sum()` — every
  terminal call needs its own builder.
- **Filter before percentile.** Including rows where `fulfilledAt` is `null`
  would skew the distribution. The chained `where('fulfilledAt', '!=', null)`
  fixes that.
- **Aggregates return `0` on empty results.** No null-handling needed even on
  a brand-new day.

## The Dashboard Page

Wrap each tile in its own Suspense boundary. The page itself doesn't `await`
anything — Next.js streams the fallback skeletons first, then swaps in each
tile as its query resolves:

```tsx
// app/admin/page.tsx
import { Suspense } from 'react'
import {
  AverageOrderValueTile,
  OrdersTodayTile,
  P95FulfillmentTile,
  RevenueTodayTile
} from './tiles'

export const dynamic = 'force-dynamic'

export default function AdminDashboard() {
  return (
    <main>
      <h1>Today</h1>
      <section className="tile-grid">
        <Suspense fallback={<Skeleton label="Orders today" />}>
          <OrdersTodayTile />
        </Suspense>
        <Suspense fallback={<Skeleton label="Revenue today" />}>
          <RevenueTodayTile />
        </Suspense>
        <Suspense fallback={<Skeleton label="Average order value" />}>
          <AverageOrderValueTile />
        </Suspense>
        <Suspense fallback={<Skeleton label="p95 fulfillment" />}>
          <P95FulfillmentTile />
        </Suspense>
      </section>
    </main>
  )
}

function Skeleton({ label }: { label: string }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value tile-value-loading">…</div>
    </div>
  )
}
```

`export const dynamic = 'force-dynamic'` is the right choice here — a
dashboard should never be cached.

## Why Streaming Beats `Promise.all`

You could write this with a single page-level `await Promise.all([...])` and
hand every metric to one tile component. It would render correctly, but the
user wouldn't see anything until the slowest query finished. With one
Suspense boundary per tile, fast metrics appear right away and slow ones
catch up. Same total work, much better perceived performance.

## Pattern Notes

- **One boundary per tile.** Boundaries are what unblocks streaming — without
  them, an `await` further down still blocks the page shell.
- **Don't pre-await in the parent.** Once the parent component is async and
  blocks on data, you've lost streaming for its whole subtree.
- **Watch out for caching.** Default fetch caching doesn't apply to direct
  database calls, but Next.js's `unstable_cache` does. Wrap each metric in
  `unstable_cache` with a short TTL if you want to share results across
  requests.

## What's Next

- [Querying in Server Components](/docs/cookbook/nextjs/server-components) —
  the foundational pattern these tiles build on.
- [Filter and Paginate](/docs/cookbook/nextjs/filter-and-paginate) — pair the
  dashboard with a drill-down list view.
- [Aggregation Dashboard](/docs/cookbook/express/aggregation-dashboard) — the
  Express version of these helpers in one big JSON response.
