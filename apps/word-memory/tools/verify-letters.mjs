/**
 * 单词猫 — 字母发音表验收
 *
 * 校验三上「26 个字母」总览页：
 *   - 入口存在于选词页
 *   - 26 个字母全部渲染，音标与例词正确
 *   - 点击字母能触发发音
 */

import { spawn } from 'node:child_process';
import { rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(__dirname, '..', '_shots');
mkdirSync(SHOTS, { recursive: true });

const CHROME = process.env.CHROME_PATH || 'chrome.exe';
const PORT = 9339;
const URL_BASE = process.env.WP_URL ?? 'http://127.0.0.1:5273/';
const PROFILE = join(process.env.TEMP ?? '/tmp', `wp-abc-${Date.now()}`);

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--window-size=390,844', 'about:blank',
], { stdio: 'ignore' });

const cleanup = () => {
  try { chrome.kill(); } catch { /* ignore */ }
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
};
process.on('exit', cleanup);

async function waitForCdp() {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return r.json(); } catch { /* wait */ }
    await sleep(250);
  }
  throw new Error('CDP 超时');
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.logs = [];
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        this.logs.push('[异常] ' + (m.params.exceptionDetails.exception?.description ?? ''));
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej });
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error('超时 ' + method)); } }, 20000);
    });
  }
  async eval(expr, retry = true) {
    try {
      const r = await this.send('Runtime.evaluate', {
        expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true,
      });
      if (r.exceptionDetails) throw new Error('页面异常: ' + JSON.stringify(r.exceptionDetails.exception?.description));
      return r.result.value;
    } catch (e) {
      if (retry && /超时/.test(e.message)) { await sleep(700); return this.eval(expr, false); }
      throw e;
    }
  }
}

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`);
};

async function waitFor(cdp, sel, timeout = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const n = await cdp.eval(`return document.querySelectorAll(${JSON.stringify(sel)}).length;`);
    if (n > 0) return n;
    await sleep(200);
  }
  return 0;
}

async function main() {
  await waitForCdp();
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res) => ws.addEventListener('open', res, { once: true }));
  const cdp = new CDP(ws);

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await cdp.send('Page.navigate', { url: URL_BASE });
  await sleep(2800);

  // ── 1. 选词页应有字母表入口 ──
  await cdp.eval(`document.querySelector('[data-go="pick"]')?.click(); return true;`);
  await sleep(800);

  const entry = await cdp.eval(`
    const el = document.querySelector('[data-go="letters"]');
    return {
      exists: !!el,
      text: el?.textContent?.replace(/\\s+/g,' ').trim() ?? '',
      bookName: document.querySelector('[data-book-name]')?.textContent?.trim() ?? '',
    };
  `);
  check('三上选词页有「26 个字母发音表」入口', entry.exists && entry.text.includes('26 个字母'),
    `${entry.bookName} · ${entry.text}`);

  // ── 2. 进入字母表页 ──
  await cdp.eval(`document.querySelector('[data-go="letters"]')?.click(); return true;`);
  await sleep(900);

  const page1 = await cdp.eval(`
    const cards = [...document.querySelectorAll('.letter-card')];
    return {
      title: document.querySelector('.topbar h1')?.textContent?.trim() ?? '',
      pill: document.querySelector('.topbar .pill')?.textContent?.trim() ?? '',
      count: cards.length,
      groups: document.querySelectorAll('.letter-grid').length,
      sectionTitles: [...document.querySelectorAll('.section-title')].map(e => e.textContent.trim()),
    };
  `);
  check('字母表页打开成功', page1.title.includes('字母'), `${page1.title} · ${page1.pill}`);
  check('26 个字母全部渲染', page1.count === 26, `实际 ${page1.count} 个`);
  check('按单元分成 6 组', page1.groups === 6, `${page1.groups} 组：${page1.sectionTitles[0] ?? ''} … ${page1.sectionTitles[5] ?? ''}`);

  // ── 3. 抽查字母数据正确性 ──
  const data = await cdp.eval(`
    const cards = [...document.querySelectorAll('.letter-card')];
    const map = {};
    cards.forEach(c => {
      const upper = c.dataset.letterSay;
      map[upper] = {
        big: c.querySelector('.lc-big')?.textContent?.trim() ?? '',
        ipa: c.querySelector('.lc-ipa')?.textContent?.trim() ?? '',
        words: c.querySelector('.lc-words')?.textContent?.trim() ?? '',
      };
    });
    return map;
  `);

  check('A 的字母音与例词正确',
    data.A?.ipa === '/æ/' && data.A?.words.includes('apple'),
    `A ${data.A?.ipa} ${data.A?.words}`);
  check('Q 的字母音正确（/kw/）',
    data.Q?.ipa === '/kw/' && data.Q?.words.includes('queen'),
    `Q ${data.Q?.ipa} ${data.Q?.words}`);
  check('X 的字母音正确（/ks/）',
    data.X?.ipa === '/ks/' && data.X?.words.includes('box'),
    `X ${data.X?.ipa} ${data.X?.words}`);
  check('Z 的字母音与例词正确',
    data.Z?.ipa === '/z/' && data.Z?.words.includes('Zip'),
    `Z ${data.Z?.ipa} ${data.Z?.words}`);
  check('字母表覆盖 A–Z 无缺漏',
    Object.keys(data).length === 26 && 'A' in data && 'Z' in data,
    `${Object.keys(data).length} 个：${Object.keys(data).join('')}`);

  // ── 4. 点击字母应触发发音（检查高亮反馈）──
  await cdp.eval(`document.querySelector('[data-letter-say="A"]')?.click(); return true;`);
  await sleep(300);
  const speaking = await cdp.eval(`
    return !!document.querySelector('.letter-card.speaking');
  `);
  check('点击字母有发音反馈', speaking, speaking ? '字母 A 高亮中' : '未检测到高亮');

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(SHOTS, '11-letters.png'), Buffer.from(shot.data, 'base64'));
  console.log('   截图已保存: _shots/11-letters.png');

  // ── 5. 返回选词页仍正常 ──
  await cdp.eval(`document.querySelector('[data-go="pick"]')?.click(); return true;`);
  await sleep(800);
  const back = await waitFor(cdp, '.unit', 2000);
  check('能返回选词页', back > 0, `${back} 个单元项`);

  check('无 JS 运行时错误', cdp.logs.length === 0, cdp.logs.slice(0, 2).join(' | ') || '干净');

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`字母发音表验收：${passed}/${results.length} 通过`);
  if (passed < results.length) {
    results.filter((r) => !r.pass).forEach((r) => console.log(`  ✗ ${r.name} — ${r.detail}`));
  }
  console.log('═'.repeat(52));

  ws.close(); chrome.kill();
  await sleep(400);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => { console.error('验收失败:', e.message); cleanup(); process.exit(2); });
