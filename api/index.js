// Vercel Serverless Function: ทุก /api/* ถูก rewrite มาที่นี่ (ดู vercel.json)
// โค้ดจริงอยู่ที่ apps/api/src/vercel.ts ซึ่ง build เป็น apps/api/dist/vercel.js ตอน deploy
export { default } from '../apps/api/dist/vercel.js';
