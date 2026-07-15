---
title: Retrieving Models
description: Master querying and fetching data with Esix. Learn about where clauses, ordering, aggregations, and advanced query methods for MongoDB.
---

Once you have your models defined, querying your database becomes incredibly straightforward! Each Esix model acts as a powerful query builder, allowing you to fluently search and retrieve documents from your MongoDB collection.

## Finding a Single Record

When you need to find a specific document by its ID, use the `find` method:

```ts
const book = await Book.find(22)
```

```ts
{
  id: '5f5a474b32fa462a5724ff7d',
  title: 'Effective TypeScript'
}
```

`find` accepts both ObjectId hex strings and plain string ids. If the value is
not a valid 24-character hex string, Esix transparently falls back to a string
`_id` lookup. Invalid input never throws — `find` just returns `null` when no
matching document exists.

You can also find a model by a specific field using the `findBy` method:

```ts
const user = await User.findBy('email', 'john@example.com')
```

```ts
{
  id: '5f5a4c36493d53b6caa8410e',
  name: 'John Doe',
  email: 'john@example.com'
}
```

To get the first model that matches your query conditions, use the `first`
method:

```ts
const latestPost = await BlogPost.where('status', 'published')
  .orderBy('createdAt', 'desc')
  .first()
```

```ts
{
  id: '6011a52b9f1b2c4d8e7f3a21',
  title: 'Introducing Aggregate Functions',
  status: 'published',
  createdAt: 1736380800000
}
```

You can also get all the models in the collection.

```ts
const flights = await Flight.all()
```

| id                         | name           |
|----------------------------|----------------|
| `5f5a474b32fa462a5724ff7d` | `AA 100 → JFK` |
| `5f5a474b32fa462a5724ff7e` | `BA 286 → LHR` |
| `5f5a474b32fa462a5724ff7f` | `UA 245 → SFO` |

When you are working with multiple models, you can use methods like `where`
which returns an instance of a `QueryBuilder`. The Query Builder can be used to
filter, sort, and limit your searches.

```ts
const blogPosts = await BlogPost.where('status', 'published')
  .where('categoryId', 4)
  .orderBy('publishedAt', 'desc')
  .limit(12)
  .get()
```

| id                         | title                                | status      | categoryId | publishedAt     |
|----------------------------|--------------------------------------|-------------|------------|-----------------|
| `6011a52b9f1b2c4d8e7f3a21` | `Introducing Aggregate Functions`    | `published` | `4`        | `1736380800000` |
| `60119e8a9f1b2c4d8e7f3a14` | `Querying With Comparison Operators` | `published` | `4`        | `1735862400000` |
| `601198119f1b2c4d8e7f3a09` | `Pagination Patterns in Esix`        | `published` | `4`        | `1734998400000` |

## Comparison Operators

The `where` method supports comparison operators for numeric and date comparisons, similar to Laravel's Eloquent:

```ts
// Greater than
const adults = await User.where('age', '>', 18).get()

// Greater than or equal
const eligibleVoters = await User.where('age', '>=', 18).get()

// Less than
const youngUsers = await User.where('age', '<', 30).get()

// Less than or equal
const affordableProducts = await Product.where('price', '<=', 100).get()

// Equals (explicit)
const exactMatch = await Product.where('price', '=', 49.99).get()

// Not equals
const activeUsers = await User.where('status', '!=', 'banned').get()
const alsActive = await User.where('status', '<>', 'banned').get() // alternative syntax
```

Each call above returns an array of matching records. For example, `adults` looks like:

| id                         | name      | age | status   |
|----------------------------|-----------|-----|----------|
| `5f5a474b32fa462a5724ff7d` | `Alice`   | 32  | `active` |
| `5f5a474b32fa462a5724ff7e` | `Bob`     | 45  | `active` |
| `5f5a474b32fa462a5724ff7f` | `Carol`   | 28  | `active` |

You can chain multiple comparison operators together:

```ts
// Users between 18 and 65 years old
const workingAgeUsers = await User
  .where('age', '>=', 18)
  .where('age', '<=', 65)
  .get()

// Products in a price range
const affordableProducts = await Product
  .where('price', '>', 10)
  .where('price', '<', 100)
  .where('inStock', true)
  .get()

// Posts with many views
const popularPosts = await BlogPost
  .where('views', '>', 1000)
  .where('status', 'published')
  .orderBy('views', 'desc')
  .get()
```

**workingAgeUsers**

| id                         | name      | age | status   |
|----------------------------|-----------|-----|----------|
| `5f5a474b32fa462a5724ff7d` | `Alice`   | 32  | `active` |
| `5f5a474b32fa462a5724ff7e` | `Bob`     | 45  | `active` |
| `5f5a474b32fa462a5724ff80` | `Dimitri` | 64  | `active` |

**affordableProducts**

| id                         | name           | price | inStock |
|----------------------------|----------------|-------|---------|
| `60119e8a9f1b2c4d8e7f3a14` | `Desk Lamp`    | 24.99 | `true`  |
| `60119e8a9f1b2c4d8e7f3a15` | `Floor Lamp`   | 79.00 | `true`  |
| `60119e8a9f1b2c4d8e7f3a16` | `Reading Lamp` | 39.50 | `true`  |

**popularPosts**

| id                         | title                             | views  | status      |
|----------------------------|-----------------------------------|--------|-------------|
| `6011a52b9f1b2c4d8e7f3a21` | `Introducing Aggregate Functions` | 12_840 | `published` |
| `60119e8a9f1b2c4d8e7f3a14` | `Comparison Operators Are Here`   |  6_120 | `published` |
| `601198119f1b2c4d8e7f3a09` | `Pagination Patterns in Esix`     |  3_402 | `published` |

### Supported Operators

| Operator | Description           | Example                         |
|----------|-----------------------|---------------------------------|
| `=`      | Equals                | `.where('age', '=', 25)`       |
| `!=`     | Not equals            | `.where('status', '!=', 'banned')` |
| `<>`     | Not equals (alternate)| `.where('status', '<>', 'banned')` |
| `>`      | Greater than          | `.where('age', '>', 18)`       |
| `>=`     | Greater than or equal | `.where('score', '>=', 100)`   |
| `<`      | Less than             | `.where('age', '<', 65)`       |
| `<=`     | Less than or equal    | `.where('price', '<=', 50)`    |

Note: The two-parameter syntax `where('status', 'published')` is still supported for equality comparisons and remains the recommended approach for simple equality checks.

The values you pass to `where`, `whereIn`, and `whereNotIn` are type-checked against the model's property types, so passing a string to a numeric field like `where('age', '>', '18')` is caught at compile time.

## Null Checks

Use `whereNull` to retrieve models where a field is `null`. Following
MongoDB's null-equality semantics, this also matches documents where the field
is missing entirely:

```ts
const unenrichedBooks = await Book.whereNull('openLibraryEnrichedVersion').get()
```

| id                         | title             | openLibraryEnrichedVersion |
|----------------------------|-------------------|----------------------------|
| `5f5a474b32fa462a5724ff7d` | `Never Enriched`  | `null`                     |
| `5f5a474b32fa462a5724ff7e` | `Imported Legacy` | *(missing)*                |

Conversely, `whereNotNull` retrieves models where a field is present and not
`null`. Documents where the field is `null` or missing are excluded:

```ts
const enrichedBooks = await Book.whereNotNull('openLibraryEnrichedVersion').get()
```

| id                         | title                  | openLibraryEnrichedVersion |
|----------------------------|------------------------|----------------------------|
| `5f5a474b32fa462a5724ff7f` | `Effective TypeScript` | `2`                        |
| `5f5a474b32fa462a5724ff80` | `Domain-Driven Design` | `3`                        |

## Or Conditions

By default, chained conditions are combined with a logical AND. Use `orWhere`
to combine conditions with a logical OR instead. It accepts the same arguments
as `where`, including comparison operators, so you can express selections like
"null or below a version" without loading the whole collection:

```ts
const staleBooks = await Book.whereNull('openLibraryEnrichedVersion')
  .orWhere('openLibraryEnrichedVersion', '<', 3)
  .get()
```

| id                         | title                  | openLibraryEnrichedVersion |
|----------------------------|------------------------|----------------------------|
| `5f5a474b32fa462a5724ff7d` | `Never Enriched`       | `null`                     |
| `5f5a474b32fa462a5724ff7f` | `Effective TypeScript` | `2`                        |

AND binds tighter than OR, just like in SQL. Any `where` calls following an
`orWhere` are ANDed into the most recent OR group, so
`where(a).orWhere(b).where(c)` selects documents matching `a OR (b AND c)`:

```ts
// status is 'draft', OR (status is 'published' AND views > 1000)
const posts = await BlogPost.where('status', 'draft')
  .orWhere('status', 'published')
  .where('views', '>', 1000)
  .get()
```

| id                         | title                             | status      | views  |
|----------------------------|-----------------------------------|-------------|--------|
| `601198119f1b2c4d8e7f3a09` | `Unfinished Ideas`                | `draft`     |      0 |
| `6011a52b9f1b2c4d8e7f3a21` | `Introducing Aggregate Functions` | `published` | 12_840 |

`orWhere` is only available on the Query Builder, so start your chain with
`where`, `whereNull`, or another query method. Note that `orWhere` cannot be
combined with `search()`.

## Array Queries

You can use `whereIn` to retrieve models where a column's value is within a
given array:

```ts
const users = await User.whereIn('id', [1, 2, 3]).get()
```

| id  | name    | age | status     |
|-----|---------|-----|------------|
| `1` | `Alice` | 32  | `active`   |
| `2` | `Bob`   | 45  | `active`   |
| `3` | `Carol` | 28  | `inactive` |

Conversely, you can use `whereNotIn` to retrieve models where a column's value
is not within a given array:

```ts
const users = await User.whereNotIn('id', [1, 2, 3]).get()
```

| id  | name      | age | status   |
|-----|-----------|-----|----------|
| `4` | `Dimitri` | 64  | `active` |
| `5` | `Eli`     | 19  | `active` |
| `6` | `Farah`   | 37  | `active` |

If you are only interested in a single attribute of a model, you can use the
`pluck` method to get an array of values for that attribute.

```ts
const productNames = await Product.where('category', 'lamps').pluck('name')
```

```ts
['Desk Lamp', 'Floor Lamp', 'Reading Lamp']
```

## Distinct Values

Use `distinct` to get the unique values of a field across the current query:

```ts
const tags = await Post.where('published', true).distinct('tag')
```

```ts
['mongodb', 'pagination', 'typescript']
```

The result is a deduplicated array of values for the field, respecting any
active `where` constraints.

## Full-Text Search

Once your collection has a [text index](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-text/),
use `search` to run full-text queries:

```ts
const results = await Post.search('mongodb typescript').get()
```

| id                         | title                              | published | tag          |
|----------------------------|------------------------------------|-----------|--------------|
| `6011a52b9f1b2c4d8e7f3a21` | `Querying MongoDB With TypeScript` | `true`    | `typescript` |
| `60119e8a9f1b2c4d8e7f3a14` | `Why MongoDB Aggregations Matter`  | `true`    | `mongodb`    |
| `601198119f1b2c4d8e7f3a09` | `Typed Schemas for MongoDB`        | `true`    | `mongodb`    |

If the collection has no text index, Esix surfaces a descriptive error
explaining how to create one.

## Pagination

The fastest way to paginate is `paginate(page, perPage)`, which returns the
page of models alongside the metadata you need to render pagination UIs:

```ts
const { data, total, page, perPage, lastPage } = await Post
  .where('published', true)
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

For more control, you can fall back to manual offset pagination using `skip`
and `limit`:

```ts
const page = 2
const perPage = 10
const offset = (page - 1) * perPage

const products = await Product.where('category', 'electronics')
  .skip(offset)
  .limit(perPage)
  .get()
```

| id                         | name              | category      | price  |
|----------------------------|-------------------|---------------|--------|
| `60119e8a9f1b2c4d8e7f3a21` | `Bluetooth Speaker` | `electronics` |  59.00 |
| `60119e8a9f1b2c4d8e7f3a22` | `Smart Bulb`      | `electronics` |  14.99 |
| `60119e8a9f1b2c4d8e7f3a23` | `USB-C Hub`       | `electronics` |  34.50 |

You can find out more about the different methods available by consulting the
[Esix source on GitHub](https://github.com/artmann/esix/tree/main/packages/esix/src).

## Aggregate Functions

Once you are happy with your query, you can use the aggregate functions
available in Esix to perform calculations on the data set. The supported
aggregates are `average`, `count`, `max`, `min`, `percentile`, and `sum`.

```ts
await Product.where('category', 'lamps').average('price')

await Product.where('category', 'lamps').count()

await Product.where('category', 'lamps').max('price')

await Product.where('category', 'lamps').min('price')

await Product.where('category', 'lamps').percentile('price', 50)

await Product.where('category', 'lamps').sum('price')
```

```text
45.99
12
199.99
9.99
39.50
551.88
```

When the query matches no documents, the numeric aggregates (`average`,
`max`, `min`, `percentile`, `sum`) return `0` rather than throwing.

`percentile` requires `n` to be a finite number between `0` and `100`. Any
other value (including `NaN` and `Infinity`) throws a descriptive error so
that bad inputs do not silently return misleading results.
