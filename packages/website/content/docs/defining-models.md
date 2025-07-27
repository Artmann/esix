---
title: Defining Models
description: Learn how to create and structure your Esix models with TypeScript classes, including property definitions, relationships, and model conventions.
---

# Defining Models

Models are the heart of Esix! They provide a beautiful, simple ActiveRecord-style implementation for working with your MongoDB collections. Each collection in your database has a corresponding model class that makes it easy to query, create, and update your data.

Think of models as the bridge between your TypeScript code and your MongoDB collections. Let's create your first model and see how simple it is!

## Creating a Basic Model

Here's how you create a simple blog post model:

```ts
import { BaseModel } from 'esix'

class BlogPost extends BaseModel {
  public title = ''
  public publishedAt = 0
}
```

That's it! By extending the `BaseModel` class, you automatically get access to all of Esix's powerful features. Your model can now [create and update](/docs/inserting-and-updating-models) documents and [query](/docs/retrieving-models) your MongoDB collection.

## Built-in Properties

Every Esix model automatically comes with some helpful built-in properties:

### `id`
Your model gets an `id` property that defaults to a MongoDB [ObjectId](https://docs.mongodb.com/manual/reference/method/ObjectId/). You can also provide your own custom ID if needed.

### Timestamps
Two timestamp properties are automatically managed for you:

- **`createdAt`** - Set when the document is first created
- **`updatedAt`** - Updated every time you save or update the document

Both timestamps use JavaScript's [Date.now()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now) function, storing the time in milliseconds since January 1st, 1970.

## Collection Naming

Esix automatically determines which MongoDB collection to use based on your model's class name. This follows our [Convention over Configuration](https://en.wikipedia.org/wiki/Convention_over_configuration) philosophy to keep things simple.

Here's how the naming works:

| Model Class Name | Collection Name |
|------------------|-----------------|
| `BlogPost`       | `blog-posts`    |
| `User`           | `users`         |
| `OrderItem`      | `order-items`   |
| `Comment`        | `comments`      |

The class name is transformed by:
1. Converting from PascalCase to kebab-case (dashes)
2. Making it plural

This means you don't need to configure collection names manually - just name your model classes descriptively and Esix handles the rest!
