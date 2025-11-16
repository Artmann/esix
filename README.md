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

## Development

This project uses [Turborepo](https://turbo.build/) to manage the monorepo structure. The main package is located in `packages/esix/`.

### Prerequisites

- Node.js 20+
- Yarn

### Getting Started

```bash
# Install dependencies
yarn install

# Start all development servers
yarn dev

# Build all packages
yarn build

# Run tests
yarn test

# Run linting
yarn lint

# Format code
yarn format

# Type check
yarn typecheck
```

### Package Structure

- `packages/esix/` - The main Esix ORM package
- `packages/website/` - Next.js documentation website
- `docs/` - Legacy documentation build system (to be replaced by website)

### Working on Specific Packages

#### Esix Package

To work specifically on the Esix package:

```bash
# Navigate to the package
cd packages/esix

# Build the package
yarn build

# Run tests
yarn test

# Run linting
yarn lint
```

#### Website Package

To work on the Next.js documentation website:

```bash
# Start the development server
yarn workspace website dev

# Or navigate to the package
cd packages/website

# Start development server
yarn dev

# Build for production
yarn build

# Start production server
yarn start
```

### Development Workflow

```bash
# Start all development servers (recommended for full-stack development)
yarn dev

# Work on specific packages
yarn workspace esix build
yarn workspace website dev

# Run commands across all packages
yarn build    # Build everything
yarn test     # Test everything
yarn lint     # Lint everything
```

Working with MongoDB in TypeScript usually means choosing between simplicity and
type safety. Native drivers require verbose, untyped queries, while most ORMs
demand extensive configuration and boilerplate.

Esix brings the elegance of ActiveRecord and Eloquent to MongoDB with full
TypeScript support. Define your models as simple TypeScript classes, and Esix
automatically handles database operations and type inference through sensible
conventions.

No configuration files, no setup overhead—just MongoDB development that feels as
natural as working with any TypeScript object while maintaining the flexibility
that makes MongoDB powerful.

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
const youngActiveUsers = await User.where('isActive', true)
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

### First or Create

Find existing records or create new ones:

```ts
// Find user by email, create if doesn't exist
const user = await User.firstOrCreate(
  {
    email: 'new@example.com'
  },
  {
    name: 'New User',
    age: 25
  }
)

// Using only filter (attributes default to filter)
const settings = await Settings.firstOrCreate({
  userId: 'user123',
  theme: 'dark'
})
```

### Relationships

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
  const posts = await Post.where('publishedAt', '!=', null)
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
    {
      name: req.body.name,
      isActive: true
    }
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

For comprehensive documentation, visit
[https://esix.netlify.app/](https://esix.netlify.app/).
