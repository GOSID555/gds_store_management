import { useEffect, useState, type FormEvent } from 'react';
import { isValidPromptPayId } from '@pos/shared';
import { QrCode } from '../../components/QrCode';
import { api, HttpError } from '../../lib/api';
import { displayUrl, getDisplayCode, resetDisplayCode } from '../../lib/display';
import { usePendingCount, useSettings, useSyncErrors } from '../../lib/hooks';
import { actions } from '../../lib/mutations';
import { session, useSession, type SessionUser } from '../../lib/session';
import { resetLocalData } from '../../lib/sync/engine';

export function SettingsPage() {
  const s = useSession()!;
  const isOwner = s.user.role === 'owner';
  const pending = usePendingCount();
  const errors = useSyncErrors();

  async function logout() {
    await resetLocalData();
    session.set(null);
  }

  return (
    <section className="view">
      <div className="scroll"><div className="wrap" style={{ maxWidth: 720 }}>
        <div className="sec-h"><div><h2>ตั้งค่า</h2><p>{s.local ? 'โหมดเก็บในเครื่องนี้ (ไม่ซิงก์)' : `เข้าสู่ระบบเป็น ${s.user.name} (${s.user.role === 'owner' ? 'เจ้าของร้าน' : 'แคชเชียร์'})`}</p></div></div>
        {s.local && (
          <div className="panel"><div className="modal-b">
            <p className="note">ข้อมูลทั้งหมดอยู่ในเบราว์เซอร์นี้เท่านั้น ไม่ซิงก์กับเครื่องอื่น ถ้าล้างข้อมูลเบราว์เซอร์หรือเปิดโหมดไม่ระบุตัวตน ข้อมูลจะหาย</p>
          </div></div>
        )}
        {isOwner && <ShopForm />}
        <DisplayPairing local={!!s.local} />
        {isOwner && !s.local && <Staff />}
        {errors.length > 0 && (
          <div className="panel">
            <div className="panel-h"><h3>รายการที่เซิร์ฟเวอร์ไม่รับ</h3></div>
            <ul className="top">{errors.slice(0, 10).map((e, i) => <li key={i}><span>{e.type}: {e.error}</span><span className="note">{new Date(e.at).toLocaleString('th-TH')}</span></li>)}</ul>
          </div>
        )}
        {!s.local && <div className="panel">
          <div className="panel-h"><h3>ออกจากระบบ</h3></div>
          <div className="modal-b">
            {pending > 0
              ? <p className="err">ยังมี {pending} รายการที่ยังไม่ได้ส่งขึ้นเซิร์ฟเวอร์ ต่ออินเทอร์เน็ตให้ซิงก์เสร็จก่อนออกจากระบบ</p>
              : <p className="note">ข้อมูลในเครื่องนี้จะถูกล้าง ข้อมูลบนเซิร์ฟเวอร์ยังอยู่ครบ</p>}
            <button className="btn" style={{ alignSelf: 'flex-start' }} disabled={pending > 0} onClick={() => void logout()}>ออกจากระบบ</button>
          </div>
        </div>}
      </div></div>
    </section>
  );
}

function ShopForm() {
  const settings = useSettings();
  const [f, setF] = useState({ name: '', address: '', phone: '', promptPayId: '' });
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (settings) setF({ ...settings, promptPayId: settings.promptPayId ?? '' }); }, [settings]);
  const edit = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF({ ...f, [k]: e.target.value }); setSaved(false); setErr(''); };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const pp = f.promptPayId.replace(/\D/g, '');
    if (pp && !isValidPromptPayId(pp)) return setErr('รหัสพร้อมเพย์ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลขประจำตัว 13 หลัก');
    await actions.saveSettings({ name: f.name.trim(), address: f.address.trim(), phone: f.phone.trim(), promptPayId: pp });
    setSaved(true);
  }
  return (
    <form className="panel" onSubmit={submit}>
      <div className="panel-h"><h3>ข้อมูลร้าน (แสดงบนใบเสร็จ)</h3></div>
      <div className="modal-b">
        <label className="f">ชื่อร้าน<input id="shop-name" required value={f.name} onChange={edit('name')} /></label>
        <label className="f">ที่อยู่<input id="shop-addr" value={f.address} onChange={edit('address')} /></label>
        <label className="f">เบอร์โทร<input id="shop-phone" inputMode="tel" value={f.phone} onChange={edit('phone')} /></label>
        <label className="f">พร้อมเพย์รับเงิน (เบอร์มือถือ หรือเลขประจำตัว 13 หลัก)<input id="shop-pp" inputMode="numeric" placeholder="เช่น 0812345678" value={f.promptPayId} onChange={edit('promptPayId')} /></label>
        <p className="note">ใส่แล้ว ตอนรับเงินแบบโอน ระบบจะสร้าง QR ที่มียอดเงินให้ลูกค้าสแกนจ่ายได้ทันที</p>
        {err && <p className="err">{err}</p>}
        <div className="row"><span className="note">{saved ? 'บันทึกแล้ว' : ''}</span><button className="btn primary">บันทึก</button></div>
      </div>
    </form>
  );
}

/** จัดการพนักงานต้องออนไลน์ (เป็นเรื่องความปลอดภัย ไม่ผ่าน outbox) */
function Staff() {
  const [users, setUsers] = useState<SessionUser[] | null>(null);
  const [f, setF] = useState({ name: '', username: '', password: '' });
  const [msg, setMsg] = useState('');
  const load = () => api.listUsers().then(setUsers).catch(() => setUsers(null));
  useEffect(() => void load(), []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createUser({ ...f, role: 'cashier' });
      setF({ name: '', username: '', password: '' });
      setMsg(`เพิ่มบัญชี ${f.username} แล้ว`);
      void load();
    } catch (err) {
      setMsg(err instanceof HttpError && err.code === 'username_taken' ? 'ชื่อผู้ใช้นี้มีอยู่แล้ว' : err instanceof HttpError ? 'ข้อมูลไม่ถูกต้อง: ชื่อผู้ใช้ a-z/0-9 3 ตัวขึ้นไป รหัสผ่าน 6 ตัวขึ้นไป' : 'ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อจัดการพนักงาน');
    }
  }
  return (
    <div className="panel">
      <div className="panel-h"><h3>พนักงาน</h3></div>
      <ul className="top">
        {users === null ? <li className="note">ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อดูรายชื่อ</li>
          : users.map((u) => <li key={u.id}><span>{u.name} <span className="note">@{u.username}</span></span><span className="pill sample">{u.role === 'owner' ? 'เจ้าของ' : 'แคชเชียร์'}</span></li>)}
      </ul>
      <form className="modal-b" onSubmit={submit} style={{ borderTop: '1px solid var(--line)' }}>
        <div className="form">
          <label className="f full">ชื่อพนักงาน<input id="st-name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="f">ชื่อผู้ใช้<input id="st-user" required autoCapitalize="none" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></label>
          <label className="f">รหัสผ่าน<input id="st-pass" type="password" required minLength={6} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        </div>
        <div className="row"><span className="note">{msg}</span><button className="btn primary">เพิ่มแคชเชียร์</button></div>
      </form>
    </div>
  );
}

/** จับคู่จอลูกค้า: แท็บเล็ตสแกน QR นี้ หรือเปิดหน้าต่างใหม่บนจอที่สอง */
function DisplayPairing({ local: localMode }: { local: boolean }) {
  const [code, setCode] = useState(getDisplayCode);
  const url = displayUrl(code);
  const local = /^(localhost|127\.)/.test(location.hostname);
  return (
    <div className="panel">
      <div className="panel-h"><h3>จอลูกค้า</h3><span className="note">ให้ลูกค้าเห็นรายการ ยอดเงิน และ QR พร้อมเพย์</span></div>
      <div className="modal-b">
        <div className="pair">
          <QrCode value={url} size={140} label="QR สำหรับเปิดจอลูกค้า" />
          <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="note">รหัสจับคู่ของเครื่องนี้</span>
            <span className="code">{code}</span>
            <span className="url">{url}</span>
          </div>
        </div>
        <ol className="note" style={{ margin: 0, paddingLeft: 18 }}>
          <li>แท็บเล็ต/มือถือที่หันหาลูกค้า: สแกน QR ด้านบน หรือพิมพ์ลิงก์</li>
          <li>จอที่สองบนคอมเครื่องนี้: กด “เปิดในหน้าต่างใหม่” แล้วลากไปจอที่สอง</li>
        </ol>
        {localMode && <p className="note">โหมดเก็บในเครื่อง: จอลูกค้าใช้ได้เฉพาะหน้าต่างที่สองบนเครื่องนี้ (กด “เปิดในหน้าต่างใหม่”) แท็บเล็ตเครื่องอื่นจะไม่เห็นรายการ</p>}
        {!localMode && local && <p className="err">ตอนนี้เปิดผ่าน localhost อุปกรณ์อื่นจะเข้าลิงก์นี้ไม่ได้ ให้เปิดแอปด้วย IP ของเครื่อง (เช่น http://192.168.1.10:5173) หรือใช้ตอนขึ้นเซิร์ฟเวอร์จริง</p>}
        <div className="row" style={{ justifyContent: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <a className="btn primary" href={url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>เปิดในหน้าต่างใหม่</a>
          <button className="btn ghost" onClick={() => { resetDisplayCode(); setCode(getDisplayCode()); }}>เปลี่ยนรหัสจับคู่</button>
        </div>
      </div>
    </div>
  );
}
