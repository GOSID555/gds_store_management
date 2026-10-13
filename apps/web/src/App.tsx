import { useEffect } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { SyncBadge } from './components/SyncBadge';
import { LoginPage } from './features/auth/LoginPage';
import { CustomerDisplayPage } from './features/display/CustomerDisplayPage';
import { InventoryPage } from './features/inventory/InventoryPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { SellPage } from './features/sell/SellPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { useSettings } from './lib/hooks';
import { useSession } from './lib/session';
import { startSync } from './lib/sync/engine';

export function App() {
  const s = useSession();
  const isDisplay = location.pathname.startsWith('/display');
  useEffect(() => {
    if (s && !isDisplay) startSync();
  }, [s, isDisplay]);
  // จอลูกค้าไม่ต้องเข้าสู่ระบบ และไม่ซิงก์ข้อมูลร้าน
  if (isDisplay) return <CustomerDisplayPage />;
  if (!s) return <LoginPage />;

  const isOwner = s.user.role === 'owner';
  return (
    <div className="app">
      <Header isOwner={isOwner} />
      <main>
        <Routes>
          <Route path="/" element={<SellPage />} />
          <Route path="/stock" element={<InventoryPage canEdit={isOwner} />} />
          {isOwner && <Route path="/reports" element={<ReportsPage />} />}
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Header({ isOwner }: { isOwner: boolean }) {
  const shop = useSettings();
  const name = shop?.name || 'ร้านของฉัน';
  return (
    <header className="top">
      <div className="brand">
        <div className="logo">{name.trim().charAt(0)}</div>
        <div style={{ minWidth: 0 }}>
          <h1>{name}</h1>
          <small>{new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</small>
        </div>
      </div>
      <SyncBadge />
      <nav className="tabs">
        <NavLink to="/" end>ขายสินค้า</NavLink>
        <NavLink to="/stock">สต็อก</NavLink>
        {isOwner && <NavLink to="/reports">ยอดขาย</NavLink>}
      </nav>
      <NavLink className="iconbtn" to="/settings" style={{ textDecoration: 'none' }}>ตั้งค่า</NavLink>
    </header>
  );
}
