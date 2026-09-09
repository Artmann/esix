# Esix code review

Reviewed September 9, 2026, at commit `fe52bf3`. Scope: the library in
`packages/esix/src`, its tests, package configuration, and CI. No library or
existing test code was changed.

## Assessment

Found **10 reproducible issues: five P1 and five P2**, plus performance
opportunities and additional test gaps. Address data integrity and query
correctness before optimization.

- **P1:** repeated constraints overwrite one another; BSON values are corrupted
  on save; ObjectId records cannot be reliably updated/deleted; scoped `find()`
  ignores constraints; concurrent initialization leaks connection pools.
- **P2:** `findBy('id')` uses the wrong field; `orderBy('id')` uses the wrong
  field; projections are not sent; large `min()`/`max()` calls throw; failed
  saves report successful creation.

P1 means high priority because the issue can corrupt data, select unintended
records, or exhaust resources. P2 means normal priority with a concrete
correctness or efficiency impact. The severity of scoped `find()` depends on
whether an application uses query scopes to restrict access.

## Verification

- Existing tests: **251 passed across 13 files** using
  `../../node_modules/.bin/vitest run` from `packages/esix`.
- TypeScript: **passed** using `../../node_modules/.bin/tsc --noEmit` from that
  directory.
- Real database reproductions: an isolated MongoDB **6.0.1** server on localhost
  port 27986, MongoDB Node driver **6.15.0**, Node **22.14.0**. Only temporary
  review data was written to this server.
- Connection initialization, large numeric arrays, and failed-save metadata were
  reproduced with controlled substitutes, independently of MongoDB.
- Source was bundled temporarily using installed esbuild, without modifying the
  library. Yarn's launcher initially failed on its Corepack cache permissions;
  the installed test and compiler binaries were used directly.

This is not a load benchmark, a complete security audit, or validation against
every supported server/Node version. Performance benefits below are inferred
from implementation and query behavior unless an explicit measurement is given.

## Findings

### B1 — P1: repeated constraints silently discard earlier conditions

**Location:**
[query-builder.ts:1157](/Users/artmann/code/esix/packages/esix/src/query-builder.ts:1157).

`mergeCondition()` spreads field keys into the current query. A subsequent
condition on the same field replaces the entire previous condition. The same
problem exists inside OR groups.

**Reproduction:** with values `[5, 20, 70]`,
`Item.where('value', '>=', 18).where('value', '<=', 65).pluck('value')` returned
`[5, 20]`, instead of `[20]`. This also affects writes/deletes using the
resulting query. Repeated equality, exclusion, and membership conditions can
lose constraints too.

**Missing test:** real result assertions for lower and upper bounds, repeated
operators, contradictory equalities, intersecting `whereIn()` calls, and
same-field constraints within an OR branch.

An existing
[test at base-model.spec.ts:1037](/Users/artmann/code/esix/packages/esix/src/base-model.spec.ts:1037)
explicitly expects `{ pages: { $lt: 500 } }` after adding both bounds. It
currently locks in the bug.

**Fix direction:** preserve each predicate with AND semantics. Merely merging
operator objects will still lose repeated operators and equality constraints.

### B2 — P1: sanitization corrupts Date and BSON values during persistence

**Locations:**
[sanitize.ts:16](/Users/artmann/code/esix/packages/esix/src/sanitize.ts:16),
[query-builder.ts:740](/Users/artmann/code/esix/packages/esix/src/query-builder.ts:740),
[query-builder.ts:436](/Users/artmann/code/esix/packages/esix/src/query-builder.ts:436).

The sanitizer rebuilds every object from enumerable properties without
preserving its type. Dates become `{}`; ObjectIds become ordinary objects
containing a buffer-shaped object. It is applied to saves, `firstOrCreate()`
attributes, and query values. Conversely, `create()` does not apply this
sanitizer, making round trips inconsistent.

**Reproduction:** create a model with a Date and ObjectId field, then save it. A
raw MongoDB read showed `at: {}` and `ref: { buffer: { '0': ..., ... } }`. The
initial insert had preserved both types. Queries involving these values are
similarly transformed before reaching MongoDB.

**Missing test:** raw BSON type and value preservation across create → find →
save, update, `firstOrCreate()`, equality, and membership queries. Include
nested Dates, ObjectIds, binary values, Decimal128, and regular expressions
where supported.

**Fix direction:** distinguish plain documents/arrays from BSON and other
supported scalar objects. Define separate policies for query sanitization and
stored data, retaining injection tests.

### B3 — P1: loading an ObjectId record loses its identity for later writes

**Locations:**
[query-builder.ts:1029](/Users/artmann/code/esix/packages/esix/src/query-builder.ts:1029),
[query-builder.ts:740](/Users/artmann/code/esix/packages/esix/src/query-builder.ts:740),
[query-builder.ts:268](/Users/artmann/code/esix/packages/esix/src/query-builder.ts:268),
[base-model.ts:630](/Users/artmann/code/esix/packages/esix/src/base-model.ts:630).

Hydration exposes an ObjectId as a string but does not preserve the original
BSON identity. `save()` upserts by the string; instance deletion queries by the
string; bulk deletion turns selected IDs into strings through `pluck('id')`.

**Reproduction:** insert a raw ObjectId document and retrieve it with
`find(hex)`. Both instance deletion and a bulk deletion selected by its name
returned **0**. Saving the retrieved model created a second document with a
string `_id`; the original ObjectId document remained unchanged.

**Missing test:** full ObjectId lifecycle, bulk deletion of ObjectId records,
ObjectId foreign-key relationships, and a collection containing both a string ID
and an ObjectId with identical hex text. Current integration tests verify
ObjectId retrieval but not the subsequent lifecycle.

**Fix direction:** retain the raw identifier on hydrated models and on internal
selection paths. Avoid guessing the type from a 24-character string, because
Esix itself generates string IDs of that form.

### B4 — P1: `find()` ignores the builder's filters

**Location:**
[query-builder.ts:354](/Users/artmann/code/esix/packages/esix/src/query-builder.ts:354).

`find()` constructs a fresh ID-only query and never includes `buildQuery()`. A
filtered or relationship query can therefore retrieve an unrelated record.

**Reproduction:** `Item.where('value', 999).find('a')` returned item `a`, whose
value was 20. There was no matching record for the scope. An application using
`where('tenantId', currentTenant).find(id)` would lose its tenant condition.

**Missing test:** lookup through a rejecting scope, a relationship scope, and OR
groups; test both string and ObjectId identifiers.

**Fix direction:** combine the existing query and ID predicate with AND. If
bypassing scopes is deliberate, expose that explicitly and document it; the
fluent ActiveRecord-style API currently makes the bypass surprising.

### B5 — P1: simultaneous first queries create multiple connection pools

**Location:**
[connection-handler.ts:68](/Users/artmann/code/esix/packages/esix/src/connection-handler.ts:68).

`this.client` is assigned only after `createClient()` resolves. Every concurrent
caller observing an empty client starts another connection. Each completion
overwrites the reference, and shutdown can close only the last stored client.

**Reproduction:** ten simultaneous `getConnection()` calls with delayed client
creation opened **10 clients**; `closeConnections()` closed **1**. This uses a
deterministic fake client to demonstrate the initialization race, rather than a
network load test.

**Missing test:** concurrent initialization, shared connection failures followed
by retry, shutdown while initialization is pending, and concurrent
shutdown/reconnection.

**Fix direction:** cache the pending initialization promise and reset it on
failure. Coordinate shutdown with initialization.

### B6 — P2: `findBy('id', id)` searches an unstored `id` field

**Locations:**
[base-model.ts:236](/Users/artmann/code/esix/packages/esix/src/base-model.ts:236),
[query-builder.ts:383](/Users/artmann/code/esix/packages/esix/src/query-builder.ts:383).

`findBy()` passes the field through to `findOne()`, which sanitizes but does not
map `id` to `_id`.

**Reproduction:** `Item.findBy('id', 'a')` returned `null` for an existing
string-ID document. `Item.find('a')` retrieved it.

**Missing test:** ID lookup parity across `find()`, `findBy()`, and `where()`,
explicitly covering the BSON identity decisions in B3.

**Fix direction:** use consistent ID field normalization on every lookup path.

### B7 — P2: `orderBy('id')` sorts on an unstored field

**Location:**
[query-builder.ts:575](/Users/artmann/code/esix/packages/esix/src/query-builder.ts:575).

The sort key is passed through as `id` rather than `_id`. The query succeeds but
does not provide the requested order, affecting pagination too.

**Reproduction:** insert IDs `c`, `a`, `b`; `Item.orderBy('id').pluck('id')`
returned `['c', 'a', 'b']` on the isolated server, not ascending ID order.
Because the sort field is missing, that incidental order is not a guarantee.

**Missing test:** ascending/descending ID order on deliberately shuffled
inserts, compound sorting, and paginated ordering.

**Fix direction:** normalize the ID sort field as well as query fields.

### B8 — P2: `pluck()` does not send a projection to MongoDB

**Locations:**
[query-builder.ts:726](/Users/artmann/code/esix/packages/esix/src/query-builder.ts:726),
[query-builder.ts:1038](/Users/artmann/code/esix/packages/esix/src/query-builder.ts:1038).

`execute(fields)` calls `collection.find(query, fields)`, but driver 6 expects
an options object containing `projection`. The requested field map is treated as
options, so full documents are fetched. This affects `pluck()`, numeric
aggregates, and deletion's ID prefetch.

**Reproduction:** command monitoring during `Item.pluck('value')` confirmed that
the MongoDB `find` command had **no projection**. This matches the installed
driver source and MongoDB's
[projection documentation](https://www.mongodb.com/docs/drivers/node/v6.x/crud/query/project/).

**Missing test:** inspect a real driver command or retrieved raw fields; use
documents with a large unrelated payload. The existing pluck test checks
returned values only.

**Fix direction:** pass `{ projection: ... }`, remap `id` to `_id`, and
preferably extract raw projected values without constructing models. Decide
missing-field/default behavior before changing hydration semantics.

### B9 — P2: `min()` and `max()` throw on large result sets

**Locations:**
[query-builder.ts:545](/Users/artmann/code/esix/packages/esix/src/query-builder.ts:545),
[query-builder.ts:566](/Users/artmann/code/esix/packages/esix/src/query-builder.ts:566).

Both spread every value into one function call. This eventually exceeds the
JavaScript engine's argument limit.

**Reproduction:** substituting a valid `pluck()` result of **200,000 numbers**
made both methods throw `RangeError: Maximum call stack size exceeded` on Node
22.14.0. This isolates the reduction bug without inserting 200,000 documents.
The precise threshold is runtime-dependent.

**Missing test:** a large in-memory numeric result exercising the reducer, plus
bounded database integration tests. The existing “large collections” tests
contain only 500 records.

**Fix direction:** reduce iteratively for a minimal correction; server-side
aggregation can also remove the client-memory bottleneck.

### B10 — P2: a rejected save still sets `wasRecentlyCreated = true`

**Location:**
[base-model.ts:685](/Users/artmann/code/esix/packages/esix/src/base-model.ts:685).

The creation flag is set before the database operation succeeds. The documented
meaning is that the instance was inserted, so callers cannot rely on the flag
after a failed operation.

**Reproduction:** make connection acquisition throw, call `save()` on a new
instance, and catch the rejection. Its `wasRecentlyCreated` value is **true**,
despite no write occurring.

**Missing test:** rejected saves, successful retries, and first saves with
explicitly assigned IDs. The explicit-ID path also deserves a contract test
because it skips the new-instance branch.

**Fix direction:** update creation metadata after successful persistence, based
on actual insert/upsert results.

## Performance opportunities

1. **Fix projections first (B8).** This removes unnecessary payload transfer
   from several high-use methods. Verify command shape and bytes returned before
   measuring latency.

2. **Compute aggregates in MongoDB.** `sum()`, `average()`, `min()`, and `max()`
   currently transfer all matching values, construct models, and allocate
   additional arrays. `$group` can return one result. Preserve the existing
   empty-result, nonnumeric-value, and limit/skip semantics deliberately: native
   accumulators do not necessarily behave like the current validation. Treat
   percentile separately because server-version support and approximate versus
   exact results matter.

3. **Reduce deletion's ID prefetch.** Every deletion first reads all selected
   models/IDs and then sends one `$in` filter. Large deletes consume memory and
   can eventually exceed BSON command-size limits. When no limit/skip selection
   is needed, consider direct filtered `deleteMany()`. For bounded selections,
   retain raw IDs, project only `_id`, and batch large ID lists. Explicitly
   decide how the original predicate should behave if a document changes between
   selection and deletion; the current final delete contains only IDs.

4. **Avoid model construction for scalar reads.** Even after projection is
   corrected, `pluck()` invokes each model constructor and assigns defaults. Raw
   projection extraction would reduce allocations, especially for aggregate
   helpers. Benchmark with realistic constructors and payload sizes.

5. **Move distinct work toward the database.** `distinct()` downloads every
   projected document and deduplicates in JavaScript. Native distinct or a
   grouping pipeline can reduce transfer significantly when many records share a
   value. First settle semantics: the current code drops null/missing values and
   treats arrays as whole values. Its JSON-stringification keys also warrant
   tests for collisions between strings and objects, BSON values, and object key
   order.

6. **Make sanitization linear in object width.** Each reduce iteration spreads
   the entire accumulated object. For an object with k keys, this copies roughly
   1 + 2 + ... + k properties, giving quadratic work. A single output object can
   avoid this while preserving safe handling of special property names.
   Benchmark wide objects as well as nested arrays, and combine this work with
   B2.

7. **Consider removing `create()`'s read-after-insert.** Every create incurs an
   insert followed by a lookup. Hydrating the normalized inserted document could
   avoid the second round trip and the window in which another writer can
   change/delete it. Keep server-generated/default-field behavior and
   constructor behavior under test before adopting this.

8. **Benchmark pagination and relationship workloads before adding APIs.**
   Pagination performs count and fetch serially and uses increasing offsets.
   Keyset iteration already exists for batch work. Consider count-free or
   continuation-based pagination if UI workloads need it. Relationship methods
   are lazy and can produce N+1 queries in loops; a bulk-loading pattern may be
   sufficient before introducing an eager-loading framework.

## Additional missing test cases and contracts

These are coverage recommendations, not additional confirmed bugs:

- **Real MongoDB CI:** retain fast mock tests, and add a small real-server suite
  for BSON identity/types, projection commands, unique indexes, text search, and
  write results. Current integration suites explicitly select `DB_ADAPTER=mock`;
  CI has no real MongoDB service.
- **Atomic creation:** concurrent `firstOrCreate()` calls against a real unique
  index; verify one document, returned attributes, and creation metadata.
  Existing duplicate-key fallback tests inject mocked errors rather than
  exercising server concurrency.
- **Lifecycle failures:** insert/update/delete rejection, failed create
  read-back, unsuccessful upserts, and metadata after retry. Verify raw stored
  data as well as hydrated models.
- **Mutation boundaries:** specify whether `limit()`/`skip()` apply to
  `increment()`/`decrement()`. They currently use `updateMany()` with only
  filters, while deletion honors selection through `pluck()`. Also decide
  whether bulk increments should update timestamps.
- **Query reuse:** check `first()` followed by `get()`, pagination followed by
  another terminal call, and concurrent executions sharing one mutable builder.
  `first()` and `paginate()` mutate the builder's limit/offset; document or
  change that contract intentionally.
- **Numeric/type boundaries:** NaN, Infinity, mixed or missing numeric values;
  compile-time rejection of incrementing a string field; method names and
  runtime metadata appearing in `keyof T`. Existing type tests mainly cover
  field names and query values.
- **Relationship keys:** custom owner/local keys, zero/empty/null/missing keys,
  unsaved parents, and BSON foreign keys. Test the actual returned records, not
  only the assembled query.
- **Logger behavior:** asynchronous logger rejection and synchronous driver
  exceptions. `QueryLogger` returns `void`, but TypeScript accepts async
  callbacks; the current try/catch catches synchronous throws only. Decide
  whether asynchronous callbacks are supported.
- **Documented batch limitations:** keep explicit tests for ignored
  sort/limit/skip and homogeneous ObjectId batches. Mixed-type iteration is
  already documented as restricted; it is not counted as a new bug here.

## Suggested implementation order

1. Add failing regression cases for B1–B5; correct the range test that expects
   lost predicates.
2. Fix query composition, scope preservation, BSON preservation, raw-ID
   lifecycle, and connection initialization.
3. Fix B6–B10 with focused tests, including real-driver projection verification.
4. Establish real MongoDB CI before moving more behavior into native operations.
5. Benchmark projection, aggregation, deletion, and sanitizer improvements using
   representative data. Record latency, transferred bytes, peak memory, and
   operation count; do not infer speedups from small mock tests.

The existing tests provide useful coverage of common operations and recent
features. The highest-value addition is a small set of adversarial lifecycle and
real-driver contract tests that verify stored data and actual query behavior.
