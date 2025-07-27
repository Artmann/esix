# esix Development Guide

## About

Esix is a TypeScript database library for MongoDB, heavily inspired by Laravel's
Eloquent. Models map to documents in the database, and the QueryBuilder is used
to select which documents to retrieve.

## Monorepo Structure

This project uses Turborepo to manage a monorepo with the following structure:
- `packages/esix/` - The main Esix ORM package
- `docs/` - Documentation site build system (to be migrated to Next.js)

## Build & Test Commands

From the root directory (using Turborepo):
- Build all packages: `yarn build`
- Lint all packages: `yarn lint`
- Format all packages: `yarn format`
- Test all packages: `yarn test`
- Type check all packages: `yarn typecheck`
- Documentation: `yarn docs:build` and `yarn docs:serve`

From the esix package directory (`packages/esix/`):
- Build: `yarn build`
- Lint: `yarn lint`
- Format: `yarn format`
- Test all: `yarn test`
- Test single file: `yarn test path/to/file.spec.ts`
- Test specific test: `yarn test -t "test name pattern"`
- Type check: `yarn typecheck`

## Code Style Guidelines

- **TypeScript**: Strict typing with null checks and proper return types
- **Formatting**: Single quotes, no semicolons, 2-space indent (enforced by
  Prettier)
- **Naming**: PascalCase for classes, camelCase for methods/properties,
  kebab-case for files
- **Imports**: Group external then internal imports
- **Error Handling**: Promise-based with proper type guards and null handling
- **Testing**: BDD style with describe/it blocks, clear test sections per method
- **Default Sorting**: Order things in alphabetical order by default

## File Organization

- `packages/esix/src/base-model.ts` - Base model class all models extend from
- `packages/esix/src/query-builder.ts` - Query building logic for MongoDB operations
- `packages/esix/src/types.ts` - TypeScript type definitions
- `packages/esix/src/connection-handler.ts` - MongoDB connection management
- `packages/esix/src/sanitize.ts` - Input sanitization to prevent NoSQL injection
- Model definitions extend BaseModel
- Test files use .spec.ts extension
- Each class should have a single responsibility

## Key Design Patterns and Concepts

- **Fluent Interface**: Methods return `this` or a QueryBuilder for chaining
- **Static vs. Instance Methods**: BaseModel provides both static methods (for
  querying collections) and instance methods (for manipulating instances)
- **MongoDB Operators**: Query methods translate to MongoDB operators
  ($in,
  $nin, etc.)
- **ID Handling**: MongoDB uses `_id` internally, but esix exposes it as `id` in
  models
- **Type Safety**: Advanced TypeScript features like conditional types, keyof
  operator, and generics provide type safety

## Query Methods

- **where**: Filter by field equality
- **whereIn**: Filter where a field's value is in an array
- **whereNotIn**: Filter where a field's value is not in an array
- **find**: Find a model by its ID
- **findBy**: Find a model where a field matches a value
- **orderBy**: Sort results by a field
- **limit**: Limit the number of results
- **skip**: Skip a number of results (for pagination)
- **pluck**: Extract an array of values for a specific field

## Aggregation Methods

- **aggregate**: Direct access to MongoDB aggregation pipeline
- **average**: Calculate average of values for a field
- **count**: Count total number of documents
- **max**: Find maximum value for a field
- **min**: Find minimum value for a field
- **percentile**: Calculate nth percentile for a field
- **sum**: Calculate sum of values for a field

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
const avgAgeForAdults = await User.where('age', { $gte: 18 }).average('age')
```

## Documentation

Document all public methods with JSDoc comments including parameters and return
types.

## Recent Implementations

- **Aggregation Functions**: Added static aggregation methods to BaseModel for
  direct use on model classes (count, sum, average, max, min, percentile,
  aggregate)
- **whereNotIn**: Added to filter out records where a field's value is within a
  given array
- **Improved Types**: Enhanced type safety for methods like `findBy` using
  conditional types

## TypeScript Techniques Used

- Generic type parameters for model types: `<T extends BaseModel>`
- Conditional types: `K extends keyof T ? T[K] : any`
- The `keyof` operator to get property names: `K extends keyof T | '_id'`
- Constructor typing with `ObjectType<T>`
- Method chaining with `this` return types