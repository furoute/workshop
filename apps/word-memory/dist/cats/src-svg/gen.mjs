/**
 * 单词猫素材生成器 v2 —— 程序化 SVG 绘制 + resvg 渲染为透明 PNG
 *
 * v2 相对 v1 的结构性修正：
 *  1. 耳朵移到头部轮廓之外、更尖更小（v1 被头吃掉，像熊猫）
 *  2. 黑色斑块画在身体可见区域（v1 被头/身体盖住，看不出奶牛花）
 *  3. 尾巴移到底部身后（v1 绕到头右侧，非常突兀）
 *  4. 删除眼睛上方的弧线（v1 看起来像苦相八字眉）
 *  5. stage3 前腿改为自然短腿（v1 是两根柱子）
 *
 * 统一特征：白身 + 左耳黑 + 背/臀黑斑 + 粉鼻 + 大眼高光 + 腮红
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadResvg() {
  const candidates = [
    join(__dirname, 'node_modules/@resvg/resvg-js/index.js'),
    join(__dirname, '../../../node_modules/@resvg/resvg-js/index.js'),
    'D:/LLM/DSH/work/_catgen/node_modules/@resvg/resvg-js/index.js',
  ];
  for (const c of candidates) {
    if (existsSync(c)) return (await import(pathToFileURL(c).href)).Resvg;
  }
  throw new Error('找不到 @resvg/resvg-js');
}
const Resvg = await loadResvg();

const OUT_SVG = __dirname;
const OUT_PNG = join(__dirname, '..');

const SS = 2;
const SIZE = 512;

// ---------- 调色板 ----------
const INK      = '#3A3A44';
const FUR      = '#FFFFFF';
const NOSE     = '#FF8FA8';
const BLUSH    = '#FFC2CE';
const EYE      = '#2E2E38';
const SHINE    = '#FFFFFF';
const INNER_EAR= '#FFB6C4';
const CROWN    = '#FFCE3D';
const CROWN_D  = '#E8A800';
const CAPE     = '#5AB0EC';
const CAPE_D   = '#2E86C8';
const COLLAR   = '#FF6B8A';
const BELL     = '#FFCE3D';
const BOWL     = '#6EC6F2';
const BOWL_D   = '#3E9FD8';
const FOODP    = '#C98A4B';
const FISHBODY = '#FFB454';
const FISHFIN  = '#F0913A';
const SOAP     = '#8FD9F0';
const BUBBLE   = '#CFEFFB';
const HEART    = '#FF6B8A';
const HEART_D  = '#E8455F';
const SHADOW   = 'rgba(58,58,68,0.11)';

const S = 10; // 标准描边

const st = (w = S, color = INK) =>
  `stroke="${color}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const circ = (cx, cy, r, fill, w = S, sc = INK) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${st(w, sc)}/>`;
const ell = (cx, cy, rx, ry, fill, w = S, sc = INK, rot = null) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${st(w, sc)}${rot !== null ? ` transform="rotate(${rot} ${cx} ${cy})"` : ''}/>`;
const seg = (x1, y1, x2, y2, color = INK, w = S) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
const blot = (d) => `<path d="${d}" fill="${INK}" stroke="none"/>`;
const blush = (cx, cy, rx, ry) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${BLUSH}" opacity="0.8"/>`;

/** 大眼睛：瞳孔 + 上大高光 + 下小高光 */
function eye(cx, cy, rx, ry) {
  return `
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${EYE}"/>
    <ellipse cx="${cx - rx * 0.32}" cy="${cy - ry * 0.40}" rx="${rx * 0.36}" ry="${ry * 0.30}" fill="${SHINE}"/>
    <ellipse cx="${cx + rx * 0.36}" cy="${cy + ry * 0.42}" rx="${rx * 0.17}" ry="${ry * 0.14}" fill="${SHINE}" opacity="0.8"/>`;
}

/** 粉三角鼻 + 微笑嘴 */
function muzzle(nx, ny, s = 1) {
  const w = 14 * s, h = 10 * s;
  return `
    <path d="M ${nx - w} ${ny - h * 0.3} Q ${nx} ${ny - h * 1.2} ${nx + w} ${ny - h * 0.3} Q ${nx} ${ny + h} ${nx - w} ${ny - h * 0.3} Z"
      fill="${NOSE}" stroke="${INK}" stroke-width="${6 * s}" stroke-linejoin="round"/>
    <path d="M ${nx} ${ny + h * 0.95} L ${nx} ${ny + h * 1.6}" fill="none" ${st(4.5 * s)}/>
    <path d="M ${nx - 15 * s} ${ny + h * 1.25} Q ${nx - 7.5 * s} ${ny + h * 2.6} ${nx} ${ny + h * 1.6}"
      fill="none" ${st(4.5 * s)}/>
    <path d="M ${nx + 15 * s} ${ny + h * 1.25} Q ${nx + 7.5 * s} ${ny + h * 2.6} ${nx} ${ny + h * 1.6}"
      fill="none" ${st(4.5 * s)}/>`;
}

/** 胡须（左右各三根，带轻微弯曲） */
function whiskers(cx, cy, scale = 1, flip = 1) {
  const w = 4.5 * scale;
  return [-9, 1, 11].map((dy, i) =>
    `<path d="M ${cx} ${cy + dy * scale} Q ${cx + 24 * scale * flip} ${cy + (dy - 5 + i * 2) * scale} ${cx + 44 * scale * flip} ${cy + (dy * 2.1 - 14 + i * 6) * scale}"
      fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" opacity="0.8"/>`).join('');
}

/** 卷尾巴：白底 + 描边 */
function tail(d, w = 24) {
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + S * 1.9}" stroke-linecap="round"/>
          <path d="${d}" fill="none" stroke="${FUR}" stroke-width="${w}" stroke-linecap="round"/>`;
}

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
${body}
</svg>`;

/**
 * 猫头：耳朵在轮廓之外，确保"猫感"
 * cx,cy 头中心；rx,ry 头半径
 * 左耳黑斑、右耳白色粉内
 */
function catHead(cx, cy, rx, ry, earScale = 1, leftEarBlack = true) {
  const ex = rx * 0.60 * earScale;   // 耳中心横向偏移
  const ey = cy - ry * 0.86;         // 耳根高度
  const ew = 44 * earScale;          // 耳半宽
  const eh = 70 * earScale;          // 耳高

  const leftEar = `
    <path d="M ${cx - ex - ew} ${ey + 14} Q ${cx - ex - ew * 0.75} ${ey - eh} ${cx - ex + ew * 0.15} ${ey - eh * 0.86}
             Q ${cx - ex + ew * 0.9} ${ey - eh * 0.4} ${cx - ex + ew} ${ey + 20} Z"
      fill="${leftEarBlack ? INK : FUR}" ${st()}/>`;
  const rightEar = `
    <path d="M ${cx + ex + ew} ${ey + 14} Q ${cx + ex + ew * 0.75} ${ey - eh} ${cx + ex - ew * 0.15} ${ey - eh * 0.86}
             Q ${cx + ex - ew * 0.9} ${ey - eh * 0.4} ${cx + ex - ew} ${ey + 20} Z"
      fill="${FUR}" ${st()}/>`;
  // 右耳内粉色（仅在左耳为黑、右耳为白时绘制，保证"一边黑一边白"的奶牛特征）
  const rightInnerPath = leftEarBlack ? `
    <path d="M ${cx + ex + ew * 0.60} ${ey + 10} Q ${cx + ex + ew * 0.48} ${ey - eh * 0.58} ${cx + ex - ew * 0.05} ${ey - eh * 0.48}
             Q ${cx + ex - ew * 0.50} ${ey - eh * 0.18} ${cx + ex - ew * 0.58} ${ey + 14} Z"
      fill="${INNER_EAR}" stroke="none"/>` : '';
  return leftEar + rightEar + rightInnerPath;
}

// ============================================================
//  stage1 —— 幼猫团子：蜷成一团睡觉
// ============================================================
function stage1() {
  return svg(`
  <ellipse cx="256" cy="428" rx="122" ry="19" fill="${SHADOW}"/>
  <!-- 尾巴：贴着地面从身后绕出 -->
  ${tail('M 348 398 Q 428 404 432 380 Q 434 362 416 358', 22)}

  <!-- 耳朵（先画，位于团子轮廓内） -->
  ${catHead(256, 330, 126, 102, 0.98, true)}

  <!-- 团子身体：单一外轮廓，头与身体融为一体 -->
  <ellipse cx="256" cy="330" rx="126" ry="102" fill="${FUR}" ${st()}/>
  <!-- 臀背黑斑（奶牛花色，位于团子右侧） -->
  ${blot('M 312 258 Q 372 272 376 330 Q 378 384 336 392 Q 306 388 304 358 Q 330 344 320 300 Q 314 268 312 258 Z')}

  <!-- 头顶黑斑（偏右，不规则奶牛斑） -->
  ${blot('M 272 232 Q 306 230 320 252 Q 312 268 284 266 Q 262 264 256 248 Q 258 234 272 232 Z')}

  <!-- 闭眼（睡） -->
  <path d="M 198 328 Q 216 350 236 328" fill="none" ${st(8.5)}/>
  <path d="M 276 328 Q 294 350 314 328" fill="none" ${st(8.5)}/>
  ${blush(186, 356, 20, 12)}
  ${blush(326, 356, 20, 12)}
  <!-- 鼻嘴 -->
  <path d="M 244 356 Q 256 346 268 356 Q 256 370 244 356 Z" fill="${NOSE}" stroke="${INK}" stroke-width="5.5" stroke-linejoin="round"/>
  <path d="M 256 369 Q 256 379 245 381 M 256 379 Q 267 381 267 372" fill="none" ${st(4.5)}/>
  ${whiskers(176, 354, 0.92, -1)}
  ${whiskers(336, 354, 0.92, 1)}

  <!-- 蜷在身前的小爪（并拢，圆润） -->
  <ellipse cx="234" cy="402" rx="45" ry="26" fill="${FUR}" ${st()}/>
  <ellipse cx="296" cy="404" rx="42" ry="25" fill="${FUR}" ${st()}/>
  ${seg(232, 391, 232, 412, 'rgba(58,58,68,0.40)', 4)}
  ${seg(296, 393, 296, 414, 'rgba(58,58,68,0.40)', 4)}
  <!-- 睡觉 Z 泡泡 -->
  <circle cx="372" cy="204" r="12" fill="${FUR}" ${st(6)}/>
  <circle cx="398" cy="172" r="8" fill="${FUR}" ${st(5)}/>
  <circle cx="416" cy="148" r="5" fill="${FUR}" ${st(4.5)}/>
  `);
}

// ============================================================
//  stage2 —— 小奶猫：坐着，大眼睛好奇看前方
// ============================================================
function stage2() {
  return svg(`
  <ellipse cx="256" cy="440" rx="118" ry="19" fill="${SHADOW}"/>
  ${tail('M 350 408 Q 428 414 432 388 Q 434 370 416 366', 24)}

  <!-- 坐姿身体 -->
  <path d="M 256 262 Q 362 268 372 356 Q 378 424 256 430 Q 134 424 140 356 Q 150 268 256 262 Z"
    fill="${FUR}" ${st()}/>
  <!-- 身体黑斑（奶牛花，画在头之下方可见区） -->
  ${blot('M 316 292 Q 374 306 370 356 Q 366 398 328 404 Q 302 400 300 372 Q 322 360 314 322 Q 308 300 316 292 Z')}
  <!-- 前爪 -->
  <ellipse cx="206" cy="408" rx="36" ry="25" fill="${FUR}" ${st()}/>
  <ellipse cx="306" cy="408" rx="36" ry="25" fill="${FUR}" ${st()}/>
  ${seg(206, 396, 206, 418, 'rgba(58,58,68,0.40)', 4)}
  ${seg(306, 396, 306, 418, 'rgba(58,58,68,0.40)', 4)}

  <!-- 耳朵（轮廓外） -->
  ${catHead(256, 236, 118, 102, 0.95, true)}

  <!-- 头 -->
  <ellipse cx="256" cy="236" rx="118" ry="102" fill="${FUR}" ${st()}/>
  <!-- 头顶黑斑（偏右侧的不规则奶牛斑，避免像眉毛） -->
  ${blot('M 268 126 Q 306 124 322 146 Q 314 162 286 160 Q 262 158 256 142 Q 258 128 268 126 Z')}

  <!-- 大眼睛 -->
  ${eye(208, 258, 31, 37)}
  ${eye(306, 258, 31, 37)}
  ${blush(162, 302, 23, 14)}
  ${blush(350, 302, 23, 14)}
  ${muzzle(257, 308, 1.08)}
  ${whiskers(142, 300, 1, -1)}
  ${whiskers(370, 300, 1, 1)}

  <!-- 头顶小花（可爱点缀） -->
  <g transform="translate(378 178)">
    <circle cx="0" cy="-15" r="13" fill="${NOSE}" ${st(7)}/>
    <circle cx="-17" cy="2" r="13" fill="${NOSE}" ${st(7)}/>
    <circle cx="17" cy="2" r="13" fill="${NOSE}" ${st(7)}/>
    <circle cx="0" cy="10" r="13" fill="${NOSE}" ${st(7)}/>
    <circle cx="0" cy="0" r="8" fill="${CROWN}" stroke="none"/>
  </g>
  `);
}

// ============================================================
//  stage3 —— 少年猫：站立，精神，微微抬头
// ============================================================
function stage3() {
  return svg(`
  <ellipse cx="256" cy="462" rx="112" ry="17" fill="${SHADOW}"/>
  <!-- 竖起的尾巴（精神，末端低于头顶） -->
  ${tail('M 340 408 Q 416 400 414 344 Q 412 314 392 312', 24)}

  <!-- 后腿 -->
  <ellipse cx="196" cy="428" rx="40" ry="31" fill="${FUR}" ${st()}/>
  <ellipse cx="318" cy="428" rx="40" ry="31" fill="${FUR}" ${st()}/>
  <!-- 站立身体 -->
  <path d="M 256 268 Q 348 274 352 360 Q 354 420 256 424 Q 158 420 160 360 Q 164 274 256 268 Z"
    fill="${FUR}" ${st()}/>
  <!-- 身体黑斑 -->
  ${blot('M 310 300 Q 360 314 356 360 Q 352 398 318 402 Q 296 398 296 370 Q 316 356 306 324 Q 300 306 310 300 Z')}
  <!-- 胸口白毛 -->
  <path d="M 230 336 Q 256 324 282 336 Q 268 378 256 384 Q 244 378 230 336 Z"
    fill="${FUR}" stroke="rgba(58,58,68,0.30)" stroke-width="3"/>

  <!-- 前腿（短而自然，非柱子） -->
  <path d="M 226 386 Q 224 434 226 448" fill="none" stroke="${INK}" stroke-width="${24 + S * 1.9}" stroke-linecap="round"/>
  <path d="M 226 386 Q 224 434 226 448" fill="none" stroke="${FUR}" stroke-width="24" stroke-linecap="round"/>
  <path d="M 288 386 Q 290 434 288 448" fill="none" stroke="${INK}" stroke-width="${24 + S * 1.9}" stroke-linecap="round"/>
  <path d="M 288 386 Q 290 434 288 448" fill="none" stroke="${FUR}" stroke-width="24" stroke-linecap="round"/>
  <ellipse cx="226" cy="450" rx="30" ry="17" fill="${FUR}" ${st()}/>
  <ellipse cx="288" cy="450" rx="30" ry="17" fill="${FUR}" ${st()}/>
  ${seg(226, 443, 226, 458, 'rgba(58,58,68,0.40)', 4)}
  ${seg(288, 443, 288, 458, 'rgba(58,58,68,0.40)', 4)}

  <!-- 耳朵（轮廓外） -->
  ${catHead(256, 232, 116, 100, 0.95, true)}

  <!-- 头 -->
  <ellipse cx="256" cy="232" rx="116" ry="100" fill="${FUR}" ${st()}/>
  ${blot('M 240 138 Q 288 132 308 156 Q 280 166 242 160 Q 228 150 240 138 Z')}

  ${eye(208, 252, 30, 36)}
  ${eye(306, 252, 30, 36)}
  ${blush(164, 296, 22, 13)}
  ${blush(348, 296, 22, 13)}
  ${muzzle(257, 302, 1.05)}
  ${whiskers(144, 294, 0.98, -1)}
  ${whiskers(368, 294, 0.98, 1)}
  `);
}

// ============================================================
//  stage4 —— 成年猫：坐姿端正 + 细项圈
// ============================================================
function stage4() {
  return svg(`
  <ellipse cx="256" cy="446" rx="126" ry="19" fill="${SHADOW}"/>
  ${tail('M 366 424 Q 436 430 440 404 Q 442 386 424 382', 24)}

  <!-- 端正坐姿身体 -->
  <path d="M 256 262 Q 378 268 386 366 Q 390 430 256 436 Q 122 430 126 366 Q 134 268 256 262 Z"
    fill="${FUR}" ${st()}/>
  <!-- 身体黑斑（成年猫更成熟的大斑） -->
  ${blot('M 326 300 Q 384 316 380 366 Q 376 408 336 414 Q 310 410 308 380 Q 330 368 322 330 Q 316 308 326 300 Z')}
  ${blot('M 178 322 Q 158 350 166 384 Q 180 360 198 346 Z')}
  <!-- 胸前白毛 -->
  <path d="M 228 340 Q 256 326 284 340 Q 270 384 256 390 Q 242 384 228 340 Z"
    fill="${FUR}" stroke="rgba(58,58,68,0.30)" stroke-width="3"/>

  <!-- 前爪 -->
  <ellipse cx="202" cy="416" rx="38" ry="25" fill="${FUR}" ${st()}/>
  <ellipse cx="310" cy="416" rx="38" ry="25" fill="${FUR}" ${st()}/>
  ${seg(202, 404, 202, 426, 'rgba(58,58,68,0.40)', 4)}
  ${seg(310, 404, 310, 426, 'rgba(58,58,68,0.40)', 4)}

  <!-- 耳朵（轮廓外） -->
  ${catHead(256, 240, 120, 103, 0.96, true)}

  <!-- 头 -->
  <ellipse cx="256" cy="240" rx="120" ry="103" fill="${FUR}" ${st()}/>
  ${blot('M 250 126 Q 288 122 304 144 Q 296 158 268 156 Q 246 154 240 140 Q 242 128 250 126 Z')}

  ${eye(206, 258, 30, 36)}
  ${eye(306, 258, 30, 36)}
  ${blush(162, 300, 23, 14)}
  ${blush(350, 300, 23, 14)}
  ${muzzle(257, 306, 1.06)}
  ${whiskers(142, 298, 1, -1)}
  ${whiskers(370, 298, 1, 1)}

  <!-- 细项圈 + 铃铛（位于下巴之下的脖子处） -->
  <path d="M 186 372 Q 256 402 326 372" fill="none" stroke="${COLLAR}" stroke-width="16" stroke-linecap="round"/>
  <path d="M 186 372 Q 256 402 326 372" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" opacity="0.16"/>
  <circle cx="256" cy="398" r="15" fill="${BELL}" ${st(7)}/>
  <circle cx="250" cy="393" r="4.5" fill="${SHINE}" opacity="0.9"/>
  <path d="M 249 404 L 263 404" stroke="${INK}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
  `);
}

// ============================================================
//  stage5 —— 大王猫：小王冠 + 小披风
// ============================================================
function stage5() {
  return svg(`
  <ellipse cx="256" cy="450" rx="128" ry="19" fill="${SHADOW}"/>

  <!-- 披风 -->
  <path d="M 256 268 Q 128 280 106 392 Q 154 462 256 462 Q 358 462 406 392 Q 384 280 256 268 Z"
    fill="${CAPE}" ${st()}/>
  <path d="M 256 286 Q 158 296 142 388 Q 182 442 256 442 Q 330 442 370 388 Q 354 296 256 286 Z"
    fill="${CAPE_D}" stroke="none" opacity="0.5"/>

  <!-- 尾巴 -->
  ${tail('M 390 424 Q 440 428 444 404 Q 446 388 430 384', 22)}

  <!-- 身体 -->
  <path d="M 256 266 Q 372 272 380 366 Q 384 428 256 434 Q 128 428 132 366 Q 140 272 256 266 Z"
    fill="${FUR}" ${st()}/>
  ${blot('M 322 302 Q 378 318 374 364 Q 370 404 332 410 Q 308 406 306 378 Q 328 366 318 332 Q 312 310 322 302 Z')}
  <path d="M 230 342 Q 256 328 282 342 Q 268 386 256 392 Q 244 386 230 342 Z"
    fill="${FUR}" stroke="rgba(58,58,68,0.30)" stroke-width="3"/>

  <!-- 前爪 -->
  <ellipse cx="202" cy="414" rx="38" ry="25" fill="${FUR}" ${st()}/>
  <ellipse cx="310" cy="414" rx="38" ry="25" fill="${FUR}" ${st()}/>
  ${seg(202, 402, 202, 424, 'rgba(58,58,68,0.40)', 4)}
  ${seg(310, 402, 310, 424, 'rgba(58,58,68,0.40)', 4)}

  <!-- 披风领扣 -->
  <circle cx="200" cy="300" r="12" fill="${CROWN}" ${st(6.5)}/>
  <circle cx="312" cy="300" r="12" fill="${CROWN}" ${st(6.5)}/>

  <!-- 耳朵（轮廓外） -->
  ${catHead(256, 244, 118, 101, 0.96, true)}

  <!-- 头 -->
  <ellipse cx="256" cy="244" rx="118" ry="101" fill="${FUR}" ${st()}/>
  ${blot('M 274 128 Q 310 126 326 150 Q 318 166 290 164 Q 266 162 260 146 Q 262 132 274 128 Z')}

  <!-- 小王冠（戴在头顶，位于耳朵之间上方） -->
  <g transform="translate(0 -14)">
    <path d="M 190 132 L 206 78 L 232 110 L 256 64 L 280 110 L 306 78 L 322 132 Z"
      fill="${CROWN}" ${st(9.5)}/>
    <path d="M 190 132 L 322 132" fill="none" stroke="${INK}" stroke-width="9.5" stroke-linecap="round"/>
    <circle cx="206" cy="74" r="10" fill="${NOSE}" ${st(7)}/>
    <circle cx="256" cy="60" r="11" fill="${NOSE}" ${st(7.5)}/>
    <circle cx="306" cy="74" r="10" fill="${NOSE}" ${st(7)}/>
    <circle cx="230" cy="122" r="7" fill="${CROWN_D}" stroke="none"/>
    <circle cx="256" cy="122" r="8" fill="${CROWN_D}" stroke="none"/>
    <circle cx="282" cy="122" r="7" fill="${CROWN_D}" stroke="none"/>
  </g>

  ${eye(206, 262, 30, 36)}
  ${eye(306, 262, 30, 36)}
  ${blush(162, 304, 23, 14)}
  ${blush(350, 304, 23, 14)}
  ${muzzle(257, 310, 1.06)}
  ${whiskers(142, 302, 1, -1)}
  ${whiskers(370, 302, 1, 1)}
  `);
}

// ============================================================
//  food.png —— 猫粮碗 + 小鱼干
// ============================================================
function food() {
  return svg(`
  <ellipse cx="256" cy="418" rx="148" ry="23" fill="${SHADOW}"/>

  <!-- 碗体 -->
  <path d="M 112 272 Q 112 416 256 416 Q 400 416 400 272 Z" fill="${BOWL}" ${st()}/>
  <path d="M 142 292 Q 144 394 256 398 Q 368 394 370 292 Z" fill="#9BD9F7" stroke="none"/>
  <!-- 碗口 -->
  <ellipse cx="256" cy="272" rx="146" ry="45" fill="${BOWL_D}" ${st()}/>
  <ellipse cx="256" cy="272" rx="122" ry="33" fill="#5A6572" stroke="none"/>
  <path d="M 170 254 Q 210 240 254 240" fill="none" stroke="${SHINE}" stroke-width="9" stroke-linecap="round" opacity="0.5"/>

  <!-- 猫粮颗粒 -->
  ${circ(216, 266, 21, FOODP, 7)}
  ${circ(262, 254, 19, '#B87A3C', 7)}
  ${circ(300, 272, 20, FOODP, 7)}
  ${circ(240, 286, 18, '#B87A3C', 7)}
  ${circ(278, 292, 16, FOODP, 7)}
  <!-- 骨头小饼干 -->
  <g transform="translate(196 296) rotate(-18)">
    <rect x="-15" y="-10" width="30" height="20" rx="10" fill="#F5E3C8" ${st(6.5)}/>
  </g>

  <!-- 小鱼干 -->
  <g transform="translate(382 244) rotate(12)">
    <path d="M -66 0 Q -32 -38 20 -17 Q 58 -2 72 0 Q 58 2 20 17 Q -32 38 -66 0 Z"
      fill="${FISHBODY}" ${st()}/>
    <path d="M -66 0 L -102 -28 L -98 0 L -102 28 Z" fill="${FISHFIN}" ${st()}/>
    <path d="M -12 -20 Q 4 -32 20 -17" fill="none" ${st(6.5)}/>
    <path d="M -12 20 Q 4 32 20 17" fill="none" ${st(6.5)}/>
    <circle cx="44" cy="-6" r="6.5" fill="${INK}"/>
    <circle cx="42" cy="-8" r="2.4" fill="${SHINE}"/>
    <path d="M 62 -10 Q 70 -6 62 -2" fill="none" ${st(5)}/>
  </g>

  <!-- 碗上爪印 -->
  <g transform="translate(256 366)" opacity="0.3">
    <ellipse cx="0" cy="6" rx="19" ry="15" fill="#FFFFFF"/>
    <circle cx="-19" cy="-13" r="7.5" fill="#FFFFFF"/>
    <circle cx="-6" cy="-19" r="7.5" fill="#FFFFFF"/>
    <circle cx="9" cy="-19" r="7.5" fill="#FFFFFF"/>
    <circle cx="22" cy="-11" r="7.5" fill="#FFFFFF"/>
  </g>
  `);
}

// ============================================================
//  soap.png —— 泡泡浴
// ============================================================
function soap() {
  const bubble = (cx, cy, r, op = 1) => `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${BUBBLE}" opacity="${0.93 * op}" ${st(8)}/>
    <ellipse cx="${cx - r * 0.32}" cy="${cy - r * 0.36}" rx="${r * 0.30}" ry="${r * 0.22}"
      fill="${SHINE}" opacity="${0.9 * op}" transform="rotate(-28 ${cx - r * 0.32} ${cy - r * 0.36})"/>`;
  return svg(`
  <ellipse cx="256" cy="424" rx="146" ry="23" fill="${SHADOW}"/>

  <!-- 浴盆 -->
  <path d="M 96 266 Q 92 416 256 418 Q 420 416 416 266 Z" fill="${SOAP}" ${st()}/>
  <path d="M 130 286 Q 130 392 256 396 Q 382 392 382 286 Z" fill="#B7E7F8" stroke="none"/>
  <ellipse cx="256" cy="266" rx="164" ry="50" fill="#6FC7E6" ${st()}/>
  <ellipse cx="256" cy="270" rx="142" ry="38" fill="#EAF9FF" stroke="none"/>

  <!-- 盆内泡泡（先画，位于爪子之下层） -->
  ${bubble(206, 268, 36)}
  ${bubble(268, 258, 42)}
  ${bubble(316, 280, 28)}
  ${bubble(240, 294, 29)}
  ${bubble(292, 298, 25)}
  ${bubble(176, 298, 26)}

  <!-- 盆沿猫爪（画在泡泡之上，完整可见；肉垫一大三小） -->
  <g transform="rotate(-15 150 232)">
    <ellipse cx="150" cy="232" rx="44" ry="33" fill="${FUR}" ${st()}/>
    <ellipse cx="150" cy="244" rx="20" ry="15" fill="${BLUSH}"/>
    <ellipse cx="126" cy="214" rx="9" ry="8" fill="${BLUSH}"/>
    <ellipse cx="146" cy="207" rx="9" ry="8" fill="${BLUSH}"/>
    <ellipse cx="166" cy="209" rx="9" ry="8" fill="${BLUSH}"/>
    <ellipse cx="182" cy="220" rx="8.5" ry="7.5" fill="${BLUSH}"/>
  </g>
  <g transform="rotate(15 362 238)">
    <ellipse cx="362" cy="238" rx="43" ry="32" fill="${FUR}" ${st()}/>
    <ellipse cx="362" cy="250" rx="19" ry="14" fill="${BLUSH}"/>
    <ellipse cx="339" cy="221" rx="8.5" ry="7.5" fill="${BLUSH}"/>
    <ellipse cx="358" cy="214" rx="9" ry="8" fill="${BLUSH}"/>
    <ellipse cx="378" cy="216" rx="9" ry="8" fill="${BLUSH}"/>
    <ellipse cx="393" cy="227" rx="8.5" ry="7.5" fill="${BLUSH}"/>
  </g>

  <!-- 上升泡泡 -->
  ${bubble(112, 168, 27, 0.95)}
  ${bubble(392, 156, 35, 0.95)}
  ${bubble(234, 118, 38, 0.95)}
  ${bubble(322, 78, 25, 0.9)}
  ${bubble(162, 68, 21, 0.82)}
  ${bubble(424, 238, 19, 0.82)}
  `);
}

// ============================================================
//  heart.png —— 爱心
// ============================================================
function heart() {
  return svg(`
  <ellipse cx="256" cy="426" rx="124" ry="21" fill="${SHADOW}"/>
  <path d="M 256 424
           Q 100 322 100 218
           Q 100 124 178 118
           Q 236 114 256 180
           Q 276 114 334 118
           Q 412 124 412 218
           Q 412 322 256 424 Z"
    fill="${HEART}" ${st(13)}/>
  <!-- 内层柔和渐变感（用细描边代替生硬色块） -->
  <path d="M 256 388
           Q 142 302 142 220
           Q 142 156 190 152
           Q 232 150 256 204
           Q 280 150 322 152
           Q 370 156 370 220
           Q 370 302 256 388 Z"
    fill="none" stroke="${HEART_D}" stroke-width="10" opacity="0.5" stroke-linejoin="round"/>
  <ellipse cx="178" cy="192" rx="33" ry="23" fill="${SHINE}" opacity="0.92" transform="rotate(-32 178 192)"/>
  <ellipse cx="214" cy="162" rx="15" ry="10" fill="${SHINE}" opacity="0.72" transform="rotate(-32 214 162)"/>
  <g transform="translate(400 120) rotate(14)">
    <path d="M 0 56 Q -43 24 -43 -6 Q -43 -38 -17 -39 Q 0 -40 0 -21 Q 0 -40 17 -39 Q 43 -38 43 -6 Q 43 24 0 56 Z"
      fill="${NOSE}" ${st(9.5)}/>
  </g>
  <g transform="translate(104 126) rotate(-16)">
    <path d="M 0 40 Q -31 17 -31 -5 Q -31 -27 -12 -28 Q 0 -29 0 -14 Q 0 -29 12 -28 Q 31 -27 31 -5 Q 31 17 0 40 Z"
      fill="${NOSE}" ${st(8.5)}/>
  </g>
  `);
}

// ============================================================
const ITEMS = [
  ['stage1', stage1], ['stage2', stage2], ['stage3', stage3],
  ['stage4', stage4], ['stage5', stage5],
  ['food', food], ['soap', soap], ['heart', heart],
];

mkdirSync(OUT_SVG, { recursive: true });

for (const [name, fn] of ITEMS) {
  const source = fn();
  writeFileSync(join(OUT_SVG, `${name}.svg`), source, 'utf8');
  const resvg = new Resvg(source, {
    fitTo: { mode: 'width', value: SIZE * SS },
    background: 'rgba(0,0,0,0)',
  });
  const png = resvg.render().asPng();
  writeFileSync(join(OUT_PNG, `${name}.png`), png);
  console.log(`${name.padEnd(7)} -> ${SIZE * SS}x${SIZE * SS}  ${png.length} bytes`);
}
console.log('\nDONE');
