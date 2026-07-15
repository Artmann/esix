---
title: Inserting & Updating Models
description: Learn how to create, update, and modify records in your MongoDB database using Esix's intuitive model methods and mass assignment features.
---

When it comes to adding new models to the database, there are two different ways to go about it. You can either use the `create` method and pass it the attributes you want the model to have, or you can create a new instance of the model and call its `save` method.

```ts
// Using the create method.
const firstPost = await BlogPost.create({ title: 'My First Blog Post!' })

// Using the save method.
const secondPost = new BlogPost()

secondPost.title = 'My Second Blog Post!'

await secondPost.save()
```

If the model doesn't have an Id, a new
[ObjectId](https://docs.mongodb.com/manual/reference/method/ObjectId/) will be
created and assigned to it.

When inserting a new model, the `createdAt` property will be filled with the
current timestamp if it's not present.

If you want to update an existing model, you can also use the `save` method to
persist your changes.

```ts
const product = await Product.find('5f5a474b32fa462a5724ff7d')

product.price = 14.99

await product.save()
```

When you call `save` on an already existing model, the `updatedAt` field will be
filled with the current timestamp.

Both the timestamp properties contain the current time in milliseconds since
January 1st, 1970, using JavaScript's
[Date.now](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now)
method.

## First or Create

Sometimes you may want to retrieve a model by certain attributes, or create it
if it doesn't exist. The `firstOrCreate` method will attempt to locate a model
using the given filter criteria. If the model is not found in the database, a
record will be created with the attributes from the filter, plus any additional
attributes passed as a second parameter.

```ts
// Retrieve flight by name or create it if it doesn't exist...
const flight = await Flight.firstOrCreate({
  name: 'London to Paris'
})

// Retrieve flight by name or create it with the name, delayed, and arrival_time attributes...
const flight = await Flight.firstOrCreate(
  { name: 'London to Paris' },
  { delayed: 1, arrival_time: '11:30' }
)
```

The `firstOrCreate` method's first argument contains the attributes that you
want to search for. The second argument contains the additional attributes to
add to the model if it doesn't exist. If the second argument is not provided,
the attributes from the first argument will be used when creating the model.

The lookup and the insert happen in a single atomic `findOneAndUpdate`
operation, and the returned model tells you what happened through its
`wasRecentlyCreated` property. It's `true` when the model was just created and
`false` when an existing model was found, which makes it easy to keep track of
created and skipped records in a seed script.

```ts
const results = { created: 0, skipped: 0 }

for (const { isbn13, title } of books) {
  const book = await Book.firstOrCreate({ isbn13 }, { title })

  if (book.wasRecentlyCreated) {
    results.created += 1
  } else {
    results.skipped += 1
  }
}

console.log(`Created ${results.created} books, skipped ${results.skipped}.`)
```

```text
Created 12 books, skipped 38.
```

`wasRecentlyCreated` is runtime metadata and is never stored in the database.
Models retrieved from the database always have it set to `false`. It's also set
to `true` on models returned from `create` and on new instances after their
first `save`.

To be fully safe against duplicate inserts from concurrent callers, add a
[unique index](https://www.mongodb.com/docs/manual/core/index-unique/) on the
filter fields. When two concurrent calls race, the losing call detects the
duplicate key error and returns the model the winning call inserted.

## Increment & Decrement

When you only need to bump a numeric field, use `increment` and `decrement`
directly on the query builder. They translate to MongoDB's `$inc` operator and
respect the current `where` constraints.

```ts
// Add 1 to the views of the matching post.
await Post.where('id', postId).increment('views')

// Add 5 to the score of every active user.
await User.where('isActive', true).increment('score', 5)

// Subtract from a balance.
await Account.where('id', accountId).decrement('balance', 25)
```

Both methods return the number of documents that were modified.
