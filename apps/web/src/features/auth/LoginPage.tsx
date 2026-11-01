import { useEffect, useState, type FormEvent } from 'react';
import { api, HttpError } from '../../lib/api';
import { session, startLocalSession } from '../../lib/session';

type Stage = 'checking' | 'setup' | 'login' | 'offline';

/**
 * หน้าเข้าใช้งาน
 * 1. ถามเซิร์ฟเวอร์ก่อน (/auth/status)
 *    - ไม่บังคับล็อกอิน → เข้าเลยด้วยบัญชีกลาง
 *    - ร้านยังไม่มีบัญชี → ฟอร์มตั้งบัญชีเจ้าของร้าน (ครั้งเดียว)
 *    - ปกติ → ฟอร์มล็อกอิน
 * 2. ไม่มีเซิร์ฟเวอร์/ยังไม่ต่อฐานข้อมูล → โหมดเก็บในเครื่อง
 * 3. ติดต่อเซิร์ฟเวอร์ไม่ได้ (เน็ตหลุด) → ให้ลองใหม่
 */
export function LoginPage() {
  const [stage, setStage] = useState<Stage>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setStage('checking');
    api
      .status()
      .then(async (st) => {
        if (!alive) return;
        if (!st.requireLogin) return session.set(await api.guest());
        setStage(st.needsSetup ? 'setup' : 'login');
      })
      .catch((e) => {
        if (!alive) return;
        const noBackend = e instanceof SyntaxError || (e instanceof HttpError && (e.status === 404 || e.status === 405 || e.code === 'server_not_configured'));
        if (noBackend) startLocalSession();
        else setStage('offline');
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (stage === 'checking') return <div className="login"><p className="note">กำลังเปิดร้าน…</p></div>;
  if (stage === 'offline')
    return (
      <div className="login">
        <form onSubmit={(e) => { e.preventDefault(); setAttempt((n) => n + 1); }}>
          <Brand />
          <p className="err">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่</p>
          <p className="note">เข้าสู่ระบบครั้งแรกต้องมีอินเทอร์เน็ต หลังจากนั้นขายได้แม้ออฟไลน์</p>
          <button className="btn primary">ลองใหม่</button>
        </form>
      </div>
    );
  return stage === 'setup' ? <SetupForm onTaken={() => setStage('login')} /> : <LoginForm />;
}

function Brand() {
  return <div className="brand"><div className="logo">P</div><h1>หน้าร้าน POS</h1></div>;
}

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      session.set(await api.login(username, password));
    } catch (err) {
      setError(err instanceof HttpError && err.status === 401 ? 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form onSubmit={submit}>
        <Brand />
        <p className="note">เข้าสู่ระบบด้วยบัญชีของร้าน</p>
        <label className="f">ชื่อผู้ใช้<input id="username" autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus /></label>
        <label className="f">รหัสผ่าน<input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="err">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button>
        <p className="note">พนักงานลืมรหัสผ่าน: ให้เจ้าของร้านตั้งรหัสใหม่ให้ที่ ตั้งค่า → พนักงาน</p>
      </form>
    </div>
  );
}

/** ตั้งบัญชีเจ้าของร้านครั้งแรก — ใช้ได้ครั้งเดียว */
function SetupForm({ onTaken }: { onTaken: () => void }) {
  const [f, setF] = useState({ name: '', username: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (f.password !== f.confirm) return setError('รหัสผ่านสองช่องไม่ตรงกัน');
    setBusy(true);
    setError('');
    try {
      session.set(await api.setup({ name: f.name.trim() || 'เจ้าของร้าน', username: f.username, password: f.password }));
    } catch (err) {
      if (err instanceof HttpError && err.status === 409) return onTaken();
      setError(err instanceof HttpError ? 'ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 _ . - (3 ตัวขึ้นไป) และรหัสผ่าน 6 ตัวขึ้นไป' : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form onSubmit={submit}>
        <Brand />
        <p style={{ margin: 0, fontWeight: 600 }}>ตั้งบัญชีเจ้าของร้าน</p>
        <p className="note">ร้านนี้ยังไม่มีบัญชี บัญชีแรกจะเป็นเจ้าของร้าน (ทำได้ครั้งเดียว) หลังจากนี้ทุกคนต้องเข้าสู่ระบบ</p>
        <label className="f">ชื่อที่แสดง<input id="setup-name" placeholder="เช่น พี่ก้อง" value={f.name} onChange={set('name')} autoFocus /></label>
        <label className="f">ชื่อผู้ใช้<input id="setup-user" autoComplete="username" autoCapitalize="none" placeholder="a-z, 0-9" value={f.username} onChange={set('username')} required /></label>
        <label className="f">รหัสผ่าน (6 ตัวขึ้นไป)<input id="setup-pass" type="password" autoComplete="new-password" minLength={6} value={f.password} onChange={set('password')} required /></label>
        <label className="f">ยืนยันรหัสผ่าน<input id="setup-confirm" type="password" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} required /></label>
        {error && <p className="err">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'กำลังสร้างบัญชี…' : 'สร้างบัญชีและเข้าร้าน'}</button>
      </form>
    </div>
  );
}
