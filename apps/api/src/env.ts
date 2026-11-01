import { createHash } from 'node:crypto';
import { z } from 'zod';

const Env = z.object({
  /** ว่าง = PGlite ในโฟลเดอร์ .pgdata, "pglite:memory" = in-memory, อื่นๆ = postgres:// */
  DATABASE_URL: z.string().optional(),
  /**
   * "true" = ต้องเข้าสู่ระบบด้วยชื่อผู้ใช้/รหัสผ่าน
   * อื่นๆ (ค่าเริ่มต้น) = โหมดทดลอง: เปิดเว็บแล้วใช้ได้ทันทีในสิทธิ์เจ้าของร้าน ไม่ต้องมีบัญชี
   */
  REQUIRE_LOGIN: z.string().optional().transform((v) => v === 'true'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET ต้องยาวอย่างน้อย 16 ตัวอักษร').optional(),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  OWNER_USERNAME: z.string().default('owner'),
  OWNER_PASSWORD: z.string().optional(),
});

export type Env = Omit<z.infer<typeof Env>, 'JWT_SECRET'> & { JWT_SECRET: string };

/** Vercel/Neon อาจตั้งชื่อตัวแปรต่างกันตาม prefix ที่เลือกตอนเชื่อมฐานข้อมูล */
export const databaseUrlFromEnv = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.STORAGE_URL || undefined;

export function loadEnv(): Env {
  const env = Env.parse({ ...process.env, DATABASE_URL: databaseUrlFromEnv() });
  if (env.JWT_SECRET) return { ...env, JWT_SECRET: env.JWT_SECRET };
  if (env.REQUIRE_LOGIN) throw new Error('REQUIRE_LOGIN=true ต้องตั้ง JWT_SECRET ด้วย');
  // โหมดทดลอง: ทุกคนเป็นเจ้าของร้านอยู่แล้ว ใช้ secret ที่คงที่ต่อฐานข้อมูล (ทุก instance ได้ค่าเดียวกัน)
  const derived = createHash('sha256').update(`pos-open-mode:${env.DATABASE_URL ?? 'local'}`).digest('hex');
  return { ...env, JWT_SECRET: derived };
}
