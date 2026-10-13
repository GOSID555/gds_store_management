import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './styles.css';

// ขอให้เบราว์เซอร์ไม่ลบ IndexedDB อัตโนมัติ (สำคัญสำหรับบิลที่ยังไม่ได้ซิงก์)
void navigator.storage?.persist?.();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
