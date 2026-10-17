/**
 * 验收脚本：检查每张 PNG 的尺寸、透明背景、安全边距、非透明像素占比
 * 解析 PNG：IHDR + 逐行反滤波，仅需检测 alpha 通道。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

function decodePng(buf) {
  let pos = 8; // skip signature
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  const bpp = channels * (bitDepth / 8);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 0xff;
    }
  }
  return { width, height, colorType, channels, bpp, pixels: out, stride };
}

const files = readdirSync(DIR).filter(f => f.endsWith('.png')).sort();
console.log('文件'.padEnd(13), '尺寸'.padEnd(11), '透明角', '非透明占比', '安全边距(左/上/右/下)');
console.log('-'.repeat(78));

let allOk = true;
for (const f of files) {
  const img = decodePng(readFileSync(join(DIR, f)));
  const { width: W, height: H, channels, pixels, stride } = img;
  const alphaAt = (x, y) => channels === 4 ? pixels[y * stride + x * 4 + 3]
    : channels === 2 ? pixels[y * stride + x * 2 + 1] : 255;

  let opaque = 0, minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (alphaAt(x, y) > 8) {
        opaque++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const corner = alphaAt(0, 0) === 0 && alphaAt(W - 1, 0) === 0 &&
                 alphaAt(0, H - 1) === 0 && alphaAt(W - 1, H - 1) === 0;
  const pct = (opaque / (W * H) * 100).toFixed(1) + '%';
  const margins = `${minX}/${minY}/${W - 1 - maxX}/${H - 1 - maxY}`;
  const sq = W === H && W >= 512;
  const ok = corner && sq && minX >= 8 && minY >= 8 && W - 1 - maxX >= 8 && H - 1 - maxY >= 8;
  if (!ok) allOk = false;
  console.log(f.padEnd(13), `${W}x${H}`.padEnd(11), (corner ? '是  ' : '否!!'),
    pct.padEnd(11), margins, ok ? '' : '  <-- 检查');
}
console.log('-'.repeat(78));
console.log(allOk ? '全部通过：正方形、>=512、四角透明、四周留白 >=8px' : '存在未通过项');
