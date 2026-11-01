import { encodeProductImage } from './image';

/**
 * ภาพประกอบของเมนูตัวอย่าง วาดเองเป็น SVG แล้วแปลงเป็นรูป (WebP/JPEG) เก็บไปกับสินค้า
 * ไม่ต้องโหลดรูปจากที่อื่น จึงใช้ได้ทั้งออฟไลน์และซิงก์ข้ามเครื่อง
 */
type Drink = {
  kind: 'drink';
  bg: string;
  liquid: string;
  /** ชั้นบน เช่น มัทฉะลาเต้ / ครีมชีส */
  top?: { color: string; height: number };
  /** ลายไซรัปบราวน์ชูการ์/คาราเมลไหลข้างแก้ว */
  streak?: string;
  pearls?: boolean;
  fruit?: { color: string; inner: string };
  ice?: boolean;
  straw: string;
};
type Dish = { kind: 'pearls' | 'pudding' | 'jelly' | 'toast' | 'waffle'; bg: string };
type Art = Drink | Dish;

const BG = { taro: '#EFE5FB', matcha: '#E6F2DF', berry: '#FCE4EA', mango: '#FDF0D9', blue: '#E3ECFA', milk: '#F8EADB' };
const STRAW = { pink: '#F28BA8', taro: '#A77BDB', mango: '#F2A93B', matcha: '#6FA65A', blue: '#5F8FD9' };

const ART: Record<string, Art> = {
  'ชานมไข่มุก': { kind: 'drink', bg: BG.milk, liquid: '#C99A6E', pearls: true, ice: true, straw: STRAW.pink },
  'ชานมไต้หวันบราวน์ชูการ์': { kind: 'drink', bg: BG.mango, liquid: '#E9D6BE', streak: '#7A3F1D', pearls: true, straw: STRAW.taro },
  'ชาไทยไข่มุก': { kind: 'drink', bg: BG.mango, liquid: '#E9853C', top: { color: '#F6E6D4', height: 22 }, pearls: true, ice: true, straw: STRAW.matcha },
  'ชาเขียวนมไข่มุก': { kind: 'drink', bg: BG.matcha, liquid: '#A9C46E', pearls: true, ice: true, straw: STRAW.pink },
  'ชานมเผือก': { kind: 'drink', bg: BG.taro, liquid: '#B596DC', pearls: true, ice: true, straw: STRAW.mango },
  'ชานมคาราเมล': { kind: 'drink', bg: BG.mango, liquid: '#D3A06A', streak: '#B5651D', pearls: true, straw: STRAW.blue },
  'นมสดบราวน์ชูการ์': { kind: 'drink', bg: BG.milk, liquid: '#F6EFE6', streak: '#7A3F1D', pearls: true, straw: STRAW.pink },
  'นมชมพู': { kind: 'drink', bg: BG.berry, liquid: '#F5A9C0', ice: true, straw: STRAW.taro },
  'โกโก้เข้มข้น': { kind: 'drink', bg: BG.milk, liquid: '#6E4433', top: { color: '#F4E7D8', height: 18 }, ice: true, straw: STRAW.mango },
  'มัทฉะลาเต้': { kind: 'drink', bg: BG.matcha, liquid: '#F5EFE3', top: { color: '#79A84E', height: 52 }, ice: true, straw: STRAW.pink },
  'ชาพีชโซดา': { kind: 'drink', bg: BG.mango, liquid: '#F9C49A', fruit: { color: '#F59E6B', inner: '#FBD3B3' }, ice: true, straw: STRAW.blue },
  'ชาลิ้นจี่': { kind: 'drink', bg: BG.berry, liquid: '#F7E3E7', fruit: { color: '#FFFFFF', inner: '#F3D9DE' }, ice: true, straw: STRAW.pink },
  'ชามะม่วงสด': { kind: 'drink', bg: BG.mango, liquid: '#F7C34C', fruit: { color: '#F29A1F', inner: '#FAD072' }, ice: true, straw: STRAW.matcha },
  'ชาสตรอว์เบอร์รี': { kind: 'drink', bg: BG.berry, liquid: '#F38AA2', fruit: { color: '#E2445F', inner: '#F7A1B2' }, ice: true, straw: STRAW.matcha },
  'ไข่มุกเพิ่ม': { kind: 'pearls', bg: BG.milk },
  'พุดดิ้งไข่': { kind: 'pudding', bg: BG.mango },
  'เจลลี่ฟรุตสลัด': { kind: 'jelly', bg: BG.blue },
  'ครีมชีสโฟม': { kind: 'drink', bg: BG.blue, liquid: '#C99A6E', top: { color: '#FFF9F0', height: 40 }, straw: STRAW.blue },
  'ฮันนี่โทสต์': { kind: 'toast', bg: BG.mango },
  'วาฟเฟิลเนยสด': { kind: 'waffle', bg: BG.milk },
};

/** สุ่มแบบคงที่ต่อเมนู เพื่อให้ตำแหน่งไข่มุก/ผลไม้ไม่ซ้ำกันแต่วาดซ้ำได้ผลเดิม */
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
}

const pearl = (x: number, y: number, r = 9) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#3A2216"/><circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.28}" fill="#fff" opacity=".45"/>`;

function background(bg: string) {
  return `<rect width="256" height="256" fill="${bg}"/>
  <g fill="#3A2216" opacity=".05"><circle cx="30" cy="40" r="10"/><circle cx="226" cy="30" r="8"/><circle cx="210" cy="226" r="12"/><circle cx="40" cy="214" r="7"/></g>`;
}

function drinkSvg(a: Drink, r: () => number) {
  const cup = 'M76 84 L180 84 L166 226 Q165 236 155 236 L101 236 Q91 236 90 226 Z';
  const liquidTop = 104;
  let inside = `<rect x="60" y="${liquidTop}" width="140" height="140" fill="${a.liquid}"/>`;
  if (a.top) inside += `<rect x="60" y="${liquidTop}" width="140" height="${a.top.height}" fill="${a.top.color}"/>`;
  if (a.streak)
    for (let i = 0; i < 4; i++) {
      const x = 92 + i * 22 + r() * 8;
      inside += `<path d="M${x} ${liquidTop} q ${8 + r() * 6} 30 -2 60 q -8 30 4 70" stroke="${a.streak}" stroke-width="${7 + r() * 5}" fill="none" stroke-linecap="round" opacity=".75"/>`;
    }
  if (a.ice) for (let i = 0; i < 3; i++) inside += `<rect x="${92 + i * 24 + r() * 6}" y="${liquidTop + 14 + r() * 24}" width="24" height="22" rx="6" fill="#fff" opacity=".45" transform="rotate(${r() * 30 - 15} ${104 + i * 24} ${liquidTop + 30})"/>`;
  if (a.fruit)
    for (let i = 0; i < 4; i++) {
      const x = 100 + r() * 56;
      const y = liquidTop + 40 + r() * 70;
      inside += `<circle cx="${x}" cy="${y}" r="14" fill="${a.fruit.color}"/><circle cx="${x}" cy="${y}" r="9" fill="${a.fruit.inner}"/>`;
    }
  if (a.pearls) {
    for (let row = 0; row < 3; row++) for (let i = 0; i < 6 - row; i++) inside += pearl(98 + i * 13 + row * 6 + r() * 3, 226 - row * 15 - r() * 3);
  }
  return `${background(a.bg)}
  <defs><clipPath id="cup"><path d="${cup}"/></clipPath></defs>
  <rect x="146" y="14" width="16" height="140" rx="8" fill="${a.straw}" transform="rotate(14 154 84)"/>
  <g clip-path="url(#cup)">${inside}</g>
  <path d="${cup}" fill="#fff" fill-opacity=".18" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>
  <path d="M84 98 L98 220" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".5"/>
  <path d="M70 84 Q128 34 186 84 Z" fill="#fff" fill-opacity=".55" stroke="#fff" stroke-width="4"/>
  <rect x="64" y="78" width="128" height="12" rx="6" fill="#fff"/>`;
}

function dishSvg(a: Dish, r: () => number) {
  const bowl = `<path d="M44 140 Q128 262 212 140 Z" fill="#fff"/><rect x="38" y="132" width="180" height="14" rx="7" fill="#fff"/><path d="M62 160 Q128 236 194 160" stroke="${'#F3E3D2'}" stroke-width="6" fill="none"/>`;
  switch (a.kind) {
    case 'pearls': {
      let p = '';
      for (let row = 0; row < 4; row++) for (let i = 0; i < 8 - row * 2; i++) p += pearl(70 + i * 16 + row * 16 + r() * 4, 128 - row * 15 - r() * 4, 10);
      return `${background(a.bg)}${p}${bowl}`;
    }
    case 'jelly': {
      const colors = ['#F28BA8', '#F2A93B', '#6FA65A', '#A77BDB', '#5F8FD9', '#F7D154'];
      let j = '';
      for (let i = 0; i < 12; i++) j += `<rect x="${66 + r() * 110}" y="${90 + r() * 40}" width="22" height="22" rx="6" fill="${colors[i % colors.length]}" opacity=".9" transform="rotate(${r() * 40 - 20} ${80 + i * 8} 110)"/>`;
      return `${background(a.bg)}${j}${bowl}`;
    }
    case 'pudding':
      return `${background(a.bg)}
      <ellipse cx="128" cy="196" rx="88" ry="18" fill="#fff"/>
      <path d="M74 190 L90 104 Q128 92 166 104 L182 190 Q128 204 74 190 Z" fill="#F7D774"/>
      <path d="M90 104 Q128 92 166 104 L170 126 Q150 118 140 132 Q128 120 114 134 Q104 118 86 126 Z" fill="#9A4E22"/>
      <path d="M98 120 L92 176" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".5"/>`;
    case 'toast':
      return `${background(a.bg)}
      <ellipse cx="128" cy="214" rx="96" ry="16" fill="#fff"/>
      <path d="M58 110 L128 84 L198 110 L128 136 Z" fill="#F9DBA4"/>
      <path d="M58 110 L128 136 L128 214 L58 188 Z" fill="#E9AE5E"/>
      <path d="M198 110 L128 136 L128 214 L198 188 Z" fill="#D9963F"/>
      <path d="M92 98 L128 110 L164 98" stroke="#E9AE5E" stroke-width="4" fill="none"/>
      <rect x="112" y="92" width="32" height="20" rx="4" fill="#FFF3B8" transform="rotate(-20 128 102)"/>
      <path d="M78 116 q -4 30 6 46 q 6 -16 4 -40" fill="#F4A52C"/><path d="M150 132 q 2 26 10 34 q 4 -14 2 -36" fill="#F4A52C"/>`;
    case 'waffle': {
      let grid = '';
      for (let i = 1; i < 5; i++) grid += `<line x1="${56 + i * 29}" y1="66" x2="${56 + i * 29}" y2="190" stroke="#B9772F" stroke-width="6"/><line x1="56" y1="${66 + i * 25}" x2="200" y2="${66 + i * 25}" stroke="#B9772F" stroke-width="6"/>`;
      return `${background(a.bg)}
      <ellipse cx="128" cy="210" rx="96" ry="16" fill="#fff"/>
      <rect x="56" y="66" width="144" height="124" rx="22" fill="#E7A955"/>${grid}
      <rect x="56" y="66" width="144" height="124" rx="22" fill="none" stroke="#C98636" stroke-width="5"/>
      <rect x="108" y="104" width="40" height="28" rx="6" fill="#FFF3B8"/>`;
    }
  }
}

export function sampleArtSvg(name: string): string | null {
  const a = ART[name];
  if (!a) return null;
  const r = rng(name);
  const body = a.kind === 'drink' ? drinkSvg(a, r) : dishSvg(a, r);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">${body}</svg>`;
}

/** วาดเป็นรูปจริง (data URL) สำหรับเก็บในสินค้า; ไม่มีภาพของเมนูนี้ = null */
export async function sampleArtImage(name: string): Promise<string | null> {
  const svg = sampleArtSvg(name);
  if (!svg) return null;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  canvas.getContext('2d')!.drawImage(img, 0, 0, 256, 256);
  return encodeProductImage(canvas);
}
