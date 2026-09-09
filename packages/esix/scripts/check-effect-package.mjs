import { execFileSync } from 'node:child_process'
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = fileURLToPath(new URL('..', import.meta.url))
const directory = mkdtempSync(join(tmpdir(), 'esix-package-'))
const run = (command, args, cwd = directory) =>
  execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 180000
  })
try {
  const packed = JSON.parse(
    run(
      'npm',
      ['pack', '--ignore-scripts', '--json', '--pack-destination', directory],
      root
    )
  )[0]
  writeFileSync(
    join(directory, 'package.json'),
    JSON.stringify({ private: true, type: 'module' })
  )
  run('npm', [
    'install',
    '--ignore-scripts',
    '--legacy-peer-deps',
    '--no-audit',
    '--no-fund',
    join(directory, packed.filename),
    'mongodb@6',
    'mongo-mock@4'
  ])
  assert(
    !existsSync(join(directory, 'node_modules/effect')),
    'Root-only fixture must not have Effect installed'
  )
  run('node', [
    '--input-type=module',
    '-e',
    "import { BaseModel } from 'esix'; if (!new BaseModel()) throw Error('missing model')"
  ])
  run('node', [
    '-e',
    "require('esix'); require('esix/dist/index.cjs'); require('esix/package.json')"
  ])
  console.log('Root ESM/CJS imports pass without Effect installed')

  run('npm', [
    'install',
    '--ignore-scripts',
    '--legacy-peer-deps',
    '--no-audit',
    '--no-fund',
    `effect@${process.env.ESIX_TEST_EFFECT_VERSION || '3.21.3'}`,
    'typescript@5.8.2',
    '@types/node@22'
  ])
  const smoke = `
import assert from 'node:assert/strict'
import { BaseModel } from 'esix'
import { Esix } from 'esix/effect'
import { Effect } from 'effect'
class User extends BaseModel { age = 0 }
let writes = 0
const collection = {
  find: () => ({ toArray: async () => [{ _id: 'one', age: 30 }] }),
  updateOne: async () => { writes++; return { upsertedCount: 0 } }
}
const db = { collection: () => collection }
await Effect.runPromise(Effect.gen(function* () {
  const esix = yield* Esix
  const users = yield* esix.model(User).get()
  assert(users[0] instanceof BaseModel)
  savedUser = users[0]
}).pipe(Effect.provide(Esix.layerFromDb(db))))
await savedUser.save()
assert.equal(writes, 1)
`
  // Exercise root/effect shared hydration and WeakMap state using the packed files.
  writeFileSync(join(directory, 'smoke.mjs'), 'let savedUser;\n' + smoke)
  run('node', ['smoke.mjs'])
  const cjs = smoke.replace(
    /import (.+) from '([^']+)'/g,
    (_, binding, module) => `const ${binding} = require('${module}')`
  )
  writeFileSync(
    join(directory, 'smoke.cjs'),
    `(async () => { let savedUser; ${cjs} })().catch(error => { console.error(error); process.exitCode = 1 })`
  )
  run('node', ['smoke.cjs'])
  const effectVersion = JSON.parse(
    readFileSync(join(directory, 'node_modules/effect/package.json'), 'utf8')
  ).version
  console.log(`Verified Effect ${effectVersion}`)

  const docs = ['effect-quickstart.md', 'effect.md']
  const fixtures = []
  for (const doc of docs) {
    const contents = readFileSync(resolve(root, '../website/docs', doc), 'utf8')
    for (const [index, match] of [
      ...contents.matchAll(/```ts\n([\s\S]*?)```/g)
    ].entries()) {
      const filename = `${doc}-${index}.mts`
      writeFileSync(join(directory, filename), match[1])
      fixtures.push(filename)
    }
  }
  assert(
    fixtures.length >= 2,
    'Both Effect documentation pages must contain checked examples'
  )
  const tsc = join(directory, 'node_modules/typescript/bin/tsc')
  for (const [module, resolution] of [
    ['NodeNext', 'NodeNext'],
    ['ESNext', 'Bundler']
  ]) {
    run('node', [
      tsc,
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--target',
      'ES2022',
      '--module',
      module,
      '--moduleResolution',
      resolution,
      ...fixtures
    ])
  }
  writeFileSync(
    join(directory, 'consumer.cts'),
    "import { Esix } from 'esix/effect'; import { BaseModel } from 'esix'; void Esix; void BaseModel;\n"
  )
  run('node', [
    tsc,
    '--noEmit',
    '--strict',
    '--skipLibCheck',
    '--target',
    'ES2022',
    '--module',
    'NodeNext',
    '--moduleResolution',
    'NodeNext',
    'consumer.cts'
  ])
  if (process.env.ESIX_TEST_MONGODB_URI) {
    // Substitute only the documented database connection, then clean this unique DB.
    const dbName = `esix_quickstart_${Date.now()}`
    const source = readFileSync(
      join(directory, 'effect-quickstart.md-0.mts'),
      'utf8'
    )
      .replace(
        'mongodb://127.0.0.1:27017/esix_effect_quickstart',
        process.env.ESIX_TEST_MONGODB_URI
      )
      .replace("database: 'esix_effect_quickstart'", `database: '${dbName}'`)
    writeFileSync(join(directory, 'quickstart.mts'), source)
    run('node', [
      tsc,
      '--skipLibCheck',
      '--target',
      'ES2022',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      'quickstart.mts'
    ])
    try {
      assert.match(run('node', ['quickstart.mjs']), /Alice/)
    } finally {
      run('node', [
        '--input-type=module',
        '-e',
        `import {MongoClient} from 'mongodb'; const client = new MongoClient(${JSON.stringify(process.env.ESIX_TEST_MONGODB_URI)}); try { await client.db(${JSON.stringify(dbName)}).dropDatabase(); } finally { await client.close(); }`
      ])
    }
  }
  console.log(
    `Packed Effect imports, shared model ownership, and ${fixtures.length} documentation examples pass`
  )
} catch (error) {
  if (error.stdout) process.stderr.write(error.stdout)
  if (error.stderr) process.stderr.write(error.stderr)
  throw error
} finally {
  rmSync(directory, { recursive: true, force: true })
}
