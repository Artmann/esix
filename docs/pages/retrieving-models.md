---
title: Retrieving Models
---

# Retrieving Models

Once you have your models defined, you can use them to query the database for them.

The `BaseModel` class comes with a bunch of static methods that you can use to retrieve models.

If you are looking for a single model you can use the `find` method to get an instance of a model matching the given id.

```ts
const book = await Book.find(22);

console.log(book.title);
```

You can also get all the models in the collection.

```ts
const flights = await Flight.all();

flights.forEach(flight => {
  console.log(flight.name);
});
```

When you are working with multiple models, you can use methods like `where` which returns an instance of a `QueryBuilder`. The Query Builder can be used to filter, sort, and limit your searches.

```ts
const blogPosts = await BlogPost
  .where('status', 'published')
  .where('categoryId', 4)
  .orderBy('publishedAt', 'desc')
  .limit(12)
  .get();

blogPosts.forEach(post => console.log(post.title));
```

You can find out more about the different methods available by consulting the API documentation for [BaseModel](/api/classes/basemodel.html) and [QueryBuilder](/api/classes/querybuilder.html).
