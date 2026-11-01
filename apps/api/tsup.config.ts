import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts', 'src/seed.ts', 'src/vercel.ts'],
  format: 'esm',
  target: 'node20',
  clean: true,
  // shared เป็น TypeScript source → รวมเข้า bundle; dependency อื่นโหลดจาก node_modules
  noExternal: ['@pos/shared'],
});
