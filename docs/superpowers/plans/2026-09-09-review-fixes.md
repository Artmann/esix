# Review fixes implementation plan

**Goal:** Resolve CODE_REVIEW.md using failing regression tests before
implementation and coherent local commits. **Architecture:** Preserve the fluent
API; compose constraints without loss, retain BSON identity internally, use raw
projections and bounded processing, and test real driver contracts. **Tech
stack:** TypeScript, Vitest, MongoDB driver 6; no new runtime dependencies.
**Spec:** CODE_REVIEW.md

- [ ] Query correctness (B1/B4/B6/B7): add real MongoDB fixtures for ranges,
      repeated predicates, scoped find, ID lookup/sorting; observe failures; fix
      composition and normalization; run tests/checks; commit.
- [ ] BSON and lifecycle (B2/B3/B10): test BSON round trips, ObjectId/string
      collisions, failed saves and explicit-ID upserts; observe failures;
      preserve scalar BSON values and raw identity; update metadata after
      writes; verify and commit.
- [ ] Connections (B5): test delayed concurrent connects, rejection/retry and
      close/connect races; cache initialization and coordinate closure; verify
      and commit.
- [ ] Scalar reads and writes (B8/B9 and performance): test real projection
      commands, constructor-free pluck, large extrema, bounded deletion and
      aggregation semantics; implement raw reads, safe aggregation and batching;
      verify and commit.
- [ ] Remaining contracts: test logger failures, query reuse, numeric
      boundaries, relationships and batch limitations; implement corrections and
      document deliberate semantics; verify and commit.
- [ ] Real MongoDB CI, benchmarks, docs: run real driver tests, benchmark
      representative workloads, record measured results and compatibility
      decisions; run full package checks and build; commit.

Each code step uses red → green → refactor. New behavior is tested before
production edits. Report suggestions that depend on workload evidence are
evaluated and documented rather than automatically expanded into new public
APIs.
