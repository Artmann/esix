<p align="center">
  <img alt="Esix" src="./logo.png" width="240px"/>
</p>

<h1 align="center">Esix: Type-safe MongoDB ORM with zero configuration</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/esix"><img src="https://img.shields.io/npm/v/esix.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/esix"><img src="https://img.shields.io/npm/dm/esix.svg" alt="npm downloads"></a>
  <a href="https://github.com/Artmann/esix/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Artmann/esix.svg" alt="License"></a>
  <a href="https://github.com/Artmann/esix/actions"><img src="https://img.shields.io/github/actions/workflow/status/Artmann/esix/build.yml" alt="Build Status"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Ready-blue.svg" alt="TypeScript"></a>
</p>

---

Working with MongoDB in TypeScript usually means choosing between simplicity and type safety. Native drivers require verbose, untyped queries, while most ORMs demand extensive configuration and boilerplate.

Esix brings the elegance of ActiveRecord and Eloquent to MongoDB with full TypeScript support. Define your models as simple TypeScript classes, and Esix automatically handles database operations and type inference through sensible conventions.

**No configuration files, no setup overhead**—just MongoDB development that feels as natural as working with any TypeScript object while maintaining the flexibility that makes MongoDB powerful.

## Features

- **Zero Configuration** - No decorators, no config files, just TypeScript classes
- **Full Type Safety** - Leverages TypeScript's type system for compile-time safety
- **Eloquent-Style API** - Familiar, intuitive syntax inspired by Laravel and ActiveRecord
- **Automatic Connection** - Connects to MongoDB automatically when needed
- **Rich Query Builder** - Fluent API with comparison operators, sorting, pagination, and more
- **Aggregation Support** - Built-in methods for common aggregations (count, sum, average, etc.)
- **Relationships** - Simple, type-safe relationship definitions
- **NoSQL Injection Protection** - Automatic input sanitization

## Installation

```bash
npm install esix mongodb
# or
yarn add esix mongodb
```

## Quick Start

Set your MongoDB connection string (Esix automatically connects when needed):

```bash
export DB_URL=mongodb://localhost:27017/myapp
```

### Define Models

Create TypeScript classes that extend `BaseModel`:

```ts
import { BaseModel } from 'esix'

class User extends BaseModel {
  public name = ''
  public email = ''
  public age = 0
  public isActive = true
}

class Post extends BaseModel {
  public title = ''
  public content = ''
  public authorId = ''
  public tags: string[] = []
  public publishedAt: Date | null = null
}
```

### Basic Operations

```ts
// Create
const user = await User.create({
  name: 'John Smith',
  email: 'john@example.com',
  age: 30
})

// Find by ID
const foundUser = await User.find(user.id)

// Find all
const allUsers = await User.all()

// Update
user.age = 31
await user.save()

// Delete
await user.delete()
```

### Querying

Esix provides a powerful, fluent query builder with full type safety:

```ts
// Find by field
const activeUsers = await User.where('isActive', true).get()

// Comparison operators
const adults = await User.where('age', '>', 18).get()
const seniors = await User.where('age', '>=', 65).get()
const youngUsers = await User.where('age', '<', 30).get()
const affordableItems = await Product.where('price', '<=', 50).get()
const nonBannedUsers = await User.where('status', '!=', 'banned').get()

// Multiple conditions
const youngActiveUsers = await User
  .where('isActive', true)
  .where('age', '<', 25)
  .get()

// Range queries
const workingAge = await User
  .where('age', '>=', 18)
  .where('age', '<=', 65)
  .get()

// Find one
const admin = await User.where('email', 'admin@example.com').first()

// Specific field search
const john = await User.findBy('email', 'john@example.com')

// Array queries
const bloggers = await User.whereIn('id', ['user1', 'user2', 'user3']).get()
const nonAdmins = await User.whereNotIn('role', ['admin', 'moderator']).get()
```

### Advanced Queries

```ts
// Pagination
const page1 = await Post.limit(10).get()
const page2 = await Post.skip(10).limit(10).get()

// Sorting
const latestPosts = await Post.orderBy('createdAt', 'desc').get()
const popularPosts = await Post.orderBy('views', 'desc').limit(5).get()

// Extract specific field values
const titles = await Post.pluck('title')
const authors = await Post.pluck('authorId')
```

### Aggregations

```ts
// Count documents
const userCount = await User.count()
const activeCount = await User.where('isActive', true).count()

// Sum values
const totalSales = await Order.sum('amount')

// Calculate averages
const avgAge = await User.average('age')

// Find min/max
const lowestPrice = await Product.min('price')
const highestScore = await Test.max('score')

// Percentiles
const p95ResponseTime = await ResponseTime.percentile('value', 95)

// Custom aggregations
const results = await User.aggregate([
  { $group: { _id: '$department', count: { $sum: 1 } } }
])
```

### First or Create

Find existing records or create new ones atomically:

```ts
// Find user by email, create if doesn't exist
const user = await User.firstOrCreate(
  { email: 'new@example.com' },
  { name: 'New User', age: 25 }
)

// Using only filter (attributes default to filter)
const settings = await Settings.firstOrCreate({
  userId: 'user123',
  theme: 'dark'
})
```

### Relationships

Define relationships between models with type safety:

```ts
class Author extends BaseModel {
  public name = ''

  // Get all posts by this author
  posts() {
    return this.hasMany(Post, 'authorId')
  }
}

// Usage
const author = await Author.find('author123')
const authorPosts = await author.posts().get()
const publishedPosts = await author
  .posts()
  .where('publishedAt', '!=', null)
  .get()
```

### Real-world Example

```ts
// Blog API endpoints
export async function getPosts(req: Request, res: Response) {
  const posts = await Post
    .where('publishedAt', '!=', null)
    .orderBy('publishedAt', 'desc')
    .limit(20)
    .get()

  res.json({ posts })
}

export async function createPost(req: Request, res: Response) {
  const post = await Post.create({
    title: req.body.title,
    content: req.body.content,
    authorId: req.user.id,
    tags: req.body.tags || []
  })

  res.json({ post })
}

export async function getOrCreateUser(req: Request, res: Response) {
  const user = await User.firstOrCreate(
    { email: req.body.email },
    { name: req.body.name, isActive: true }
  )

  res.json({ user, created: user.createdAt === user.updatedAt })
}
```

## Configuration

Esix works with zero configuration but supports these environment variables:

- `DB_URL` - MongoDB connection string (required)
- `DB_DATABASE` - Database name (optional, extracted from URL if not provided)
- `DB_ADAPTER` - Set to `'mock'` for testing (optional)

## Documentation

For comprehensive documentation, visit [https://esix.netlify.app/](https://esix.netlify.app/).

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT © [Christoffer Artmann](https://github.com/Artmann)
