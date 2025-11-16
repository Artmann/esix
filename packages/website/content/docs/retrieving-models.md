---
title: Retrieving Models
description: Master querying and fetching data with Esix. Learn about where clauses, ordering, aggregations, and advanced query methods for MongoDB.
---

# Retrieving Models

Once you have your models defined, querying your database becomes incredibly straightforward! Each Esix model acts as a powerful query builder, allowing you to fluently search and retrieve documents from your MongoDB collection.

## Finding a Single Record

When you need to find a specific document by its ID, use the `find` method:

```ts
const book = await Book.find(22)

console.log(book.title)
```

You can also find a model by a specific field using the `findBy` method:

```ts
const user = await User.findBy('email', 'john@example.com')

console.log(user.name)
```

To get the first model that matches your query conditions, use the `first`
method:

```ts
const latestPost = await BlogPost.where('status', 'published')
  .orderBy('createdAt', 'desc')
  .first()

console.log(latestPost.title)
```

You can also get all the models in the collection.

```ts
const flights = await Flight.all()

flights.forEach((flight) => {
  console.log(flight.name)
})
```

When you are working with multiple models, you can use methods like `where`
which returns an instance of a `QueryBuilder`. The Query Builder can be used to
filter, sort, and limit your searches.

```ts
const blogPosts = await BlogPost.where('status', 'published')
  .where('categoryId', 4)
  .orderBy('publishedAt', 'desc')
  .limit(12)
  .get()

blogPosts.forEach((post) => console.log(post.title))
```

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

## Array Queries

You can use `whereIn` to retrieve models where a column's value is within a
given array:

```ts
const users = await User.whereIn('id', [1, 2, 3]).get()
```

Conversely, you can use `whereNotIn` to retrieve models where a column's value
is not within a given array:

```ts
const users = await User.whereNotIn('id', [1, 2, 3]).get()
```

If you are only interested in a single attribute of a model, you can use the
`pluck` method to get an array of values for that attribute.

```ts
const productNames = await Product.where('category', 'lamps').pluck('name')

productNames.forEach((name) => console.log(name))
```

## Pagination

For pagination, you can use the `skip` method to offset results and combine it
with `limit`:

```ts
const page = 2
const perPage = 10
const offset = (page - 1) * perPage

const products = await Product.where('category', 'electronics')
  .skip(offset)
  .limit(perPage)
  .get()
```

You can find out more about the different methods available by consulting the
API documentation for [BaseModel](/api/classes/basemodel.html) and
[QueryBuilder](/api/classes/querybuilder.html).

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
