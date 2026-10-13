import { PRODUCT_IMAGE_MAX } from '@pos/shared';

/**
 * ย่อรูปที่เลือก/ถ่ายให้เป็นสี่เหลี่ยมจัตุรัส (ครอปตรงกลาง) แล้วแปลงเป็น data URL ขนาดเล็ก
 * เก็บใน IndexedDB และซิงก์ไปกับสินค้าได้เลย ไม่ต้องมีที่เก็บไฟล์แยก
 */
export async function toProductImage(file: File, size = 256): Promise<string> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; // รูปโปร่งใสไม่กลายเป็นพื้นดำตอนแปลงเป็น JPEG
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close();

  for (const q of [0.82, 0.7, 0.55, 0.4]) {
    let url = canvas.toDataURL('image/webp', q);
    if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', q); // Safari รุ่นเก่าไม่รองรับ WebP
    if (url.length <= PRODUCT_IMAGE_MAX) return url;
  }
  throw new Error('รูปใหญ่เกินไป ลองเลือกรูปอื่น');
}
