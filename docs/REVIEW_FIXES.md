# Review fixes and compatibility notes

Implemented September 9, 2026 against the review baseline `fe52bf3`.

## Correctness

All ten original findings have regression coverage and fixes:

- B1: Repeated predicates are combined with AND, including within OR groups.
- B2: Sanitization preserves BSON values, Dates, regular expressions and binary
  values. Object processing is linear in field count.
- B3: Hydrated models retain their original BSON identity internally.
  Updating/deleting an ObjectId record does not affect a same-text string ID.
- B4: `find()` preserves query and relationship scopes.
- B5: Concurrent connection initialization shares one promise. Shutdown waits
  for initialization, and new connections wait for shutdown.
- B6/B7: `findBy('id')` and `orderBy('id')` map to `_id`.
- B8: Scalar reads send real MongoDB projections and avoid model construction.
- B9: Large extrema no longer spread arrays into function arguments. Production
  aggregates execute on the server.
- B10: Creation metadata and timestamps are assigned after a successful write,
  including explicit-ID upserts.

Additional regression tests cover BSON relationships, empty unsaved-parent
relationships, logger promise rejection and synchronous failures, finite numeric
operands, concurrent unique-index upserts, query reuse, text indexes, and
ObjectId batch deletion.

## Deliberate contracts

- `get()` still hydrates class defaults. `pluck()` returns stored values
  directly, including `undefined` for missing fields, instead of silently
  substituting constructor defaults. Aggregates reject missing, nonnumeric and
  non-finite input values; empty result sets return zero. This is an intentional
  behavior correction for data that was previously masked by defaults.
- `sum`, `average`, `min` and `max` honor the current filter, sort, skip and
  limit. The default adapter uses aggregation; `mongo-mock`, which does not
  implement aggregation, uses tested client-side reductions. Percentile remains
  an exact client-side calculation.
- `first()` and `paginate()` no longer mutate the source builder. Reads capture
  their sort/skip/limit before awaiting a connection. Pagination starts count
  and page retrieval together; they are not a transactional snapshot.
- `distinct()` treats arrays as whole values, excludes null/missing values, and
  makes no ordering guarantee. Production deduplication happens in MongoDB. The
  mock path uses BSON-aware serialization keys.
- Unbounded deletion sends the filter directly to `deleteMany()`. Limited/offset
  deletion selects raw IDs and sends at most 1,000 IDs per delete command.
  Selection and deletion are not atomic; bounded deletion retains
  selection-by-ID semantics if the original field values subsequently change.
  The bounded path still materializes its selection in memory.
- `increment()`/`decrement()` retain their documented all-matching semantics:
  limit/skip/sort do not restrict the update, and timestamps are not stamped.
  Numeric properties are checked by TypeScript, and amounts must be finite. Use
  a unique ID filter to update one record.
- `create()` returns a BSON snapshot of the inserted attributes after the insert
  succeeds, without a readback. It will not observe changes made by another
  process immediately after insertion. Caller-owned nested objects are not
  shared with the returned model.
- `find(string)` retains its historical flexible string/ObjectId lookup. If both
  representations exist, that lookup is ambiguous; use a discriminating scope or
  an explicit BSON `_id` predicate. Loaded model writes and BSON foreign-key
  relationships use exact identity. Children of BSON-ID parents must store BSON
  foreign keys; a same-text string is a different relationship key.
- Chunk/cursor iteration still ignores sort/limit/skip and requires homogeneous
  ID types, as documented previously. It is safe to update/delete the records
  delivered to callbacks.
- Callers should stop issuing application work before shutdown. Connection
  coordination avoids duplicate pools, but does not drain outstanding
  application operations.

## Verification and CI

Final local checks: **296 tests passed**, including **32 real MongoDB
contracts**; TypeScript, ESLint, CJS/ESM builds and import smoke tests passed.
The website broken-link check also passed. An independent reviewer identified
three further BSON edge cases, all fixed with regression tests.

Run the fast suite with `yarn workspace esix test`; use `test:watch` for watch
mode.

Run the real database contracts against a disposable MongoDB server:

```sh
ESIX_TEST_MONGODB_URI=mongodb://127.0.0.1:27017 yarn workspace esix test
```

The suite creates a uniquely named database and removes it after the run. The
URI is opt-in; without it the real-server suite is skipped.
`.github/workflows/mongodb.yml` runs all tests, type checking, lint and builds
with MongoDB 6.0 and 8.0 services. Those remote CI jobs must still run on
GitHub; local verification used MongoDB 6.0.1, driver 6.15.0 and Node 22.14.0.

## Measured performance

Source: `packages/esix/benchmarks/review-results.json`. One local MongoDB
server; 20,000 documents, each with a 1,024-byte unrelated payload; one warmup
and five measured runs per operation; medians below. Command monitoring was
enabled in both versions.

- Pluck: **151.47 → 36.17 ms**. Returned BSON document bytes: **21,840,000 →
  320,000**.
- Sum: **174.59 → 17.72 ms**. Returned documents: **20,000 → 1**; BSON bytes:
  **21,840,000 → 34**.
- Distinct (10 values): **45.34 → 7.52 ms**. Returned documents: **20,000 →
  10**; BSON bytes: **860,000 → 200**.
- Create: **1.48 → 1.05 ms**; database commands: **2 → 1**.

The JSON also records heap deltas, which are not peak memory measurements. BSON
byte totals count returned documents, not network framing, write payloads or
compressed traffic. Results depend on hardware, indexes, constructor costs and
data distribution.

Reproduce after building the package:

```sh
yarn workspace esix build
ESIX_TEST_MONGODB_URI=mongodb://127.0.0.1:27017 yarn workspace esix benchmark
```

Set `ESIX_BENCH_BASELINE` to an absolute path to an ESM bundle of the baseline
library to compare both versions. The recorded baseline was bundled from
`git archive fe52bf3 packages/esix/src` with esbuild, external packages enabled,
and placed under the workspace's `node_modules/.cache` for dependency
resolution.

A separate three-run sanitizer microbenchmark on plain objects measured medians
of **61.62 → 0.43 ms** for 1,000 fields and **2,525.18 → 1.78 ms** for 5,000
fields. These are synthetic wide-object results, not typical model timings.

## Workload-dependent recommendations

No new pagination or eager-loading API was introduced. Offset pagination and
per-model relationship queries can still be expensive; use existing keyset
iteration for batch jobs and bulk `whereIn` relationship queries for lists.
Adding a separate public pagination or eager-loading system should follow
evidence from actual application workloads.

Percentile remains exact rather than introducing a server-version dependency or
changing results to an approximate percentile. The existing generic aggregation
API remains available for applications that want server-native alternatives.
