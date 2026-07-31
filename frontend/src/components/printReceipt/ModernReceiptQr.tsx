import { create } from 'qrcode';

/**
 * Renders the QR pattern as static SVG rects (via QRCode.create, which is
 * synchronous — no useEffect/promise race against the print snapshot).
 */
export function ModernReceiptQr({ value }: { value?: string | null }) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  let modules;
  try {
    modules = create(trimmed, { errorCorrectionLevel: 'M' }).modules;
  } catch {
    return null;
  }

  const size = modules.size;
  const cell = 4; // px per module
  const pixels = size * cell;

  const rects: string[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (modules.get(row, col)) {
        rects.push(`<rect x="${col * cell}" y="${row * cell}" width="${cell}" height="${cell}" />`);
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pixels} ${pixels}" width="${pixels}" height="${pixels}" fill="#111827">${rects.join('')}</svg>`;

  return (
    <div className="text-center mt-3 pt-3 border-t border-dashed border-gray-400">
      <p className="text-[12px] font-semibold text-gray-700 mb-2">Scan to Pay</p>
      <div className="inline-block" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
