# Contributing to Esix

Thank you for your interest in contributing to Esix! This guide will help you get started with development.

## About

Esix is a TypeScript database library for MongoDB, heavily inspired by Laravel's Eloquent and ActiveRecord. Models map to documents in the database, and the QueryBuilder is used to select which documents to retrieve.

## Prerequisites

- Node.js 20+
- Yarn
- MongoDB (for local testing)

## Getting Started

```bash
# Clone the repository
git clone https://github.com/Artmann/esix.git
cd esix

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

## Monorepo Structure

This project uses [Turborepo](https://turbo.build/) to manage a monorepo with the following structure:

- `packages/esix/` - The main Esix ORM package
- `packages/website/` - Next.js documentation website
- `docs/` - Legacy documentation build system (to be replaced by website)

## Build & Test Commands

### From the root directory (using Turborepo):

- Build all packages: `yarn build`
- Lint all packages: `yarn lint`
- Format all packages: `yarn format`
- Test all packages: `yarn test`
- Type check all packages: `yarn typecheck`
- Documentation: `yarn docs:build` and `yarn docs:serve`

### From the esix package directory (`packages/esix/`):

- Build: `yarn build`
- Lint: `yarn lint`
- Format: `yarn format`
- Test all: `yarn test`
- Test single file: `yarn test path/to/file.spec.ts`
- Test specific test: `yarn test -t "test name pattern"`
- Type check: `yarn typecheck`

## Working on Specific Packages

### Esix Package

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

### Website Package

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

## Code Style Guidelines

- **TypeScript**: Strict typing with null checks and proper return types
- **Formatting**: Single quotes, no semicolons, 2-space indent (enforced by Prettier)
- **Naming**:
  - PascalCase for classes
  - camelCase for methods/properties
  - kebab-case for files
- **Imports**: Group external then internal imports
- **Error Handling**: Promise-based with proper type guards and null handling
- **Testing**: BDD style with describe/it blocks, clear test sections per method
- **Default Sorting**: Order things alphabetically by default
- **Documentation**: Document all public methods with JSDoc comments including parameters and return types

## File Organization

- `packages/esix/src/base-model.ts` - Base model class all models extend from
- `packages/esix/src/query-builder.ts` - Query building logic for MongoDB operations
- `packages/esix/src/types.ts` - TypeScript type definitions
- `packages/esix/src/connection-handler.ts` - MongoDB connection management
- `packages/esix/src/sanitize.ts` - Input sanitization to prevent NoSQL injection
- Model definitions extend BaseModel
- Test files use `.spec.ts` extension
- Each class should have a single responsibility

## Key Design Patterns and Concepts

### Fluent Interface

Methods return `this` or a QueryBuilder for chaining:

```typescript
const users = await User
  .where('age', '>', 18)
  .where('isActive', true)
  .orderBy('name')
  .limit(10)
  .get()
```

### Static vs. Instance Methods

BaseModel provides both:
- **Static methods**: For querying collections (e.g., `User.find()`, `User.where()`)
- **Instance methods**: For manipulating instances (e.g., `user.save()`, `user.delete()`)

### MongoDB Operators

Query methods translate to MongoDB operators:
- `where('age', '>', 18)` → `{ age: { $gt: 18 } }`
- `whereIn('id', [1, 2, 3])` → `{ id: { $in: [1, 2, 3] } }`
- `whereNotIn('role', ['admin'])` → `{ role: { $nin: ['admin'] } }`

### ID Handling

MongoDB uses `_id` internally, but Esix exposes it as `id` in models for a more intuitive API.

### Type Safety

Advanced TypeScript features provide type safety:
- Conditional types
- `keyof` operator
- Generics with constraints
- Constructor typing

## Query Methods

### where

Filter by field equality or comparison:

- Two-parameter syntax: `where('status', 'active')` for equality
- Three-parameter syntax: `where('age', '>', 18)` with comparison operators
- Supported operators: `=`, `!=`, `<>`, `>`, `>=`, `<`, `<=`
- Maps to MongoDB operators: `$gt`, `$gte`, `$lt`, `$lte`, `$ne`

### whereIn / whereNotIn

Filter where a field's value is (or is not) in an array:

```typescript
const users = await User.whereIn('id', ['id1', 'id2']).get()
const nonAdmins = await User.whereNotIn('role', ['admin', 'moderator']).get()
```

### find / findBy

- `find`: Find a model by its ID
- `findBy`: Find a model where a field matches a value

### Sorting and Pagination

- `orderBy`: Sort results by a field
- `limit`: Limit the number of results
- `skip`: Skip a number of results (for pagination)

### pluck

Extract an array of values for a specific field:

```typescript
const titles = await Post.pluck('title')
```

## Aggregation Methods

Esix provides static aggregation methods on BaseModel:

- `aggregate`: Direct access to MongoDB aggregation pipeline
- `average`: Calculate average of values for a field
- `count`: Count total number of documents
- `max`: Find maximum value for a field
- `min`: Find minimum value for a field
- `percentile`: Calculate nth percentile for a field
- `sum`: Calculate sum of values for a field

### Aggregation Examples

```typescript
// Count all users
const userCount = await User.count()

// Sum all order amounts
const totalSales = await Order.sum('amount')

// Get average user age
const avgAge = await User.average('age')

// Find maximum score
const highScore = await Test.max('score')

// Get 95th percentile response time
const p95 = await ResponseTime.percentile('value', 95)

// Complex aggregations with MongoDB pipeline
const results = await User.aggregate([
  { $group: { _id: '$department', count: { $sum: 1 } } }
])

// Chaining with query methods
const avgAgeForAdults = await User.where('age', '>=', 18).average('age')
```

## TypeScript Techniques Used

Understanding these TypeScript patterns will help you contribute effectively:

- **Generic type parameters** for model types: `<T extends BaseModel>`
- **Conditional types**: `K extends keyof T ? T[K] : any`
- **The `keyof` operator** to get property names: `K extends keyof T | '_id'`
- **Constructor typing** with `ObjectType<T>`
- **Method chaining** with `this` return types

## Testing

Tests use Jest with BDD-style describe/it blocks:

```typescript
describe('User', () => {
  describe('.where()', () => {
    it('filters by field equality', async () => {
      // Arrange
      const user = await User.create({ name: 'John', age: 30 })

      // Act
      const results = await User.where('age', 30).get()

      // Assert
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('John')
    })
  })
})
```

### Running Tests

```bash
# Run all tests
yarn test

# Run specific test file
yarn test path/to/file.spec.ts

# Run tests matching a pattern
yarn test -t "where method"

# Watch mode
yarn test --watch
```

## Recent Implementations

- **Comparison Operators**: Added support for comparison operators in where clauses (`>`, `>=`, `<`, `<=`, `=`, `!=`, `<>`), following Laravel Eloquent and Rails Active Record patterns
- **Aggregation Functions**: Added static aggregation methods to BaseModel for direct use on model classes (count, sum, average, max, min, percentile, aggregate)
- **whereNotIn**: Added to filter out records where a field's value is within a given array
- **Improved Types**: Enhanced type safety for methods like `findBy` using conditional types

## Pull Request Process

1. Fork the repository and create your branch from `main`
2. Make your changes and add tests
3. Ensure all tests pass: `yarn test`
4. Ensure code is properly formatted: `yarn format`
5. Ensure there are no linting errors: `yarn lint`
6. Ensure TypeScript compiles: `yarn typecheck`
7. Update documentation if needed
8. Submit a pull request with a clear description of the changes

## Development Environment Notes

- The dev server runs on port 3000
- MongoDB connection string is set via `DB_URL` environment variable
- Use `DB_ADAPTER=mock` for testing without a real MongoDB instance

## Need Help?

- Check the [documentation](https://esix.netlify.app/)
- Open an issue on GitHub
- Review existing issues and pull requests

## License

By contributing to Esix, you agree that your contributions will be licensed under the MIT License.
