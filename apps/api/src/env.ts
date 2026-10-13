import { z } from 'zod';

const Env = z.object({
  /** ว่าง = PGlite ในโฟลเดอร์ .pgdata, "pglite:memory" = in-memory, อื่นๆ = postgres:// */
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET ต้องยาวอย่างน้อย 16 ตัวอักษร'),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  OWNER_USERNAME: z.string().default('owner'),
  OWNER_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof Env>;
export const loadEnv = (): Env => Env.parse(process.env);
