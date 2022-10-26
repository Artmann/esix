import process from 'process'

import { build } from './index.js'

(async function main() {
  const [ directory ] =  process.argv.slice(2)

  await build(directory)
})()
