/**
 * 单词猫 — 拼读功能长词抽查
 *
 * 用多音节词验证「学」环节的拆分效果和「拼」环节的字母块。
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
const PORT = 9341;
const URL_BASE = process.env.WP_URL ?? 'http://127.0.0.1:5273/';
const PROFILE = join(process.env.TEMP ?? '/tmp', `wp-long-${Date.now()}`);

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--window-size=390,844', 'about:blank'], { stdio: 'ignore' });
const cleanup = () => { try { chrome.kill(); } catch { /* */ } try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* */ } };
process.on('exit', cleanup);

async function waitForCdp() {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return; } catch { /* */ }
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
      } else if (m.method === 'Runtime.exceptionThrown') this.logs.push(m.params.exceptionDetails.exception?.description ?? '');
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
  async eval(e, retry = true) {
    try {
      const r = await this.send('Runtime.evaluate', { expression: `(async () => { ${e} })()`, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error('页面异常: ' + JSON.stringify(r.exceptionDetails.exception?.description));
      return r.result.value;
    } catch (err) {
      if (retry && /超时/.test(err.message)) { await sleep(700); return this.eval(e, false); }
      throw err;
    }
  }
}

async function main() {
  await waitForCdp();
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  const cdp = new CDP(ws);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await cdp.send('Page.navigate', { url: URL_BASE });
  await sleep(2600);

  // 切到三下（有 computer / vegetable 这类长词）
  await cdp.eval(`document.querySelector('[data-go="pick"]')?.click(); return true;`);
  await sleep(700);
  await cdp.eval(`document.querySelectorAll('.book-tabs .tab')[1]?.click(); return true;`);
  await sleep(700);

  // 找带多音节的词：遍历单元，挑 vegetable / computer / colourful 之类
  const found = await cdp.eval(`
    // 直接进 U3 或 U4（Learning better / Healthy food 有长词）
    const units = [...document.querySelectorAll('.unit[data-unit]')].filter(u => Number(u.dataset.unit) > 0);
    return units.map(u => u.querySelector('.unit-body b')?.textContent?.trim() ?? '');
  `);
  console.log('三下单元：', found.join(' / '));

  // 选 U4 Healthy food（含 vegetable）
  await cdp.eval(`
    const units = [...document.querySelectorAll('.unit[data-unit]')].filter(u => Number(u.dataset.unit) === 4);
    units[0]?.click(); return true;
  `);
  await sleep(700);
  await cdp.eval(`document.querySelector('[data-go="home"]')?.click(); return true;`);
  await sleep(500);
  await cdp.eval(`document.querySelector('[data-go="study"]')?.click(); return true;`);
  await sleep(1000);

  // 一直翻页直到遇到多音节词（含音节 >= 2）
  let target = null;
  for (let i = 0; i < 25; i++) {
    const st = await cdp.eval(`
      const w = window.__wpTest?.word ?? '';
      return { word: w, hasEntry: !!document.querySelector('[data-go="spell-now"]') };
    `);
    if (st.hasEntry && st.word.length >= 7) { target = st.word; break; }
    await cdp.eval(`window.__wpTest?.pickRight() || document.querySelector('.option:not(:disabled)')?.click(); return true;`);
    await sleep(500);
    await cdp.eval(`document.querySelector('[data-next]')?.click(); return true;`);
    await sleep(500);
    const done = await cdp.eval(`return !!document.querySelector('.done-screen');`);
    if (done) {
      await cdp.eval(`document.querySelector('[data-go="study"]')?.click(); return true;`);
      await sleep(900);
    }
  }

  if (!target) { console.log('⚠️ 未找到长词，用当前词演示'); }
  else console.log(`\n找到长词：${target}`);

  await cdp.eval(`document.querySelector('[data-go="spell-now"]')?.click(); return true;`);
  await sleep(900);

  const xue = await cdp.eval(`
    return {
      word: document.querySelector('.big-word, .syl-row')?.textContent?.replace(/\\s+/g,' ').trim() ?? '',
      syls: [...document.querySelectorAll('.syl')].map(e => e.textContent.trim()),
      hint: document.querySelector('.word-card div:last-child')?.textContent?.trim() ?? '',
    };
  `);
  console.log(`「学」环节拆分为：${xue.syls.join(' · ')}`);
  console.log(`提示：${xue.hint}`);

  let shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(SHOTS, '16-long-xue.png'), Buffer.from(shot.data, 'base64'));

  // 切到「拼」
  await cdp.eval(`document.querySelector('[data-spell-stage="pin"]')?.click(); return true;`);
  await sleep(700);
  const pin = await cdp.eval(`
    const chunks = [...document.querySelectorAll('.chunk')];
    return {
      letters: chunks.map(c => c.querySelector('.ch')?.textContent?.trim() ?? '').join(''),
      sounds: chunks.map(c => c.querySelector('.so')?.textContent?.trim() ?? '').filter(Boolean),
    };
  `);
  console.log(`「拼」环节字母块：${pin.letters}`);
  console.log(`对应音标片段：${pin.sounds.join(' | ')}`);

  shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(SHOTS, '17-long-pin.png'), Buffer.from(shot.data, 'base64'));

  console.log('\n截图：_shots/16-long-xue.png, _shots/17-long-pin.png');
  if (cdp.logs.length) console.log('页面异常：', cdp.logs.slice(0, 3).join(' | '));

  ws.close(); chrome.kill(); await sleep(400); process.exit(0);
}

main().catch((e) => { console.error('失败:', e.message); cleanup(); process.exit(2); });
