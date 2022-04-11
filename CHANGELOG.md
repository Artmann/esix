# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.2.1] - 2022-04-11

- fix: Don't return all models when passing an empty array to QueryBuilder.whereIn.

## [3.2.0] - 2022-04-06

- feat: Add the aggregate function which can be used to run more complex aggregations.
- perf: Limit the query to one document when using .first.
- perf: Count documents in Mongo to avoid retrieving all documents.

## [3.1.0] - 2022-04-05

### Changed

- feat: Sanitize queries to prevent NoSQL injections. If a query property is an object, we remove properties where the key starts with the `$` character to avoid injections.

### Added

- feat: Add helpful aggregate functions to the Query Builder.

## [3.0.2] - 2021-02-04

### Changed

- perf: Reuse the connection to take advantage of Mongo's connection pooling.

## [3.0.1] - 2020-12-28

### Changed

- fix: BaseModel->find now supports IDs that are not ObjectIDs.

## [3.0.0] - 2020-11-25

### Changed

#### BREAKING: Look for documents using an ObjectId.

IDs in MongoDB can be stored as either strings or Object IDs. This meant that if you created a document
and let Mongo assign an id to it, Esix wouldn't be able to find it as it was only looking for the
hex representation.

With this change, `BaseModel.find(id)` will look for documents with either a matching Object id or
a string representation of it.

## [2.2.0] - 2020-09-10

### Added

- You can now [delete models](https://esix.netlify.app/deleting-models.html
) using either a Model Instance or a Query Builder.
