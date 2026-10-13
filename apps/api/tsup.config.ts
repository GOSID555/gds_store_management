import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts', 'src/seed.ts'],
  format: 'esm',
  target: 'node20',
  // shared เป็น TypeScript source → รวมเข้า bundle; dependency อื่นโหลดจาก node_modules
  noExternal: ['@pos/shared'],
});
