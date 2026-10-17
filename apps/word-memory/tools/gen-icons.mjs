/**
 * 单词猫 — 图标生成
 *
 * 用 SVG 画出 App 图标（奶牛猫头像 + 绿色圆角底），
 * 再通过 @resvg/resvg-js 渲染成各尺寸 PNG。
 */

import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

/**
 * 猫头像 SVG
 * @param {number} size 画布尺寸
 * @param {boolean} rounded 是否画圆角底（maskable 需要满底）
 * @param {number} pad 主体内边距比例
 */
function buildSvg(size, { rounded = true, pad = 0.14, bg = true } = {}) {
  const S = size;
  const c = S / 2;
  const scale = S * (1 - pad * 2) / 100; // 以 100x100 坐标系设计主体
  const off = S * pad;

  // 背景
  const bgRect = bg
    ? rounded
      ? `<rect width="${S}" height="${S}" rx="${S * 0.225}" fill="url(#g)"/>`
      : `<rect width="${S}" height="${S}" fill="url(#g)"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4ade80"/>
      <stop offset="1" stop-color="#16a34a"/>
    </linearGradient>
    <clipPath id="round">
      <rect width="${S}" height="${S}" rx="${S * 0.225}"/>
    </clipPath>
  </defs>
  ${bgRect}
  <g transform="translate(${off} ${off}) scale(${scale})" clip-path="${rounded && bg ? 'url(#round)' : 'none'}">
    <clipPath id="inner">
      <rect x="${pad * 100}" y="${pad * 100}" width="${100 - pad * 200}" height="${100 - pad * 200}" rx="${(100 - pad * 200) * 0.225}"/>
    </clipPath>
    <!-- 猫主体：放在 100x100 坐标系里 -->
    <g stroke="#2b3038" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round">
    <!-- 右耳：白底黑边 -->
    <path d="M78 48 L98 8 L56 30 Z" fill="#ffffff"/>
    <path d="M78 41 L91 18 L65 30 Z" fill="#f9a8c4" stroke="none"/>
    <!-- 头 -->
    <ellipse cx="50" cy="63" rx="30" ry="26" fill="#ffffff"/>
    <!-- 额头黑斑（头顶偏右，不压到任何一只耳朵） -->
    <path d="M44 42 q4 -5 9 -5 q7 0 12 5 q-7 4 -12 4 q-5 0 -9 -4 Z" fill="#2b3038" stroke="none"/>
    <!-- 左耳（画在头与黑斑之后，确保完整可见） -->
    <path d="M30 48 L2 6 L47 32 Z" fill="#ffffff"/>
    <path d="M28 42 L10 17 L37 32 Z" fill="#f9a8c4" stroke="none"/>
    <path d="M30 48 L2 6 L18 16 Z" fill="#2b3038" stroke="none"/>
    <!-- 右脸黑斑 -->
    <path d="M79 58 q3 11 -6 20 q10 -6 9 -18 Z" fill="#2b3038" stroke="none"/>
    <!-- 眼睛 -->
    <ellipse cx="38" cy="55" rx="7.5" ry="8.5" fill="#2b3038"/>
    <ellipse cx="62" cy="55" rx="7.5" ry="8.5" fill="#2b3038"/>
    <circle cx="35.5" cy="52" r="2.9" fill="#ffffff" stroke="none"/>
    <circle cx="59.5" cy="52" r="2.9" fill="#ffffff" stroke="none"/>
    <circle cx="40" cy="58.5" r="1.4" fill="#ffffff" stroke="none"/>
    <circle cx="64" cy="58.5" r="1.4" fill="#ffffff" stroke="none"/>
    <!-- 腮红 -->
    <ellipse cx="27" cy="65" rx="5" ry="3.4" fill="#fbb6ce" stroke="none" opacity="0.95"/>
    <ellipse cx="73" cy="65" rx="5" ry="3.4" fill="#fbb6ce" stroke="none" opacity="0.95"/>
    <!-- 鼻子 -->
    <ellipse cx="50" cy="67" rx="3.4" ry="2.6" fill="#f472b6" stroke="none"/>
    <!-- 嘴 -->
    <path d="M50 69.5 q-3.5 4 -6.5 1 M50 69.5 q3.5 4 6.5 1" fill="none" stroke-width="2"/>
    <!-- 胡须 -->
    <path d="M22 61 L9 58 M22 66 L9 67 M78 61 L91 58 M78 66 L91 67" fill="none" stroke-width="1.8"/>
    <!-- 下巴/身体 -->
    <path d="M32 81 q18 12 36 0 q-2 10 -18 10 q-16 0 -18 -10 Z" fill="#ffffff"/>
  </g>
  </g>
</svg>`;
}

const targets = [
  { file: 'icon-512.png', size: 512, opts: { rounded: true, pad: 0.16 } },
  { file: 'icon-192.png', size: 192, opts: { rounded: true, pad: 0.16 } },
  { file: 'apple-touch-icon.png', size: 180, opts: { rounded: false, pad: 0.17 } },
  // maskable：需要满底 + 更大安全边距
  { file: 'icon-maskable-512.png', size: 512, opts: { rounded: false, pad: 0.22 } },
  { file: 'icon-1024.png', size: 1024, opts: { rounded: true, pad: 0.16 } },
];

for (const t of targets) {
  const svg = buildSvg(t.size, t.opts);
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: t.size },
    background: 'rgba(0,0,0,0)',
  });
  const png = r.render().asPng();
  writeFileSync(join(OUT, t.file), png);
  console.log(`✓ ${t.file}  ${t.size}x${t.size}  ${png.length} bytes`);
}

// 启动画面（简单的品牌页）
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1170" height="2532" viewBox="0 0 1170 2532">
  <rect width="1170" height="2532" fill="#eefbf3"/>
  <g transform="translate(285 1000)">
    ${buildSvg(600)
      .replace(/^<svg[^>]*>/, '')
      .replace(/<\/svg>$/, '')}
  </g>
  <text x="585" y="1700" font-family="PingFang SC, sans-serif" font-size="64" font-weight="700"
        fill="#16a34a" text-anchor="middle">单词猫</text>
</svg>`;

try {
  const r = new Resvg(splashSvg, { fitTo: { mode: 'width', value: 1170 } });
  const png = r.render().asPng();
  writeFileSync(join(OUT, 'splash.png'), png);
  console.log(`✓ splash.png  1170x2532  ${png.length} bytes`);
} catch (e) {
  console.warn('启动图生成跳过：', e.message);
}

console.log('\n图标已生成到', OUT);
