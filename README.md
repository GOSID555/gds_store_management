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
3. Deploy แล้วเปิด `https://<project>.vercel.app` ใช้งานได้ทันที

### ไม่มีฐานข้อมูลก็ใช้ได้: โหมดเก็บในเครื่อง
ถ้ายังไม่ได้ผูก Neon (หรือ deploy แค่หน้าเว็บ) แอปจะเข้า **โหมดเก็บในเครื่อง** ให้เอง ข้อมูลอยู่ใน IndexedDB ของเบราว์เซอร์นั้น
ไม่ซิงก์ข้ามเครื่อง และจอลูกค้าใช้ได้เฉพาะหน้าต่างที่สองบนเครื่องเดียวกัน เหมาะกับการลองเล่น
หน้าเข้าสู่ระบบก็มีปุ่ม "ใช้แบบเก็บในเครื่องนี้" ให้เลือกเองได้

### ระบบเข้าสู่ระบบ (เปิดเป็นค่าเริ่มต้น)
- **ครั้งแรก** ที่เปิดเว็บหลังผูกฐานข้อมูล จะขึ้นหน้า **ตั้งบัญชีเจ้าของร้าน** (ทำได้ครั้งเดียว) → เปิดลิงก์เองทันทีหลัง deploy
  (หรือตั้ง `OWNER_USERNAME` / `OWNER_PASSWORD` ใน Environment Variables ให้สร้างบัญชีตอน build)
- เจ้าของร้านเพิ่มบัญชีแคชเชียร์, **ตั้งรหัสใหม่**, **ปิดบัญชี** ได้ที่ ตั้งค่า → พนักงาน
  (ตั้งรหัสใหม่/ปิดบัญชี = บัญชีนั้นออกจากระบบทุกเครื่องทันที)
- ทุกคนเปลี่ยนรหัสของตัวเองได้ที่ ตั้งค่า → เปลี่ยนรหัสผ่านของฉัน
- จอลูกค้า `/display` และหน้าสแกนจ่าย `/pay` ไม่ต้องล็อกอิน (ใช้รหัสจับคู่ เห็นแค่บิลปัจจุบัน)
- `JWT_SECRET` ไม่ตั้งก็ได้ (สร้างจาก `DATABASE_URL`) ตั้งเองได้ถ้าต้องการ
- อยากเปิดให้ใช้โดยไม่ล็อกอิน (เดโม): ตั้ง `REQUIRE_LOGIN=false`

ข้อจำกัดบน Vercel: จอลูกค้าอัปเดตแบบ polling ทุก ~1 วินาที (serverless ไม่รองรับการเชื่อมต่อค้างนาน)

### ที่อื่น (VPS / Railway / Render)
API: `npm run build -w @pos/api` แล้วรัน `node apps/api/dist/server.js` (cwd = `apps/api`) ·
เว็บ: `apps/web/dist` วางบน static host ให้ `/api/*` proxy ไป API · ต้องใช้ HTTPS เพื่อให้ PWA ทำงานบนมือถือ

`prototype/pos.html` คือต้นแบบหน้าตาเวอร์ชันแรก (ไฟล์เดียว) เก็บไว้อ้างอิง
