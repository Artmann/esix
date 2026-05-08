---
title: Configuration
description: Learn how to configure Esix for your MongoDB database, including connection settings, environment variables, and advanced configuration options.
---

# Configuration

Esix makes it easy to configure your database connection for different environments (local, test, and production) using environment variables. This approach helps keep your configuration flexible and secure.

## Database Connection Options

Here are the environment variables you can use to configure your database connection:

### `DB_ADAPTER`

The adapter handles the MongoDB connection. You can choose between:
- `default` - Uses the [official MongoDB package](https://www.npmjs.com/package/mongodb) for production
- `mock` - Uses [mongo-mock](https://github.com/williamkapke/mongo-mock) which is perfect for testing

**Default:** `default`

### `DB_URL`

The connection URL for your MongoDB database.

**Default:** `mongodb://127.0.0.1:27017/`

**Example:**
```bash
DB_URL=mongodb://localhost:27017/
# or for MongoDB Atlas
DB_URL=mongodb+srv://username:password@cluster.mongodb.net/
```

### `DB_MAX_POOL_SIZE`

The maximum number of connections in the connection pool. This helps manage database performance under load.

**Default:** `10`

### `DB_DATABASE`

The name of the database to connect to.

**Default:** (empty string)

**Example:**
```bash
DB_DATABASE=myapp_production
```

## Setting Up Environment Variables

For local development, we recommend using the [dotenv package](https://www.npmjs.com/package/dotenv) to manage your environment variables:

```bash
npm install dotenv
```

Create a `.env` file in your project root:

```bash
DB_URL=mongodb://localhost:27017/
DB_DATABASE=myapp_development
DB_MAX_POOL_SIZE=5
```

Then load it in your application:

```ts
import 'dotenv/config'
// Your Esix code here
```

> **⚠️ Security Note:** Never commit secrets or production credentials to version control. Add `.env` to your `.gitignore` file!
