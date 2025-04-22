# esix Development Guide

## About
Esix is a TypeScript database library for MongoDB, heavily inspired by Laravel's Eloquent. Models map to documents in the database, and the QueryBuilder is used to select which documents to retrieve.

## Build & Test Commands
- Build: `yarn build`
- Lint: `yarn lint`
- Format: `yarn format`
- Test all: `yarn test`
- Test single file: `yarn test path/to/file.spec.ts`
- Test specific test: `yarn test -t "test name pattern"`
- Documentation: `yarn docs:build` and `yarn docs:serve`

## Code Style Guidelines
- **TypeScript**: Strict typing with null checks and proper return types
- **Formatting**: Single quotes, no semicolons, 2-space indent (enforced by Prettier)
- **Naming**: PascalCase for classes, camelCase for methods/properties, kebab-case for files
- **Imports**: Group external then internal imports
- **Error Handling**: Promise-based with proper type guards and null handling
- **Testing**: BDD style with describe/it blocks, clear test sections per method

## File Organization
- Model definitions extend BaseModel
- Test files use .spec.ts extension
- Each class should have a single responsibility
- JSDoc comments for public APIs

## Documentation
Document all public methods with JSDoc comments including parameters and return types.