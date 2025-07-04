---
title: Testing
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

## Writing Tests

### Basic Model Tests

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { v4 } from 'uuid'
import { User } from '../models/user'

describe('User Model', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${v4()}`
    })
  })

  it('should create a user', async () => {
    const user = await User.create({
      name: 'John Doe',
      email: 'john@example.com',
      status: 'active'
    })

    expect(user.name).toBe('John Doe')
    expect(user.email).toBe('john@example.com')
    expect(user.id).toBeDefined()
    expect(user.createdAt).toBeDefined()
  })

  it('should find a user by email', async () => {
    // Arrange
    await User.create({
      name: 'Jane Doe',
      email: 'jane@example.com',
      status: 'active'
    })

    // Act
    const user = await User.findBy('email', 'jane@example.com')

    // Assert
    expect(user).toBeDefined()
    expect(user.name).toBe('Jane Doe')
  })
})
```

### Query Builder Tests

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { Product } from '../models/product'

describe('Product Queries', () => {
  beforeEach(async () => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${v4()}`
    })

    // Create test data
    await Product.create([
      { name: 'Laptop', category: 'electronics', price: 999, inStock: true },
      { name: 'Mouse', category: 'electronics', price: 25, inStock: true },
      { name: 'Desk', category: 'furniture', price: 200, inStock: false }
    ])
  })

  it('should filter products by category', async () => {
    const electronics = await Product.where('category', 'electronics').get()

    expect(electronics).toHaveLength(2)
    expect(electronics.every((p) => p.category === 'electronics')).toBe(true)
  })

  it('should find products within price range', async () => {
    const affordableProducts = await Product.where('price', { $lte: 100 }).get()

    expect(affordableProducts).toHaveLength(1)
    expect(affordableProducts[0].name).toBe('Mouse')
  })

  it('should handle pagination', async () => {
    const page1 = await Product.limit(2).get()
    const page2 = await Product.skip(2).limit(2).get()

    expect(page1).toHaveLength(2)
    expect(page2).toHaveLength(1)
  })
})
```

### Aggregation Tests

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { Order } from '../models/order'

describe('Order Aggregations', () => {
  beforeEach(async () => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${v4()}`
    })

    await Order.create([
      { customerId: 1, amount: 100, status: 'completed' },
      { customerId: 1, amount: 200, status: 'completed' },
      { customerId: 2, amount: 150, status: 'pending' }
    ])
  })

  it('should calculate total order amount', async () => {
    const total = await Order.where('status', 'completed').sum('amount')
    expect(total).toBe(300)
  })

  it('should count orders by status', async () => {
    const completedCount = await Order.where('status', 'completed').count()
    const pendingCount = await Order.where('status', 'pending').count()

    expect(completedCount).toBe(2)
    expect(pendingCount).toBe(1)
  })
})
```

## Test Data Management

### Using Factories

Create test data factories for consistent, reusable test data:

```ts
// test/factories/user-factory.ts
export class UserFactory {
  static create(overrides: Partial<User> = {}): Promise<User> {
    return User.create({
      name: 'John Doe',
      email: `user${Date.now()}@example.com`,
      status: 'active',
      role: 'user',
      ...overrides
    })
  }

  static createMany(
    count: number,
    overrides: Partial<User> = {}
  ): Promise<User[]> {
    const users = Array.from({ length: count }, (_, i) => ({
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      status: 'active',
      role: 'user',
      ...overrides
    }))

    return User.create(users)
  }
}

// Usage in tests
const user = await UserFactory.create({ role: 'admin' })
const users = await UserFactory.createMany(5, { status: 'inactive' })
```

### Test Database Cleanup

Ensure each test starts with a clean slate:

```ts
// test/setup.ts
import { beforeEach, afterAll } from 'vitest'
import { ConnectionHandler } from '../src/connection-handler'

beforeEach(async () => {
  // Clear all collections before each test
  const db = await ConnectionHandler.getDatabase()
  const collections = await db.collections()

  for (const collection of collections) {
    await collection.deleteMany({})
  }
})

afterAll(async () => {
  await ConnectionHandler.close()
})
```

## Mocking External Dependencies

When testing models that interact with external services:

```ts
import { vi, describe, it, expect } from 'vitest'
import { EmailService } from '../services/email-service'
import { User } from '../models/user'

// Mock external service
vi.mock('../services/email-service')

describe('User with Email', () => {
  it('should send welcome email after creation', async () => {
    const mockSendEmail = vi.fn()
    EmailService.sendWelcomeEmail = mockSendEmail

    const user = await User.create({
      name: 'John Doe',
      email: 'john@example.com'
    })

    // Assuming your model has a post-create hook
    expect(mockSendEmail).toHaveBeenCalledWith(user.email, user.name)
  })
})
```

## Performance Testing

Test query performance with larger datasets:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { Product } from '../models/product'

describe('Performance Tests', () => {
  beforeEach(async () => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${v4()}`
    })

    // Create larger test dataset
    const products = Array.from({ length: 1000 }, (_, i) => ({
      name: `Product ${i}`,
      category: i % 5 === 0 ? 'electronics' : 'other',
      price: Math.floor(Math.random() * 1000),
      inStock: Math.random() > 0.5
    }))

    await Product.create(products)
  })

  it('should handle large dataset queries efficiently', async () => {
    const start = Date.now()

    const products = await Product.where('category', 'electronics')
      .where('inStock', true)
      .limit(10)
      .get()

    const duration = Date.now() - start

    expect(products).toHaveLength(10)
    expect(duration).toBeLessThan(100) // Should complete in under 100ms
  })
})
```

## Integration Testing

Test your models with real-world scenarios:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { User } from '../models/user'
import { BlogPost } from '../models/blog-post'

describe('User-Post Integration', () => {
  let user: User

  beforeEach(async () => {
    Object.assign(process.env, {
      DB_ADAPTER: 'mock',
      DB_DATABASE: `test-${v4()}`
    })

    user = await User.create({
      name: 'John Doe',
      email: 'john@example.com'
    })
  })

  it('should create posts for user', async () => {
    const posts = await BlogPost.create([
      { title: 'First Post', content: 'Hello World', authorId: user.id },
      { title: 'Second Post', content: 'Another post', authorId: user.id }
    ])

    expect(posts).toHaveLength(2)

    const userPosts = await BlogPost.where('authorId', user.id).get()
    expect(userPosts).toHaveLength(2)
  })
})
```

## Best Practices

### 1. Use Descriptive Test Names

```ts
// Good
it('should return empty array when no users match the criteria', async () => {
  // test code
})

// Bad
it('should work', async () => {
  // test code
})
```

### 2. Follow AAA Pattern

```ts
it('should update user status', async () => {
  // Arrange
  const user = await User.create({ name: 'John', status: 'active' })

  // Act
  user.status = 'inactive'
  await user.save()

  // Assert
  const updatedUser = await User.find(user.id)
  expect(updatedUser.status).toBe('inactive')
})
```

### 3. Test Edge Cases

```ts
it('should handle null values gracefully', async () => {
  const user = await User.create({ name: 'John', email: null })
  expect(user.email).toBeNull()
})

it('should throw error for invalid data', async () => {
  await expect(User.create({ name: '', email: 'invalid' })).rejects.toThrow(
    'Invalid user data'
  )
})
```

### 4. Use Transactions for Complex Tests

```ts
it('should handle complex multi-model operations', async () => {
  // This would be implemented when transaction support is added
  await User.transaction(async (session) => {
    const user = await User.create({ name: 'John' }, { session })
    await BlogPost.create({ title: 'Post', authorId: user.id }, { session })
  })
})
```

## Testing Configuration

### Vitest Configuration

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts']
    }
  }
})
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest --run",
    "test:watch": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

This guide covers the testing capabilities available with Esix. The mock adapter
provides a reliable way to test your models and queries without requiring a real
MongoDB connection, making your tests fast and isolated.
