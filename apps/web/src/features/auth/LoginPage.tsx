import { useState, type FormEvent } from 'react';
import { api, HttpError } from '../../lib/api';
import { session } from '../../lib/session';

export function LoginPage() {
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
        <div className="brand"><div className="logo">P</div><h1>หน้าร้าน POS</h1></div>
        <p className="note">เข้าสู่ระบบครั้งแรกต้องมีอินเทอร์เน็ต หลังจากนั้นขายได้แม้ออฟไลน์</p>
        <label className="f">ชื่อผู้ใช้<input id="username" autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus /></label>
        <label className="f">รหัสผ่าน<input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="err">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button>
      </form>
    </div>
  );
}
