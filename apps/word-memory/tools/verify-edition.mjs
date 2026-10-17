/**
 * 单词猫 — 教材版本提示验收
 *
 * 校验「我的」页面的版本区块是否正确反映当前词库版本，
 * 确保家长能看到准确、醒目的版本提示。
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
const PORT = 9336;
const URL_BASE = process.env.WP_URL ?? 'http://127.0.0.1:5273/';
const PROFILE = join(process.env.TEMP ?? '/tmp', `wp-ver-${Date.now()}`);

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

  // 进「我的」页面
  await cdp.eval(`document.querySelectorAll('.tabbar button')[3]?.click(); return true;`);
  await sleep(800);

  const ed = await cdp.eval(`
    const card = document.querySelector('[data-edition-name]')?.closest('.card');
    return {
      nameShown: document.querySelector('[data-edition-name]')?.textContent?.trim() ?? '',
      cardText: card?.textContent?.replace(/\\s+/g,' ').trim() ?? '',
      hasWarning: /旧版词库/.test(card?.textContent ?? ''),
      hasHint: /Making friends/.test(card?.textContent ?? ''),
      mentionsNewEditionCmd: /pnpm add:new/.test(card?.textContent ?? ''),
      sectionTitle: [...document.querySelectorAll('.section-title')].map(e=>e.textContent.trim()).find(t=>t.includes('教材版本')) ?? '',
    };
  `);

  check('设置页有「教材版本」区块', ed.sectionTitle.length > 0, ed.sectionTitle);
  check('显示当前词库版本名', ed.nameShown.length > 0, ed.nameShown);
  check('旧版词库显示醒目警告', ed.hasWarning, ed.hasWarning ? '已提示"当前是旧版词库"' : '未显示警告');
  check('警告中包含版本判断方法', ed.hasHint, ed.hasHint ? '提示看 Unit 1 是否为 Making friends' : '缺少判断方法');

  await cdp.eval(`document.querySelector('[data-edition-name]')?.scrollIntoView({block:'center'}); return true;`);
  await sleep(400);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(SHOTS, '08-edition.png'), Buffer.from(shot.data, 'base64'));
  console.log('   截图已保存: _shots/08-edition.png');

  check('无 JS 运行时错误', cdp.logs.length === 0, cdp.logs.slice(0, 2).join(' | ') || '干净');

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`版本提示验收：${passed}/${results.length} 通过`);
  if (passed < results.length) {
    results.filter((r) => !r.pass).forEach((r) => console.log(`  ✗ ${r.name} — ${r.detail}`));
  }
  console.log('═'.repeat(52));

  ws.close(); chrome.kill();
  await sleep(400);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => { console.error('验收失败:', e.message); cleanup(); process.exit(2); });
