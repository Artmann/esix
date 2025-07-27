---
title: Getting Started
description: Install and set up Esix in your TypeScript project. Learn how to create your first model and start working with MongoDB using a slick ORM interface.
---

# Getting Started with Esix

Esix is a slick ORM for MongoDB that makes working with your database in TypeScript a breeze! 🥧

Inspired by ActiveRecord and Eloquent, Esix uses a [Convention over Configuration](https://en.wikipedia.org/wiki/Convention_over_configuration) approach. This means you can define your models as normal TypeScript classes with minimal boilerplate.

## Installation

Getting Esix up and running is simple! Just add the package using your favorite package manager:

**Using Yarn:**

```sh
yarn add esix mongodb
```

**Using NPM:**

```sh
npm install esix mongodb
```

> **Note:** You'll need both `esix` and `mongodb` packages to get started.

## Creating Your First Model

Let's start by defining your first model. Here's how you can create a simple `Book` model:

```ts
import { BaseModel } from 'esix'

export default class Book extends BaseModel {
  public isbn = ''
  public title = ''
}
```

That's it! The `BaseModel` automatically provides `id` and timestamp fields (`createdAt` and `updatedAt`), so you don't have to worry about those.

## Creating Records

Now you're ready to create some data! Here's how you can add books to your database:

```ts
import Book from './book'

async function createBooks(): Promise<void> {
  await Book.create({
    isbn: '978-0525536291',
    title: 'The Vanishing Half'
  })
  
  await Book.create({
    isbn: '978-0525521143',
    title: 'The Glass Hotel'
  })
}
```

## Querying Your Data

Once you have some data, querying is just as simple! Here's how you can retrieve books:

```ts
import { Request, Response } from 'express'
import Book from './book'

async function showBook(request: Request, response: Response): Promise<void> {
  const book = await Book.find(request.params.id)

  response.json({
    book
  })
}
```

## What's Next?

Congratulations! You've just created your first Esix model and learned the basics of creating and querying data. Here are some next steps to explore:

- **[Configuration](/docs/configuration)** - Learn how to configure your database connection
- **[Defining Models](/docs/defining-models)** - Discover advanced model features and relationships
- **[Retrieving Models](/docs/retrieving-models)** - Master complex queries and aggregations
