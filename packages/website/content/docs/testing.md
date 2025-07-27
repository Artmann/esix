---
title: Testing
description:
  Learn best practices for testing your Esix applications, including unit tests,
  integration tests, and database mocking strategies.
---

# Testing

Testing is crucial for maintaining reliable applications. Esix provides
excellent testing capabilities through its mock adapter, allowing you to test
your models and queries without requiring a real MongoDB connection.

## Mock Adapter Setup

Esix includes a mock adapter that simulates MongoDB operations in memory. This
is perfect for unit tests and integration tests.

### Configuration

Set up the mock adapter in your test environment:

```ts
// In your test setup file or individual test files
import { beforeEach, afterEach } from 'vitest'
import { v4 } from 'uuid'

beforeEach(() => {
  Object.assign(process.env, {
    DB_ADAPTER: 'mock',
    DB_DATABASE: `test-${v4()}`
  })
})

afterEach(async () => {
  // Clean up connections
  await ConnectionHandler.close()
})
```

### Environment Variables

For testing, set these environment variables:

```bash
# .env.test (optional - can be set programmatically as shown above)
DB_ADAPTER=mock
DB_DATABASE=test_database
```

## Testing Philosophy: In-Memory Database vs Mocking

We strongly recommend using an in-memory test database (like Esix's mock adapter) instead of mocking the database connection or repository layer. This approach provides several key advantages:

### Why In-Memory Databases Are Better

**More Realistic Testing**: In-memory databases test your actual application flows, including query logic, data transformations, and business rules, rather than just testing that mocked methods are called correctly.

**Full Integration Coverage**: You can test complete user workflows from request to response, ensuring that all layers of your application work together properly.

**Easier Maintenance**: No need to maintain complex mock setups that mirror your database schema and behavior. The in-memory database handles this automatically.

**Confidence in Refactoring**: When you refactor your data access patterns, your tests continue to work without requiring updates to mock expectations.

### Example: Testing User Registration

```ts
// ✅ Good: Using in-memory database
describe('User Registration', () => {
  beforeEach(async () => {
    // Setup in-memory database
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${v4()}`
    })
  })

  it('should create a new user with hashed password', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User'
    }

    const user = await UserService.register(userData)

    // Test the actual database state
    expect(user.email).toBe('test@example.com')
    expect(user.password).not.toBe('password123') // Should be hashed
    
    // Verify user was actually saved
    const savedUser = await User.findBy('email', 'test@example.com')
    expect(savedUser).toBeTruthy()
  })
})

// ❌ Avoid: Mocking the repository layer
describe('User Registration (with mocks)', () => {
  it('should create a new user', async () => {
    const mockUser = { id: '1', email: 'test@example.com' }
    jest.spyOn(User, 'create').mockResolvedValue(mockUser)
    
    const user = await UserService.register(userData)
    
    // This only tests that the mock was called correctly,
    // not that your actual business logic works
    expect(User.create).toHaveBeenCalledWith(userData)
  })
})
```
