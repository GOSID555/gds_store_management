import { useEffect, useState, type FormEvent } from 'react';
import { isValidPromptPayId } from '@pos/shared';
import { QrCode } from '../../components/QrCode';
import { api, HttpError } from '../../lib/api';
import { displayUrl, getDisplayCode, payUrl, resetDisplayCode } from '../../lib/display';
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
        {isOwner && !s.local && s.user.username !== '__guest__' && <Staff />}
        {!s.local && s.user.username !== '__guest__' && <ChangePassword />}
        {errors.length > 0 && (
          <div className="panel">
            <div className="panel-h"><h3>รายการที่เซิร์ฟเวอร์ไม่รับ</h3></div>
            <ul className="toplist">{errors.slice(0, 10).map((e, i) => <li key={i}><span>{e.type}: {e.error}</span><span className="note">{new Date(e.at).toLocaleString('th-TH')}</span></li>)}</ul>
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
type StaffUser = SessionUser & { disabled: boolean };

function Staff() {
  const me = useSession()?.user.id;
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [f, setF] = useState({ name: '', username: '', password: '' });
  const [msg, setMsg] = useState('');
  /** แถวที่กำลังตั้งรหัสใหม่ */
  const [resetting, setResetting] = useState<{ id: string; password: string } | null>(null);
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

  async function update(u: StaffUser, b: { password?: string; disabled?: boolean }, done: string) {
    try {
      await api.updateUser(u.id, b);
      setMsg(done);
      setResetting(null);
      void load();
    } catch {
      setMsg('ทำรายการไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
    }
  }

  return (
    <div className="panel">
      <div className="panel-h"><h3>พนักงาน</h3><span className="note">ตั้งรหัสใหม่หรือปิดบัญชี = บัญชีนั้นถูกออกจากระบบทุกเครื่องทันที</span></div>
      <ul className="toplist">
        {users === null ? <li className="note">ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อดูรายชื่อ</li>
          : users.map((u) => (
            <li key={u.id} style={{ opacity: u.disabled ? 0.55 : 1 }}>
              <span>{u.name} <span className="note">@{u.username}</span>{' '}
                <span className={`pill ${u.disabled ? 'out' : 'sample'}`}>{u.disabled ? 'ปิดบัญชีแล้ว' : u.role === 'owner' ? 'เจ้าของ' : 'แคชเชียร์'}</span>
              </span>
              {u.id !== me && (
                <span className="acts">
                  {resetting?.id === u.id ? (
                    <form style={{ display: 'flex', gap: 6 }} onSubmit={(e) => { e.preventDefault(); void update(u, { password: resetting.password }, `ตั้งรหัสใหม่ให้ ${u.username} แล้ว`); }}>
                      <input id={`reset-${u.id}`} type="password" minLength={6} required autoFocus placeholder="รหัสใหม่ 6 ตัวขึ้นไป" autoComplete="new-password"
                        value={resetting.password} onChange={(e) => setResetting({ id: u.id, password: e.target.value })}
                        style={{ border: '1px solid var(--line)', borderRadius: 999, padding: '4px 12px', width: 160 }} />
                      <button className="btn sm primary">บันทึก</button>
                      <button type="button" className="btn sm ghost" onClick={() => setResetting(null)}>ยกเลิก</button>
                    </form>
                  ) : (
                    <>
                      {!u.disabled && <button className="btn sm" onClick={() => setResetting({ id: u.id, password: '' })}>ตั้งรหัสใหม่</button>}
                      <button className="btn sm ghost" style={{ color: u.disabled ? 'var(--accent)' : 'var(--danger)' }}
                        onClick={() => void update(u, { disabled: !u.disabled }, u.disabled ? `เปิดบัญชี ${u.username} แล้ว` : `ปิดบัญชี ${u.username} แล้ว`)}>
                        {u.disabled ? 'เปิดบัญชี' : 'ปิดบัญชี'}
                      </button>
                    </>
                  )}
                </span>
              )}
            </li>
          ))}
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

/** เปลี่ยนรหัสผ่านของตัวเอง — เครื่องอื่นที่ล็อกอินบัญชีนี้อยู่จะถูกออกจากระบบ */
function ChangePassword() {
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF({ ...f, [k]: e.target.value }); setMsg(null); };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (f.next !== f.confirm) return setMsg({ ok: false, text: 'รหัสใหม่สองช่องไม่ตรงกัน' });
    try {
      session.set(await api.changePassword(f.current, f.next));
      setF({ current: '', next: '', confirm: '' });
      setMsg({ ok: true, text: 'เปลี่ยนรหัสผ่านแล้ว เครื่องอื่นที่ใช้บัญชีนี้ต้องเข้าสู่ระบบใหม่' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof HttpError && err.status === 401 ? 'รหัสผ่านเดิมไม่ถูกต้อง' : err instanceof HttpError ? 'รหัสใหม่ต้องยาว 6 ตัวขึ้นไป' : 'ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อเปลี่ยนรหัสผ่าน' });
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <div className="panel-h"><h3>เปลี่ยนรหัสผ่านของฉัน</h3></div>
      <div className="modal-b">
        <div className="form">
          <label className="f full">รหัสผ่านเดิม<input id="pw-current" type="password" autoComplete="current-password" required value={f.current} onChange={set('current')} /></label>
          <label className="f">รหัสผ่านใหม่<input id="pw-next" type="password" autoComplete="new-password" minLength={6} required value={f.next} onChange={set('next')} /></label>
          <label className="f">ยืนยันรหัสใหม่<input id="pw-confirm" type="password" autoComplete="new-password" required value={f.confirm} onChange={set('confirm')} /></label>
        </div>
        <div className="row"><span className={msg?.ok ? 'note' : 'err'}>{msg?.text}</span><button className="btn primary">เปลี่ยนรหัส</button></div>
      </div>
    </form>
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
        <div className="pair" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <QrCode value={payUrl(code)} size={140} label="QR สำหรับเปิดหน้าสแกนจ่าย" />
          <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <b>หน้าสแกนจ่ายอย่างเดียว</b>
            <span className="note">QR พร้อมเพย์ตัวใหญ่ตามยอดบิลปัจจุบัน สร้างใหม่ทุกบิล เหมาะกับมือถือที่ตั้งไว้หน้าเคาน์เตอร์</span>
            <span className="url">{payUrl(code)}</span>
            <a className="btn sm" href={payUrl(code)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', alignSelf: 'flex-start' }}>เปิดหน้าสแกนจ่าย</a>
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
