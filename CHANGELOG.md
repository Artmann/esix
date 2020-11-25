# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
