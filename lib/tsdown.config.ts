import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  outDir: './dist',
  platform: 'node',
  dts: {
    oxc: true
  },
})
