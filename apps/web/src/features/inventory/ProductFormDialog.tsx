import { useState, type ChangeEvent, type FormEvent } from 'react';
import { toBaht, toSatang, type Product } from '@pos/shared';
import { Modal } from '../../components/Modal';
import { toProductImage } from '../../lib/image';
import { actions } from '../../lib/mutations';

export function ProductFormDialog({ product, categories, onClose }: { product: Product | null; categories: string[]; onClose: () => void }) {
  const isNew = !product;
  const [f, setF] = useState({
    name: product?.name ?? '',
    category: product?.category ?? '',
    sku: product?.sku ?? '',
    price: product ? String(toBaht(product.price)) : '',
    cost: product ? String(toBaht(product.cost)) : '',
    lowStock: String(product?.lowStock ?? 5),
    initialStock: '0',
  });
  const [image, setImage] = useState(product?.image ?? null);
  const [imageError, setImageError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function pickImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageError('');
    try {
      setImage(await toProductImage(file));
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'เปิดรูปไม่ได้');
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    await actions.saveProduct(
      {
        id: product?.id ?? crypto.randomUUID(),
        name: f.name.trim(),
        category: f.category.trim() || 'อื่นๆ',
        sku: f.sku.trim() || null,
        price: toSatang(f.price),
        cost: toSatang(f.cost),
        lowStock: parseInt(f.lowStock) || 0,
        image,
        archived: false,
      },
      isNew ? parseInt(f.initialStock) || 0 : 0,
    );
    onClose();
  }

  if (confirmDelete && product)
    return (
      <Modal title={`ลบ “${product.name}”?`} onClose={() => setConfirmDelete(false)}>
        <div className="modal-b"><p className="note">สินค้าจะหายจากหน้าขายและสต็อก บิลเก่าที่เคยขายยังอยู่ครบ</p></div>
        <div className="modal-f">
          <button className="btn" onClick={() => setConfirmDelete(false)}>ไม่ลบ</button>
          <button className="btn danger" onClick={async () => { await actions.archiveProduct(product.id); onClose(); }}>ลบสินค้า</button>
        </div>
      </Modal>
    );

  return (
    <Modal title={isNew ? 'เพิ่มสินค้า' : 'แก้ไขสินค้า'} onClose={onClose}>
      <form className="modal-b" onSubmit={submit}>
        <div className="form">
          <div className="f full imgpick">
            <div className="thumb lg">{image ? <img src={image} alt="" /> : <span>ไม่มีรูป</span>}</div>
            <div className="imgpick-b">
              <label className="btn sm">
                {image ? 'เปลี่ยนรูป' : 'เลือกรูป / ถ่ายรูป'}
                <input id="pf-image" type="file" accept="image/*" hidden onChange={pickImage} />
              </label>
              {image && <button type="button" className="btn sm ghost" onClick={() => setImage(null)}>เอารูปออก</button>}
              {imageError && <span className="err">{imageError}</span>}
            </div>
          </div>
          <label className="f full">ชื่อสินค้า<input id="pf-name" required autoFocus value={f.name} onChange={set('name')} /></label>
          <label className="f">หมวดหมู่<input id="pf-cat" list="catlist" placeholder="เช่น เครื่องดื่ม" value={f.category} onChange={set('category')} /></label>
          <label className="f">บาร์โค้ด / รหัส<input id="pf-sku" inputMode="numeric" placeholder="ไม่บังคับ" value={f.sku} onChange={set('sku')} /></label>
          <label className="f">ราคาขาย (บาท)<input id="pf-price" type="number" step="0.01" min={0} required inputMode="decimal" value={f.price} onChange={set('price')} /></label>
          <label className="f">ต้นทุน (บาท)<input id="pf-cost" type="number" step="0.01" min={0} inputMode="decimal" value={f.cost} onChange={set('cost')} /></label>
          {isNew && <label className="f">จำนวนตั้งต้น<input id="pf-stock" type="number" step={1} min={0} inputMode="numeric" value={f.initialStock} onChange={set('initialStock')} /></label>}
          <label className="f">เตือนเมื่อเหลือไม่เกิน<input id="pf-low" type="number" step={1} min={0} inputMode="numeric" value={f.lowStock} onChange={set('lowStock')} /></label>
        </div>
        <datalist id="catlist">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        {!isNew && <p className="note">เปลี่ยนจำนวนคงเหลือได้ที่ปุ่ม “ปรับสต็อก” (ทุกการเปลี่ยนแปลงถูกบันทึกเป็นประวัติ)</p>}
        <div className="modal-f" style={{ padding: 0 }}>
          {!isNew && <button type="button" className="btn ghost" style={{ marginRight: 'auto', color: 'var(--danger)' }} onClick={() => setConfirmDelete(true)}>ลบสินค้า</button>}
          <button type="button" className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary">บันทึก</button>
        </div>
      </form>
    </Modal>
  );
}
