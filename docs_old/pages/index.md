---
title: Getting Started
---

# Esix is a slick ORM for MongoDB.

Inspired by ActiveRecord and Eloquent, Esix is a great way to work with your database in TypeScript. 🥧

Esix uses a [Convention over Configuration](https://en.wikipedia.org/wiki/Convention_over_configuration) approach where you define your models as normal TypeScript classes and with minimal boilerplate.

## Install Esix

Add the package using your favorite package manager.

**Yarn**
```sh
yarn add esix mongodb
```

**NPM**
```sh
npm install esix mongodb
```

## Getting Started

First off, you'll need to define your model.

```ts
import { baseModel } from 'esix';

export default class Book extends BaseModel {
  public isbn = '';
  public title = '';
}
```

The base model comes with id and timestamp fields so you don't have to worry about those things.

Now you are ready to create some data!

```ts
import Book from './book';

async function createBooks(): Promise<void> {
  await Book.create({
    isbn: '978-0525536291',
    title: 'The Vanishing Half'
  });
  await Book.create({
    isbn: '978-0525521143',
    title: 'The Glass Hotel'
  });
}
```

Then you can easily query your models.

```ts
import { Request, Response } from 'express';
import Book from './book';

async function showBook(request: Request, response: Response): Promise<void> {
  const book = await Book.find(request.params.id);

  response.json({
    book
  });
}
```
