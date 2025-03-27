---
title: Defining Models
---

# Defining Models

Esix provides a beautiful, simple ActiveRecord implementation for working with
your database. Each collection has a corresponding "Model" which is used to
interact with that collection. Models allow you to query for data in your
tables, as well as insert new documents into the collection.

Models are the entry point for working with data in Esix so let's create our
first model.

```ts
import { BaseModel } from 'esix'

class BlogPost extends BaseModel {
  public title = ''
  public publishedAt = 0
}
```

By defining a model and extending the `BaseModel` class, you get access to all
of Esix's functionality and you can use it to
[Create, Update](/inserting-and-updating-models) and [Query](/retrieving-models)
documents from the database.

The model will already have `id` property which will be defaulted to an
[ObjectId](https://docs.mongodb.com/manual/reference/method/ObjectId/) unless
you provide one yourself.

It also comes with two timestamp properties, `createdAt` and `updatedAt` which
will be updated during the model's lifecycle. When a model is created, the
`createdAt` property will be populated with the current timestamp, and every
time you update or save your model, the `updatedAt` property will have the
current timestamp.

Both values contain the current time in milliseconds since January 1st, 1970,
using JavaScript's
[Date.now](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now)
function.

The collection the models act upon is determined by name of the class. The class
name is transformed into a dasherized and pluralized version and this is used
for all operations against the database.

For example, if you have a class named `BlogPost`, the collection name will be
`blog-posts`. This is due to Esix's strong belief in
[Convention over Configuration](https://en.wikipedia.org/wiki/Convention_over_configuration).
