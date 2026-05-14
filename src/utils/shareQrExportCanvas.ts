import UPNG from "upng-js";

const EXPORT_W = 1080;
const EXPORT_H = 1350;
const QR_MAX_WIDTH = 520;
const TOP_LOGO_AREA_RATIO = 0.3;

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i) & 0xff;
  return bytes.buffer;
}

function arrayBufferToBase64(ab: ArrayBuffer): string {
  const bytes = new Uint8Array(ab);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * Places a tight square QR PNG on a larger white canvas with top margin for logos / text.
 * Uses upng-js (no Node `stream` dependency) so Metro can bundle for React Native.
 */
export function embedQrPngInShareLetterhead(qrPngBase64: string): string {
  const qrAb = base64ToArrayBuffer(qrPngBase64);
  const img = UPNG.decode(qrAb);
  const rgbaFrame = UPNG.toRGBA8(img)[0];
  const rgba = new Uint8Array(rgbaFrame);
  const qw = img.width;
  const qh = img.height;

  const out = new Uint8Array(EXPORT_W * EXPORT_H * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = 255;
    out[i + 1] = 255;
    out[i + 2] = 255;
    out[i + 3] = 255;
  }

  const destW = Math.min(QR_MAX_WIDTH, EXPORT_W - 80);
  const destH = Math.round((qh * destW) / qw);
  const originX = Math.floor((EXPORT_W - destW) / 2);
  const originY = Math.round(EXPORT_H * TOP_LOGO_AREA_RATIO);

  for (let dy = 0; dy < destH; dy++) {
    for (let dx = 0; dx < destW; dx++) {
      const sx = Math.min(qw - 1, Math.floor(((dx + 0.5) * qw) / destW));
      const sy = Math.min(qh - 1, Math.floor(((dy + 0.5) * qh) / destH));
      const si = (qw * sy + sx) << 2;
      const ox = originX + dx;
      const oy = originY + dy;
      if (ox < 0 || ox >= EXPORT_W || oy < 0 || oy >= EXPORT_H) continue;
      const di = (EXPORT_W * oy + ox) << 2;
      out[di] = rgba[si];
      out[di + 1] = rgba[si + 1];
      out[di + 2] = rgba[si + 2];
      out[di + 3] = rgba[si + 3];
    }
  }

  const frameBuf = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
  const pngAb = UPNG.encode([frameBuf], EXPORT_W, EXPORT_H, 0);
  return arrayBufferToBase64(pngAb);
}
