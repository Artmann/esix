---
title: Aggregation Dashboard
description: Build an admin metrics endpoint that returns counts, sums, averages, percentiles, and grouped breakdowns from a single MongoDB collection.
---

Most apps eventually need a metrics endpoint — total orders, revenue, average
order value, response-time percentiles, top categories. This recipe walks
through building one in Express using Esix's aggregation helpers, plus a single
raw `aggregate` pipeline for the breakdown that doesn't fit the helpers.

Esix features used: `count`, `sum`, `average`, `percentile`, chained
`where(...).sum(...)`, and the raw `aggregate` pipeline.

## What You'll Build

```
GET /admin/metrics?from=1735689600000&to=1746057600000
```

Response:

```ts
{
  metrics: {
    totalOrders: 1842,
    revenue: 248_915.4,
    averageOrderValue: 135.13,
    p95FulfillmentMs: 8_400,
    topCategories: [
      { category: 'lamps', count: 612, revenue: 84_213.0 },
      { category: 'desks', count: 410, revenue: 79_482.5 },
      { category: 'chairs', count: 388, revenue: 51_290.9 }
    ]
  }
}
```

## The Order Model

```ts
// src/models/order.ts
import { BaseModel } from 'esix'

export default class Order extends BaseModel {
  public customerId = ''
  public amount = 0
  public category = ''
  public placedAt = 0
  public fulfilledAt: number | null = null
  public fulfillmentMs = 0
}
```

`placedAt` and `fulfilledAt` are unix milliseconds — easy to filter against
and easy to serialise from a JSON request.

## The Metrics Endpoint

Define the query-string contract with zod, then compute all five metrics in
parallel with `Promise.all`. Each helper is its own MongoDB round-trip, so
doing them concurrently keeps the endpoint snappy:

```ts
// src/routes/metrics.ts
import { Router } from 'express'
import { z } from 'zod'
import Order from '../models/order'

const MetricsQuerySchema = z.object({
  from: z.coerce.number().int().nonnegative().default(0),
  to: z.coerce.number().int().nonnegative().default(() => Date.now())
})

const router = Router()

router.get('/', async (request, response) => {
  const { from, to } = MetricsQuerySchema.parse(request.query)

  const inRange = () =>
    Order.where('placedAt', '>=', from).where('placedAt', '<=', to)

  const [
    totalOrders,
    revenue,
    averageOrderValue,
    p95FulfillmentMs,
    topCategories
  ] = await Promise.all([
    inRange().count(),
    inRange().sum('amount'),
    inRange().average('amount'),
    inRange().where('fulfilledAt', '!=', null).percentile('fulfillmentMs', 95),
    topCategoriesByRevenue(from, to)
  ])

  response.json({
    metrics: {
      totalOrders,
      revenue,
      averageOrderValue,
      p95FulfillmentMs,
      topCategories
    }
  })
})

export default router
```

A few things to notice:

- **`inRange()` is a factory, not a stored query.** Each call returns a fresh
  `QueryBuilder`. Reusing a single instance across `count()` and `sum()` would
  not work — once a terminal method runs the builder is consumed.
- **Aggregates return `0` on empty results.** No need for null checks on the
  numeric metrics.
- **Filtering chains naturally into aggregates.** The p95 line filters out
  unfulfilled orders before computing the percentile.

## Grouped Breakdowns with `aggregate`

`count` / `sum` / `average` are perfect for single numbers, but the top
categories list needs a `$group` stage. Drop down to MongoDB's pipeline:

```ts
// src/routes/top-categories.ts
import Order from '../models/order'

interface CategoryRow {
  _id: string
  count: number
  revenue: number
}

export async function topCategoriesByRevenue(
  from: number,
  to: number
): Promise<{ category: string; count: number; revenue: number }[]> {
  const rows = await Order.aggregate<CategoryRow>([
    { $match: { placedAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        revenue: { $sum: '$amount' }
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: 3 }
  ])

  return rows.map((row) => ({
    category: row._id,
    count: row.count,
    revenue: row.revenue
  }))
}
```

`aggregate` is the escape hatch when the chained helpers don't cover what you
need. Keep the pipeline beside the model rather than inside the route handler
so the handler keeps reading like a summary, not a query plan.

## Trying It Out

```sh
curl 'http://localhost:3000/admin/metrics?from=1735689600000&to=1746057600000'
```

```ts
{
  metrics: {
    totalOrders: 1842,
    revenue: 248915.4,
    averageOrderValue: 135.13,
    p95FulfillmentMs: 8400,
    topCategories: [
      { category: 'lamps',  count: 612, revenue: 84213.0 },
      { category: 'desks',  count: 410, revenue: 79482.5 },
      { category: 'chairs', count: 388, revenue: 51290.9 }
    ]
  }
}
```

## Pattern Notes

- **Five round trips beats one cluttered pipeline.** When each metric is its
  own simple call, the code reads top-to-bottom and individual metrics are
  easy to test in isolation. Reach for a single big `$facet` only when latency
  numbers tell you to.
- **Percentiles need a clean dataset.** Filter out rows that don't have the
  measured field (`fulfilledAt !== null`) before calling `percentile`,
  otherwise you'll pollute the distribution with zeroes.
- **Type the pipeline result.** `Order.aggregate<CategoryRow>(...)` keeps the
  raw MongoDB shape — including `_id` — under your control.

## What's Next

- [Atomic Counters](/docs/cookbook/express/atomic-counters) — increment metrics
  in real time instead of recomputing.
- [Retrieving Models — Aggregate Functions](/docs/retrieving-models) — full
  reference for `count`, `sum`, `average`, `min`, `max`, and `percentile`.
