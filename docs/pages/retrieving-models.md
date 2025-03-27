---
title: Retrieving Models
---

# Retrieving Models

Once you have your models defined, you can use them to query the database for
them. You can think of each Eloquent model as a powerful
[query builder](/api/classes/querybuilder.html) allowing you to fluently query
the documents associated with the model.

If you are looking for a single model you can use the `find` method to get an
instance of a model matching the given id.

```ts
const book = await Book.find(22)

console.log(book.title)
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

If you are only interested in a single attribute of a model, you can use the
`pluck` method to get an array of values for that attribute.

```ts
const productNames = await Product.where('category', 'lamps').pluck('name')

productNames.forEach((name) => console.log(name))
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
