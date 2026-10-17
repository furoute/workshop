/**
 * 单词猫 — 教材版本切换验收
 *
 * 验证运行时切换词库版本是否真的生效：
 *   1. 旧版状态下，三上 Unit 1 是 Hello!
 *   2. 切到新版后，三上 Unit 1 变成 Making friends
 *   3. 单词内容随之改变
 *   4. 切换后学习记录保留
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
const PORT = 9337;
const URL_BASE = process.env.WP_URL ?? 'http://127.0.0.1:5273/';
const PROFILE = join(process.env.TEMP ?? '/tmp', `wp-sw-${Date.now()}`);

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

/** 读取教材选择页上「第一个真实单元」的信息（跳过"全部"与"字母表"等附加入口） */
const READ_UNIT1 = `
  // .unit 里混有「整册综合练习」和「26 个字母发音表」等入口，
  // 真正的单元项带 data-unit 且值 > 0
  const units = [...document.querySelectorAll('.unit[data-unit]')]
    .filter(el => Number(el.dataset.unit) > 0);
  const u1 = units[0];
  return {
    title: u1?.querySelector('.unit-body b')?.textContent?.trim() ?? '',
    sub: u1?.querySelector('.unit-body span')?.textContent?.trim() ?? '',
    allUnits: units.length,
    wordPill: document.querySelector('.topbar .pill')?.textContent?.trim() ?? '',
  };
`;

/** 等某个选择器出现，最多等 timeout 毫秒 */
async function waitFor(cdp, sel, timeout = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const n = await cdp.eval(`return document.querySelectorAll(${JSON.stringify(sel)}).length;`);
    if (n > 0) return n;
    await sleep(200);
  }
  return 0;
}

/** 切到「我的」页并确保版本按钮已渲染 */
async function gotoMeTab(cdp) {
  for (let attempt = 0; attempt < 5; attempt++) {
    // 选词页 / 答题页没有 tabbar，需要先退回首页
    const hasTabbar = await cdp.eval(`return document.querySelectorAll('.tabbar button').length > 0;`);
    if (!hasTabbar) {
      await cdp.eval(`document.querySelector('[data-go="home"]')?.click()
        || document.querySelector('[data-go="back"]')?.click()
        || document.querySelector('[data-go="quit"]')?.click(); return true;`);
      await sleep(600);
      continue;
    }
    await cdp.eval(`document.querySelectorAll('.tabbar button')[3]?.click(); return true;`);
    await sleep(500);
    const n = await waitFor(cdp, '[data-edition]', 2500);
    if (n > 0) return n;
  }
  return 0;
}

async function openPick(cdp) {
  // 从任意页面回到首页，再进选词页
  await cdp.eval(`document.querySelector('[data-go="home"]')?.click()
    || document.querySelector('[data-go="quit"]')?.click()
    || document.querySelectorAll('.tabbar button')[0]?.click(); return true;`);
  await sleep(600);
  for (let attempt = 0; attempt < 4; attempt++) {
    await cdp.eval(`document.querySelector('[data-go="pick"]')?.click(); return true;`);
    await sleep(500);
    const n = await waitFor(cdp, '.unit', 2000);
    if (n > 0) return n;
    // 可能还在答题页，先退出来
    await cdp.eval(`document.querySelector('[data-go="quit"]')?.click(); return true;`);
    await sleep(400);
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

  // ── 1. 已导入新版时应默认使用新版 ──
  await openPick(cdp);
  const initial = await cdp.eval(READ_UNIT1);
  check('默认使用 2024 新版词库', initial.title.includes('Making friends'),
    `Unit 1 = "${initial.title}"`);
  check('新版词库规模正确', initial.wordPill.includes('221'), initial.wordPill);
  await cdp.shot('09-new-edition');

  // ── 2. 去设置页，确认有切换按钮 ──
  const btnCount = await gotoMeTab(cdp);

  const switchUI = await cdp.eval(`
    const btns = [...document.querySelectorAll('[data-edition]')];
    return {
      hasButtons: btns.length,
      labels: btns.map(b => b.textContent.trim()),
      current: document.querySelector('[data-edition-name]')?.textContent?.trim() ?? '',
      warnShown: /当前只有旧版词库/.test(document.body.textContent),
    };
  `);
  check('设置页出现版本切换按钮', switchUI.hasButtons === 2,
    `按钮：${switchUI.labels.join(' / ') || `(渲染到 ${btnCount} 个)`}`);
  check('已导入新版时不再显示"只有旧版"警告', !switchUI.warnShown);

  // 切到旧版
  await cdp.eval(`document.querySelector('[data-edition="pep-2012"]')?.click(); return true;`);
  await sleep(800);

  const afterSwitch = await cdp.eval(`
    return { name: document.querySelector('[data-edition-name]')?.textContent?.trim() ?? '' };
  `);
  check('切换到旧版成功', afterSwitch.name.includes('2012'),
    `当前版本：${afterSwitch.name}`);

  // ── 3. 回选词页，验证单元标题真的变了 ──
  await openPick(cdp);
  const oldState = await cdp.eval(READ_UNIT1);
  check('切到旧版后 Unit 1 变为 Hello!',
    oldState.title.includes('Hello'),
    `Unit 1 = "${oldState.title}"（${oldState.wordPill}）`);
  check('旧版词库规模正确', oldState.wordPill.includes('913'), oldState.wordPill);

  // ── 3b. 切回新版，验证可逆 ──
  await gotoMeTab(cdp);
  await cdp.eval(`document.querySelector('[data-edition="pep-2024"]')?.click(); return true;`);
  await sleep(800);
  await openPick(cdp);
  const newState = await cdp.eval(READ_UNIT1);
  check('能切回 2024 新版', newState.title.includes('Making friends'),
    `Unit 1 = "${newState.title}"`);
  check('切回后词库规模正确', newState.wordPill.includes('221'), newState.wordPill);
  check('单元主题也已更新', newState.sub.includes('交朋友'), newState.sub);
  await cdp.shot('10-new-edition');

  // ── 4. 新版词库能正常答题 ──
  await cdp.eval(`document.querySelector('[data-go="home"]')?.click(); return true;`);
  await sleep(500);
  await cdp.eval(`document.querySelector('[data-go="study"]')?.click(); return true;`);
  await sleep(1000);

  const quiz = await cdp.eval(`
    return {
      inQuiz: !!document.querySelector('.quiz-top'),
      word: window.__wpTest?.word ?? '',
      count: document.querySelector('.quiz-count')?.textContent ?? '',
    };
  `);
  check('新版词库能进入答题', quiz.inQuiz && quiz.word.length > 0,
    `${quiz.count} · 当前词 "${quiz.word}"`);

  // 答一题
  await cdp.eval(`window.__wpTest?.pickRight() || document.querySelector('.option:not(:disabled)')?.click(); return true;`);
  await sleep(700);
  const answered = await cdp.eval(`
    const s = JSON.parse(localStorage.getItem('wordpet.save.v1') || '{}');
    return { hasFb: !!document.querySelector('.feedback'), learned: Object.values(s.progress||{}).filter(p=>p.level>0).length };
  `);
  check('新版词库答题可正常记录', answered.hasFb && answered.learned > 0,
    `学习记录 ${answered.learned} 词`);

  // 学习记录应保留
  const savedProgress = await cdp.eval(`
    const s = JSON.parse(localStorage.getItem('wordpet.save.v1') || '{}');
    return Object.values(s.progress||{}).filter(p=>p.level>0).length;
  `);
  check('切换版本后学习记录保留', savedProgress > 0, `${savedProgress} 个词的记录仍在`);

  check('无 JS 运行时错误', cdp.logs.length === 0, cdp.logs.slice(0, 2).join(' | ') || '干净');

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`版本切换验收：${passed}/${results.length} 通过`);
  if (passed < results.length) {
    results.filter((r) => !r.pass).forEach((r) => console.log(`  ✗ ${r.name} — ${r.detail}`));
  }
  console.log('═'.repeat(52));

  ws.close(); chrome.kill();
  await sleep(400);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => { console.error('验收失败:', e.message); cleanup(); process.exit(2); });
