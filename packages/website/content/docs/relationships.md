---
title: Relationships
description: Define and traverse relationships between Esix models with hasMany, hasOne, and belongsTo helpers.
---

# Relationships

Models in your application are rarely isolated. Esix ships with three
ActiveRecord-style helpers that make it easy to traverse relationships between
collections: `hasMany`, `hasOne`, and `belongsTo`.

Each helper follows the same convention: by default, the foreign key is the
camelCased class name with `Id` appended (e.g. `Author` → `authorId`), and the
local/owner key is `id`. Both keys can be overridden when your schema differs.

## hasMany

Use `hasMany` when a parent record can own many related records. It returns a
`QueryBuilder`, so you can chain additional constraints before fetching:

```ts
class Author extends BaseModel {
  public name = ''

  posts() {
    return this.hasMany(Post)
  }
}

class Post extends BaseModel {
  public title = ''
  public authorId = ''
  public publishedAt: number | null = null
}

const author = await Author.find('5f5a474b32fa462a5724ff7d')

// All posts by this author.
const allPosts = await author.posts().get()

// Only the published ones, latest first.
const recentPosts = await author
  .posts()
  .where('publishedAt', { $ne: null })
  .orderBy('publishedAt', 'desc')
  .limit(5)
  .get()
```

You can pass a custom foreign key, local key, or both:

```ts
this.hasMany(Post, 'writtenBy') // foreignKey only
this.hasMany(Post, 'writtenBy', 'externalId') // foreignKey + localKey
```

## hasOne

`hasOne` mirrors `hasMany` but returns a single record (or `null`). It's the
right choice for true one-to-one relationships such as a user and their
profile:

```ts
class User extends BaseModel {
  public name = ''

  profile() {
    return this.hasOne(Profile)
  }
}

class Profile extends BaseModel {
  public bio = ''
  public userId = ''
}

const user = await User.find('user-123')
const profile = await user.profile() // Profile | null
```

Like `hasMany`, you can override the foreign and local keys:

```ts
this.hasOne(Profile, 'ownerId', 'externalId')
```

## belongsTo

`belongsTo` is the inverse of `hasOne` / `hasMany`: it looks up the parent
record from a foreign key stored on the current model.

```ts
class Post extends BaseModel {
  public title = ''
  public authorId = ''

  author() {
    return this.belongsTo(Author)
  }
}

const post = await Post.find('post-1')
const author = await post.author() // Author | null
```

By default `belongsTo` uses the parent's `id` as the owner key and looks up the
foreign key derived from the parent class name. Override either if your schema
uses different fields:

```ts
// Look up Author by `slug` instead of `id`.
this.belongsTo(Author, 'authorSlug', 'slug')
```

If the foreign key is `null` or `undefined` on the current model, `belongsTo`
returns `null` without hitting the database.
