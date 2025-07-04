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

## First or Create

Sometimes you may want to retrieve a model by certain attributes, or create it if it doesn't exist. The `firstOrCreate` method will attempt to locate a model using the given filter criteria. If the model is not found in the database, a record will be created with the attributes from the filter, plus any additional attributes passed as a second parameter.

```ts
// Retrieve flight by name or create it if it doesn't exist...
const flight = await Flight.firstOrCreate({
  name: 'London to Paris'
});

// Retrieve flight by name or create it with the name, delayed, and arrival_time attributes...
const flight = await Flight.firstOrCreate(
  { name: 'London to Paris' },
  { delayed: 1, arrival_time: '11:30' }
);
```

The `firstOrCreate` method's first argument contains the attributes that you want to search for. The second argument contains the additional attributes to add to the model if it doesn't exist. If the second argument is not provided, the attributes from the first argument will be used when creating the model.
