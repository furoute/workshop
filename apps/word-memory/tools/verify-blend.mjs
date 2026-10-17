/**
 * 单词猫 — 拼读正确性验收
 *
 * 核心验证：点拼读块时，读的必须是「音节的音」，
 * 而不是把字母名一个个念出来。
 *
 *   正确：colourful → co → lour → ful（各读一个音）
 *   错误：colourful → c → o → l → o → u → r → f → u → l（逐字母念字母名）
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
const PORT = 9343;
const URL_BASE = process.env.WP_URL ?? 'http://127.0.0.1:5273/';
const PROFILE = join(process.env.TEMP ?? '/tmp', `wp-blend-${Date.now()}`);

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
      } else if (m.method === 'Runtime.exceptionThrown') {
        this.logs.push(m.params.exceptionDetails.exception?.description ?? '');
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

  // 探针：记录每次朗读的文本
  await cdp.eval(`
    window.__speakLog = [];
    const orig = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = (u) => { window.__speakLog.push(String(u.text)); return orig(u); };
    return true;
  `);

  // 直接打开一个已知多音节词的拼读页：用三下 U4 的 vegetable
  await cdp.eval(`document.querySelector('[data-go="pick"]')?.click(); return true;`);
  await sleep(600);
  await cdp.eval(`document.querySelectorAll('.book-tabs .tab')[1]?.click(); return true;`);
  await sleep(600);
  await cdp.eval(`
    const u=[...document.querySelectorAll('.unit[data-unit]')].find(e=>Number(e.dataset.unit)===4);
    u?.click(); return true;
  `);
  await sleep(600);
  await cdp.eval(`document.querySelector('[data-go="home"]')?.click(); return true;`);
  await sleep(500);
  await cdp.eval(`document.querySelector('[data-go="study"]')?.click(); return true;`);
  await sleep(900);

  // 翻到 vegetable
  let found = '';
  for (let i = 0; i < 40; i++) {
    const w = await cdp.eval(`return window.__wpTest?.word ?? '';`);
    if (w === 'vegetable') { found = w; break; }
    await cdp.eval(`window.__wpTest?.pickRight() || document.querySelector('.option:not(:disabled)')?.click(); return true;`);
    await sleep(420);
    await cdp.eval(`document.querySelector('[data-next]')?.click(); return true;`);
    await sleep(420);
    const done = await cdp.eval(`return !!document.querySelector('.done-screen');`);
    if (done) { await cdp.eval(`document.querySelector('[data-go="study"]')?.click(); return true;`); await sleep(900); }
  }

  if (!found) {
    console.log('⚠️ 未翻到 vegetable，改用当前词测试');
    found = await cdp.eval(`return window.__wpTest?.word ?? '';`);
  }
  console.log(`\n【测试词】${found}\n`);

  await cdp.eval(`document.querySelector('[data-go="spell-now"]')?.click(); return true;`);
  await sleep(900);
  await cdp.eval(`document.querySelector('[data-spell-stage="pin"]')?.click(); return true;`);
  await sleep(700);

  // ── 关键验证 1：拼读块是音节，不是单字母 ──
  const chunks = await cdp.eval(`
    const cs=[...document.querySelectorAll('.chunk')];
    return {
      texts: cs.map(c=>c.querySelector('.ch')?.textContent?.trim() ?? ''),
      sounds: cs.map(c=>c.querySelector('.so')?.textContent?.trim() ?? ''),
    };
  `);
  check('拼读块按音节划分（不是单字母）',
    chunks.texts.length > 0 && chunks.texts.some((t) => t.length > 1),
    `${chunks.texts.length} 块：${chunks.texts.join(' | ')}`);
  check('每块显示对应音标',
    chunks.sounds.filter((s) => s && s !== '\u00a0').length > 0,
    chunks.sounds.map((s, i) => `${chunks.texts[i]}${s}`).join(' '));

  // ── 关键验证 2：点块读的是音节，不是字母名 ──
  await cdp.eval(`window.__speakLog=[]; return true;`);
  await cdp.eval(`document.querySelector('.chunk')?.click(); return true;`);
  await sleep(500);
  const firstRead = await cdp.eval(`return window.__speakLog.slice();`);
  const firstChunk = chunks.texts[0];
  check('点拼读块读的是整个音节',
    firstRead.length === 1 && firstRead[0] === firstChunk,
    `点了「${firstChunk}」，实际朗读 "${firstRead.join('|')}"`);

  // 再点第二块
  await cdp.eval(`window.__speakLog=[]; return true;`);
  await cdp.eval(`document.querySelectorAll('.chunk')[1]?.click(); return true;`);
  await sleep(500);
  const secondRead = await cdp.eval(`return window.__speakLog.slice();`);
  check('第二块同样读音节',
    secondRead.length === 1 && secondRead[0] === chunks.texts[1],
    `点了「${chunks.texts[1]}」，实际朗读 "${secondRead.join('|')}"`);

  // ── 关键验证 3：逐个字母读是错误行为，必须没发生 ──
  const allReads = [...firstRead, ...secondRead];
  const isLetterByLetter = allReads.every((t) => t.length === 1) && chunks.texts[0].length > 1;
  check('没有退化成逐字母念字母名', !isLetterByLetter,
    isLetterByLetter ? '⚠️ 仍在逐字母读！' : '读音节而非字母名');

  // ── 关键验证 4：连起来读（要等所有音节 + 整词读完）──
  await cdp.eval(`window.__speakLog=[]; return true;`);
  await cdp.eval(`document.querySelector('[data-blend]')?.click(); return true;`);
  // 每块 700ms，末尾还要读整词，留足时间
  await sleep(chunks.texts.length * 700 + 1600);
  const blendLog = await cdp.eval(`return window.__speakLog.slice();`);
  check('「连起来读」依次读音节',
    blendLog.length >= chunks.texts.length,
    `朗读序列：${blendLog.join(' → ')}`);
  check('连读最后读整词',
    blendLog[blendLog.length - 1] === found,
    `末尾朗读 "${blendLog[blendLog.length - 1]}"（期望 "${found}"）`);

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(SHOTS, '30-blend.png'), Buffer.from(shot.data, 'base64'));
  console.log('   截图：_shots/30-blend.png');

  check('无 JS 运行时错误', cdp.logs.length === 0, cdp.logs.slice(0, 2).join(' | ') || '干净');

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`拼读正确性验收：${passed}/${results.length} 通过`);
  if (passed < results.length) results.filter((r) => !r.pass).forEach((r) => console.log(`  ✗ ${r.name} — ${r.detail}`));
  console.log('═'.repeat(56));

  ws.close(); chrome.kill(); await sleep(400);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => { console.error('失败:', e.message); cleanup(); process.exit(2); });
