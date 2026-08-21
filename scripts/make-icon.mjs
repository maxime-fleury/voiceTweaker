import { deflateSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.join(process.cwd(), 'renderer');

const C1 = [108, 140, 255];
const C2 = [154, 108, 255];
const BG_TOP = [18, 23, 36];
const BG_BOT = [10, 13, 20];

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

function segDist(px, py, x, y0, y1) {
  const dy = py < y0 ? y0 - py : py > y1 ? py - y1 : 0;
  return Math.hypot(px - x, dy);
}

function drawIcon(S, K = 4) {
  const W = S * K;
  const buf = Buffer.alloc(W * W * 4);
  const rad = S * 0.24;
  const inner = S / 2 - rad;

  const barHeights = [0.3, 0.52, 0.74, 0.46, 0.34];
  const n = barHeights.length;
  const barW = S * 0.105;
  const gap = S * 0.055;
  const totalW = n * barW + (n - 1) * gap;
  const startX = S / 2 - totalW / 2 + barW / 2;
  const capR = barW / 2;

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const fx = (x + 0.5) / K;
      const fy = (y + 0.5) / K;

      const qx = Math.max(Math.abs(fx - S / 2) - inner, 0);
      const qy = Math.max(Math.abs(fy - S / 2) - inner, 0);
      const dCorner = Math.hypot(qx, qy) - rad;
      const aBg = smooth(0.75, -0.25, dCorner);

      const bt = fy / S;
      let r = mix(BG_TOP[0], BG_BOT[0], bt);
      let g = mix(BG_TOP[1], BG_BOT[1], bt);
      let b = mix(BG_TOP[2], BG_BOT[2], bt);

      let aBar = 0;
      for (let i = 0; i < n; i++) {
        const bx = startX + i * (barW + gap);
        const halfH = (barHeights[i] * S) / 2;
        const d = segDist(fx, fy, bx, S / 2 - halfH + capR, S / 2 + halfH - capR) - capR;
        aBar = Math.max(aBar, smooth(0.6, -0.2, d));
      }

      const ct = fx / S;
      const br = mix(C1[0], C2[0], ct);
      const bg_ = mix(C1[1], C2[1], ct);
      const bb = mix(C1[2], C2[2], ct);

      r = mix(r, br, aBar);
      g = mix(g, bg_, aBar);
      b = mix(b, bb, aBar);

      const alpha = Math.max(aBg * 255, aBar * 255);
      const idx = (y * W + x) * 4;
      buf[idx] = r | 0;
      buf[idx + 1] = g | 0;
      buf[idx + 2] = b | 0;
      buf[idx + 3] = alpha | 0;
    }
  }

  const out = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let ky = 0; ky < K; ky++) {
        for (let kx = 0; kx < K; kx++) {
          const idx = ((y * K + ky) * W + x * K + kx) * 4;
          const pa = buf[idx + 3] / 255;
          r += buf[idx] * pa;
          g += buf[idx + 1] * pa;
          b += buf[idx + 2] * pa;
          a += pa;
        }
      }
      const o = (y * S + x) * 4;
      if (a > 0) {
        out[o] = (r / a) | 0;
        out[o + 1] = (g / a) | 0;
        out[o + 2] = (b / a) | 0;
      }
      out[o + 3] = (a / (K * K)) * 255 | 0;
    }
  }
  return out;
}

function buildIco(pngs) {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  const entries = [];
  let offset = 6 + count * 16;
  const dir = Buffer.alloc(count * 16);
  pngs.forEach((p, i) => {
    const e = dir.subarray(i * 16, i * 16 + 16);
    e[0] = p.size % 256;
    e[1] = p.size % 256;
    e[4] = 1;
    e[6] = 32;
    e.writeUInt32LE(p.data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += p.data.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

const sizes = [16, 32, 48, 64, 128, 256];
const rendered = sizes.map((s) => ({ size: s, data: encodePNG(s, s, drawIcon(s)) }));

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'favicon.ico'), buildIco(rendered.filter((p) => [16, 32, 48, 256].includes(p.size))));
fs.writeFileSync(path.join(OUT_DIR, 'icon.png'), rendered.find((p) => p.size === 256).data);
console.log('Icons written:', fs.readdirSync(OUT_DIR).filter((f) => f.startsWith('icon') || f.startsWith('favicon')));
