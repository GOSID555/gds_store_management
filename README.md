# หน้าร้าน POS

ระบบขายหน้าร้านแบบ offline-first ใช้ได้ทุกอุปกรณ์ (PWA) ซิงก์ผ่าน API + PostgreSQL

- **apps/web**: React + Vite + PWA + IndexedDB (Dexie)
- **apps/api**: Fastify + Drizzle ORM + PostgreSQL (dev ใช้ PGlite ไม่ต้องติดตั้ง Postgres)
- **packages/shared**: schema, โปรโตคอลซิงก์, ฟังก์ชันเงิน ที่ใช้ร่วมกัน

อ่านการออกแบบได้ที่ [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## เริ่มใช้งาน (dev)

```bash
npm install
```

```bash
cp .env.example .env
```

แก้ `JWT_SECRET` และ `OWNER_PASSWORD` ใน `.env` แล้ว:

```bash
npm run db:seed
```

```bash
npm run dev
```

- เว็บ: http://localhost:5173 (มือถือในวง Wi-Fi เดียวกันเข้าผ่าน IP ของเครื่องได้)
- API: http://localhost:3001
- เข้าสู่ระบบด้วย `OWNER_USERNAME` / `OWNER_PASSWORD` จาก `.env`

ไม่ตั้ง `DATABASE_URL` = ใช้ PGlite เก็บไว้ที่ `.pgdata/` ถ้าจะใช้ Postgres จริง: `docker compose up -d` แล้วตั้ง
`DATABASE_URL=postgres://pos:pos@localhost:5432/pos`

## คำสั่ง

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | รัน API + เว็บ |
| `npm test` | test ฝั่ง API (ซิงก์, สิทธิ์, idempotency) |
| `npm run typecheck` | ตรวจ type ทุก workspace |
| `npm run build` | build API (`apps/api/dist`) และเว็บ (`apps/web/dist`) |
| `npm run db:generate` | สร้าง migration หลังแก้ `apps/api/src/db/schema.ts` |

## Deploy ขึ้น Vercel

โปรเจกต์ตั้งค่าไว้แล้ว (`vercel.json`): เว็บเป็น static, `/api/*` เป็น Serverless Function (`api/index.js` → `apps/api/src/vercel.ts`)
และตอน build จะรัน migration + สร้างบัญชีเจ้าของร้านให้อัตโนมัติ (`apps/api/src/migrate.ts`)

1. Vercel → **Add New → Project** → Import repo นี้จาก GitHub (Framework Preset: Other, Root Directory: `./`)
2. ก่อนกด Deploy: **Storage → Create Database → Neon (Postgres)** แล้วผูกกับโปรเจกต์ (จะได้ `DATABASE_URL` อัตโนมัติ)
3. **Settings → Environment Variables** ตั้งค่า:
   | ชื่อ | ค่า |
   |---|---|
   | `JWT_SECRET` | สุ่มยาว 32 ตัวขึ้นไป (`openssl rand -hex 32`) |
   | `OWNER_USERNAME` | ชื่อผู้ใช้เจ้าของร้าน เช่น `owner` |
   | `OWNER_PASSWORD` | รหัสผ่านเจ้าของร้าน (ใช้ตอนสร้างบัญชีครั้งแรกเท่านั้น) |
   | `DATABASE_URL` | มาจาก Neon อัตโนมัติ (ใช้แบบ pooled) |
4. Deploy แล้วเปิด `https://<project>.vercel.app` เข้าสู่ระบบด้วยบัญชีเจ้าของร้าน

ข้อจำกัดบน Vercel: จอลูกค้าอัปเดตแบบ polling ทุก ~1 วินาที (serverless ไม่รองรับการเชื่อมต่อค้างนาน)

### ที่อื่น (VPS / Railway / Render)
API: `npm run build -w @pos/api` แล้วรัน `node apps/api/dist/server.js` (cwd = `apps/api`) ·
เว็บ: `apps/web/dist` วางบน static host ให้ `/api/*` proxy ไป API · ต้องใช้ HTTPS เพื่อให้ PWA ทำงานบนมือถือ

`prototype/pos.html` คือต้นแบบหน้าตาเวอร์ชันแรก (ไฟล์เดียว) เก็บไว้อ้างอิง
