/**
 * 单词猫 — 昵称显示验证
 */
import { spawn } from 'node:child_process';
import { rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { testUrl } from './net.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(__dirname, '..', '_shots');
mkdirSync(SHOTS, { recursive: true });

const CHROME = process.env.CHROME_PATH || 'chrome.exe';
const PORT = 9344;
const PROFILE = join(process.env.TEMP ?? '/tmp', `wp-nick-${Date.now()}`);

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
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
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

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`);
};

const url = testUrl();
console.log(`访问地址：${url}\n`);

await waitForCdp();
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
const cdp = new CDP(ws);
await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await cdp.send('Page.navigate', { url });
await sleep(2800);

const info = await cdp.eval(`
  const save = JSON.parse(localStorage.getItem('wordpet.save.v1') || '{}');
  return {
    greeting: document.querySelector('.greeting')?.textContent?.replace(/\\s+/g,' ').trim() ?? '',
    nickname: save.nickname ?? '(尚未写入存档)',
    petName: save.pet?.name ?? '(尚未写入存档)',
    petShown: document.querySelector('.hero-sub')?.textContent?.replace(/\\s+/g,' ').trim() ?? '',
  };
`);
check('首页显示默认昵称「小朋友」', info.greeting.includes('小朋友'), info.greeting);
// 全新存档时 localStorage 还没写，这是正常的；关键是界面显示对不对
check('存档昵称正确（或尚未落盘）',
  info.nickname === '小朋友' || info.nickname === '(尚未写入存档)',
  `存档值：${info.nickname}`);
check('猫咪显示正常', info.petShown.length > 0, info.petShown);

const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(SHOTS, '40-home-child.png'), Buffer.from(shot.data, 'base64'));
console.log('   截图：_shots/40-home-child.png');

const passed = results.filter((r) => r.pass).length;
console.log(`\n昵称验证：${passed}/${results.length} 通过`);

ws.close(); chrome.kill(); await sleep(300);
process.exit(passed === results.length ? 0 : 1);
