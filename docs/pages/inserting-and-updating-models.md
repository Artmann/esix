---
title: Inserting & Updating Models
---

# Inserting & Updating Models

When it comes to adding new models to the database, there are two different ways
to go about it. You can either use the `create` method and pass it the
attributes you want the model to have, or you can create a new instance of the
model and call it's `save` method.

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
