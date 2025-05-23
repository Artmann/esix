---
description: How to configure Esix ORM.
title: Configuration
---

# Configuration

To make it easy to add Esix to your project and to be able to change your
application's configuration between your local, test, and production
environment, Esix is configured with environment variables.

## Connecting to the Database

These options define how Esix will connect to your database.

`DB_ADAPTER`

The adapter is used to handle the MongoDB connection. Can be either `default` or
`mock` where `default` uses the
[offical MongoDB package](https://www.npmjs.com/package/mongodb) and `mock` uses
[mongo-mock](https://github.com/williamkapke/mongo-mock) which is great for
testing.

`DB_URL`

The URL of the database. Defaults to `mongodb://127.0.0.1:27017/`.

`DB_MAX_POOL_SIZE`

The maximum size of the connection pool. Defaults to `10`.

`DB_DATABASE`

The name of the database to connect to. Defaults to ``.

If you want to create a configuration file for your local environment you can
use the [dotenv package](https://www.npmjs.com/package/dotenv) but you should
make sure you don't commit any secrets to GitHub.
