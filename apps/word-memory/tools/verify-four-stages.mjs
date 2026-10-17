/**
 * 单词猫 — 四环节功能逐项实测
 *
 * 对「学 · 读 · 练 · 拼」四个环节做行为级验证：
 * 不只是检查元素存在，还验证点击后真的触发了对应行为
 * （发音调用、音节拆分、词义展示、字母块高亮）。
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
const PORT = 9342;
const URL_BASE = process.env.WP_URL ?? 'http://127.0.0.1:5273/';
const PROFILE = join(process.env.TEMP ?? '/tmp', `wp-four-${Date.now()}`);

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
    this.logs = []; this.speaks = [];
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        this.logs.push(m.params.exceptionDetails.exception?.description ?? '');
      } else if (m.method === 'Runtime.consoleAPICalled') {
        const txt = m.params.args.map((a) => a.value ?? a.description).join(' ');
        if (txt.includes('[发音]') || txt.includes('speak')) this.speaks.push(txt);
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
  async shot(name) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(r.data, 'base64'));
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

  // 装一个探针：记录 speechSynthesis.speak 的调用
  await cdp.eval(`
    if (!window.__speakLog) {
      window.__speakLog = [];
      const orig = window.speechSynthesis.speak.bind(window.speechSynthesis);
      window.speechSynthesis.speak = (u) => { window.__speakLog.push(u.text); return orig(u); };
    }
    return true;
  `);

  // ── 用一个多音节词演示（三下 U4 vegetable）──
  await cdp.eval(`document.querySelector('[data-go="pick"]')?.click(); return true;`);
  await sleep(600);
  await cdp.eval(`document.querySelectorAll('.book-tabs .tab')[1]?.click(); return true;`);
  await sleep(600);
  await cdp.eval(`
    const u = [...document.querySelectorAll('.unit[data-unit]')].find(e => Number(e.dataset.unit) === 4);
    u?.click(); return true;
  `);
  await sleep(600);
  await cdp.eval(`document.querySelector('[data-go="home"]')?.click(); return true;`);
  await sleep(500);
  await cdp.eval(`document.querySelector('[data-go="study"]')?.click(); return true;`);
  await sleep(900);

  // 翻到多音节词
  let word = '';
  for (let i = 0; i < 25; i++) {
    const st = await cdp.eval(`return { w: window.__wpTest?.word ?? '', e: !!document.querySelector('[data-go="spell-now"]') };`);
    if (st.e && st.w.length >= 7) { word = st.w; break; }
    await cdp.eval(`window.__wpTest?.pickRight() || document.querySelector('.option:not(:disabled)')?.click(); return true;`);
    await sleep(450);
    await cdp.eval(`document.querySelector('[data-next]')?.click(); return true;`);
    await sleep(450);
  }
  console.log(`\n【测试词】${word || '(未找到长词)'}\n`);

  console.log('── 环节 1/4：学（拆分音节）──');
  await cdp.eval(`document.querySelector('[data-go="spell-now"]')?.click(); return true;`);
  await sleep(900);

  const xue = await cdp.eval(`
    const syls = [...document.querySelectorAll('.syl')];
    return {
      active: document.querySelector('.stage.on b')?.textContent?.trim() ?? '',
      sub: document.querySelector('.stage.on span')?.textContent?.trim() ?? '',
      count: syls.length,
      parts: syls.map(e => e.textContent.trim()),
      phon: document.querySelector('.phonetic')?.textContent?.trim() ?? '',
      mean: document.querySelector('.meaning')?.textContent?.trim() ?? '',
    };
  `);
  check('「学」环节存在且为默认环节', xue.active === '学', `标签：${xue.active} / ${xue.sub}`);
  check('音节已拆分并可点击', xue.count > 0, `${xue.count} 块：${xue.parts.join(' · ')} · 音标 ${xue.phon} · ${xue.mean}`);

  // 点音节验证发音
  await cdp.eval(`window.__speakLog = []; return true;`);
  await cdp.eval(`document.querySelector('.syl')?.click(); return true;`);
  await sleep(500);
  const sylSpeak = await cdp.eval(`return window.__speakLog.slice();`);
  check('点音节真的触发发音', sylSpeak.length > 0, sylSpeak.length ? `已朗读 "${sylSpeak[0]}"` : '未触发');
  await cdp.shot('20-stage1-xue');

  console.log('\n── 环节 2/4：读（跟读发音）──');
  await cdp.eval(`document.querySelector('[data-spell-stage="du"]')?.click(); return true;`);
  await sleep(900);
  const du = await cdp.eval(`
    return {
      active: document.querySelector('.stage.on b')?.textContent?.trim() ?? '',
      sub: document.querySelector('.stage.on span')?.textContent?.trim() ?? '',
      word: document.querySelector('.big-word')?.textContent?.trim() ?? '',
      phon: document.querySelector('.phonetic')?.textContent?.trim() ?? '',
      btns: [...document.querySelectorAll('.speak-btn')].map(e => e.textContent.trim()),
    };
  `);
  check('「读」环节有三种朗读方式', du.active === '读' && du.btns.length >= 3,
    `${du.btns.join(' / ')} · 单词 ${du.word} ${du.phon}`);

  // 验证慢速与逐块
  await cdp.eval(`window.__speakLog = []; return true;`);
  await cdp.eval(`document.querySelector('[data-speak-slow]')?.click(); return true;`);
  await sleep(500);
  const slowSpeak = await cdp.eval(`return window.__speakLog.slice();`);
  check('慢速朗读可用', slowSpeak.length > 0, slowSpeak.length ? `已朗读 "${slowSpeak[0]}"` : '未触发');

  await cdp.eval(`window.__speakLog = []; return true;`);
  await cdp.eval(`document.querySelector('[data-speak-syl]')?.click(); return true;`);
  await sleep(700);
  const sylRead = await cdp.eval(`return window.__speakLog.slice();`);
  check('逐块拼读可用（音节逐个读）', sylRead.length >= 2,
    sylRead.length ? `朗读序列：${sylRead.join(' → ')}` : '未触发');
  await cdp.shot('21-stage2-du');

  console.log('\n── 环节 3/4：练（词义详解）──');
  await cdp.eval(`document.querySelector('[data-spell-stage="lian"]')?.click(); return true;`);
  await sleep(700);
  const lian = await cdp.eval(`
    const card = [...document.querySelectorAll('.card')].find(c => /例句/.test(c.textContent));
    return {
      active: document.querySelector('.stage.on b')?.textContent?.trim() ?? '',
      sub: document.querySelector('.stage.on span')?.textContent?.trim() ?? '',
      word: document.querySelector('.big-word')?.textContent?.trim() ?? '',
      mean: document.querySelector('.meaning')?.textContent?.trim() ?? '',
      exText: card?.querySelector('div div')?.textContent?.trim() ?? '',
      hasExSpeak: !!document.querySelector('[data-speak-ex]'),
    };
  `);
  check('「练」环节显示词义', lian.active === '练' && lian.mean.length > 0,
    `${lian.word} — ${lian.mean}`);
  check('「练」环节有例句或朗读入口', lian.hasExSpeak || lian.exText.length > 0,
    lian.exText ? `例句：${lian.exText.slice(0, 40)}` : '（该词无例句，有朗读入口）');
  await cdp.shot('22-stage3-lian');

  console.log('\n── 环节 4/4：拼（自然拼读）──');
  await cdp.eval(`document.querySelector('[data-spell-stage="pin"]')?.click(); return true;`);
  await sleep(700);
  const pin = await cdp.eval(`
    const chunks = [...document.querySelectorAll('.chunk')];
    return {
      active: document.querySelector('.stage.on b')?.textContent?.trim() ?? '',
      sub: document.querySelector('.stage.on span')?.textContent?.trim() ?? '',
      n: chunks.length,
      letters: chunks.map(c => c.querySelector('.ch')?.textContent?.trim() ?? '').join(''),
      sounds: chunks.map(c => c.querySelector('.so')?.textContent?.trim() ?? '').filter(s => s && s.length),
    };
  `);
  check('「拼」环节显示字母块', pin.active === '拼' && pin.n > 0,
    `${pin.n} 块：${pin.letters} · 音标片段 ${pin.sounds.join(' | ') || '（无）'}`);

  await cdp.eval(`window.__speakLog = []; return true;`);
  await cdp.eval(`document.querySelector('.chunk')?.click(); return true;`);
  await sleep(400);
  const chunkSpeak = await cdp.eval(`return { log: window.__speakLog.slice(), lit: !!document.querySelector('.chunk.speaking') };`);
  check('点字母块触发发音并高亮', chunkSpeak.log.length > 0 && chunkSpeak.lit,
    chunkSpeak.log.length ? `朗读 "${chunkSpeak.log[0]}"，字母高亮` : '未触发');
  await cdp.shot('23-stage4-pin');

  // ── 返回与闭环 ──
  console.log('\n── 闭环验证 ──');
  await cdp.eval(`document.querySelector('[data-go="quiz-from-spell"]')?.click(); return true;`);
  await sleep(900);
  const back = await cdp.eval(`return { q: !!document.querySelector('.quiz-top'), c: document.querySelector('.quiz-count')?.textContent ?? '' };`);
  check('能返回继续答题', back.q, `回到 ${back.c}`);

  // 答错 → 学一下
  await cdp.eval(`
    const opts = [...document.querySelectorAll('.option:not(:disabled)')];
    const ans = window.__wpTest?.answer;
    (opts.find(o => o.dataset.opt !== ans) ?? opts[0])?.click();
    return true;
  `);
  await sleep(700);
  const learnBtn = await cdp.eval(`return !!document.querySelector('[data-learn-this]');`);
  if (learnBtn) {
    await cdp.eval(`document.querySelector('[data-learn-this]')?.click(); return true;`);
    await sleep(900);
    const l = await cdp.eval(`return { in: !!document.querySelector('.stage-bar'), w: document.querySelector('.big-word, .syl-row')?.textContent?.replace(/\\s+/g,' ').trim() ?? '' };`);
    check('答错后「学一下」直达该词拼读页', l.in, l.w);
  } else {
    check('答错后「学一下」直达该词拼读页', false, '本次未答错，无法验证');
  }

  check('无 JS 运行时错误', cdp.logs.length === 0, cdp.logs.slice(0, 2).join(' | ') || '干净');

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`四环节实测：${passed}/${results.length} 通过`);
  if (passed < results.length) results.filter((r) => !r.pass).forEach((r) => console.log(`  ✗ ${r.name} — ${r.detail}`));
  console.log('═'.repeat(56));

  ws.close(); chrome.kill(); await sleep(400);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => { console.error('失败:', e.message); cleanup(); process.exit(2); });
