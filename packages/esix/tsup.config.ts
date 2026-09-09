import { defineConfig } from 'tsup'
export default defineConfig({
  entry: { index: 'src/index.ts', effect: 'src/effect/index.ts' },
  format: ['cjs', 'esm'],
  dts: true,
  external: ['esix', 'effect'],
  splitting: false,
  clean: true
})
