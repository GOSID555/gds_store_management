import { createHash } from 'node:crypto';
import { z } from 'zod';

const Env = z.object({
  /** ว่าง = PGlite ในโฟลเดอร์ .pgdata, "pglite:memory" = in-memory, อื่นๆ = postgres:// */
  DATABASE_URL: z.string().optional(),
  /**
   * ค่าเริ่มต้น = ต้องเข้าสู่ระบบ (ครั้งแรกหน้าเว็บให้ตั้งบัญชีเจ้าของร้านเอง)
   * "false" = โหมดทดลอง: เปิดเว็บแล้วใช้ได้ทันทีในสิทธิ์เจ้าของร้าน ไม่ต้องมีบัญชี
   */
  REQUIRE_LOGIN: z.string().optional().transform((v) => v !== 'false'),
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
  // ไม่ได้ตั้ง JWT_SECRET: สร้างจาก DATABASE_URL (เป็นความลับอยู่แล้ว และทุก instance ได้ค่าเดียวกัน)
  // ใส่โหมดไว้ด้วย → สลับโหมดเมื่อไหร่ token เก่าทั้งหมดใช้ไม่ได้ทันที
  const mode = env.REQUIRE_LOGIN ? 'login' : 'open';
  const derived = createHash('sha256').update(`pos-${mode}:${env.DATABASE_URL ?? 'local'}`).digest('hex');
  return { ...env, JWT_SECRET: derived };
}
