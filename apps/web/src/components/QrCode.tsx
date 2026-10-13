import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** QR เป็น SVG สีดำบนขาวเสมอ (แอปธนาคารสแกนได้ทั้งโหมดมืดและสว่าง) */
export function QrCode({ value, size = 240, label }: { value: string; size?: number; label: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toString(value, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(''));
    return () => {
      alive = false;
    };
  }, [value]);
  return <div className="qr" role="img" aria-label={label} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
