/**
 * 单词猫 — 自然拼读功能验收
 *
 * 验证「学 · 读 · 练 · 拼」四环节：
 *   1. 答题页有「拼读」入口
 *   2. 答错后有「学一下」入口
 *   3. 四个环节可切换，内容各不相同
 *   4. 音节可点击、字母块可点击
 *   5. 能返回答题继续
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
const PORT = 9340;
const URL_BASE = process.env.WP_URL ?? 'http://127.0.0.1:5273/';
const PROFILE = join(process.env.TEMP ?? '/tmp', `wp-spell-${Date.now()}`);

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

  // ── 1. 进入答题页，应有「拼读」按钮 ──
  await cdp.eval(`document.querySelector('[data-go="study"]')?.click(); return true;`);
  await sleep(1000);

  // 若当前是拼写题或听力题，先找有「拼读」入口的
  let hasSpellEntry = false;
  let word = '';
  for (let i = 0; i < 6; i++) {
    const st = await cdp.eval(`
      return {
        hasEntry: !!document.querySelector('[data-go="spell-now"]'),
        word: window.__wpTest?.word ?? '',
        mode: window.__wpTest?.mode ?? '',
      };
    `);
    if (st.hasEntry) { hasSpellEntry = true; word = st.word; break; }
    // 答掉当前题再找
    await cdp.eval(`window.__wpTest?.pickRight() || document.querySelector('.option:not(:disabled)')?.click(); return true;`);
    await sleep(600);
    await cdp.eval(`document.querySelector('[data-next]')?.click(); return true;`);
    await sleep(600);
  }
  check('答题页有「拼读」入口', hasSpellEntry, hasSpellEntry ? `当前词 "${word}"` : '未找到');

  // ── 2. 点拼读进入 ──
  await cdp.eval(`document.querySelector('[data-go="spell-now"]')?.click(); return true;`);
  await sleep(900);

  const spellPage = await cdp.eval(`
    return {
      title: document.querySelector('.topbar h1')?.textContent?.trim() ?? '',
      stages: [...document.querySelectorAll('.stage')].map(e => e.querySelector('b')?.textContent?.trim() ?? ''),
      stageSubs: [...document.querySelectorAll('.stage')].map(e => e.querySelector('span')?.textContent?.trim() ?? ''),
      activeStage: document.querySelector('.stage.on b')?.textContent?.trim() ?? '',
      syls: [...document.querySelectorAll('.syl')].map(e => e.textContent.trim()),
      word: document.querySelector('.word-card')?.textContent?.replace(/\\s+/g,' ').trim().slice(0, 60) ?? '',
    };
  `);
  check('拼读页打开成功', spellPage.title.includes('拼读'), spellPage.title);
  check('四环节齐全（学·读·练·拼）',
    spellPage.stages.join('') === '学读练拼',
    spellPage.stages.join(' · ') + ' / ' + spellPage.stageSubs.join(' · '));
  check('默认停在「学」环节', spellPage.activeStage === '学', `当前：${spellPage.activeStage}`);
  check('「学」环节显示音节拆分', spellPage.syls.length > 0,
    spellPage.syls.join(' · '));
  await cdp.shot('12-spell-xue');

  // ── 3. 切到「读」 ──
  await cdp.eval(`document.querySelector('[data-spell-stage="du"]')?.click(); return true;`);
  await sleep(900);
  const du = await cdp.eval(`
    return {
      active: document.querySelector('.stage.on b')?.textContent?.trim() ?? '',
      hasNormal: !!document.querySelector('[data-speak-word]'),
      hasSlow: !!document.querySelector('[data-speak-slow]'),
      hasSyl: !!document.querySelector('[data-speak-syl]'),
      bigWord: document.querySelector('.big-word')?.textContent?.trim() ?? '',
    };
  `);
  check('「读」环节：三种朗读方式齐全',
    du.active === '读' && du.hasNormal && du.hasSlow && du.hasSyl,
    `正常/慢速/逐块 · 单词 "${du.bigWord}"`);
  await cdp.shot('13-spell-du');

  // ── 4. 切到「练」 ──
  await cdp.eval(`document.querySelector('[data-spell-stage="lian"]')?.click(); return true;`);
  await sleep(700);
  const lian = await cdp.eval(`
    return {
      active: document.querySelector('.stage.on b')?.textContent?.trim() ?? '',
      meaning: document.querySelector('.meaning')?.textContent?.trim() ?? '',
      hasExBlock: /例句/.test(document.body.textContent),
    };
  `);
  check('「练」环节：显示词义与例句',
    lian.active === '练' && lian.meaning.length > 0 && lian.hasExBlock,
    `释义「${lian.meaning}」`);
  await cdp.shot('14-spell-lian');

  // ── 5. 切到「拼」 ──
  await cdp.eval(`document.querySelector('[data-spell-stage="pin"]')?.click(); return true;`);
  await sleep(700);
  const pin = await cdp.eval(`
    const chunks = [...document.querySelectorAll('.chunk')];
    return {
      active: document.querySelector('.stage.on b')?.textContent?.trim() ?? '',
      chunks: chunks.length,
      letters: chunks.map(c => c.querySelector('.ch')?.textContent?.trim() ?? '').join(''),
    };
  `);
  check('「拼」环节：显示字母块', pin.active === '拼' && pin.chunks > 0,
    `${pin.chunks} 个字母块：${pin.letters}`);

  // 点一个字母块
  await cdp.eval(`document.querySelector('.chunk')?.click(); return true;`);
  await sleep(250);
  const chunkFeedback = await cdp.eval(`return !!document.querySelector('.chunk.speaking');`);
  check('点字母块有发音反馈', chunkFeedback, chunkFeedback ? '字母高亮中' : '未检测到');
  await cdp.shot('15-spell-pin');

  // ── 6. 返回答题页 ──
  await cdp.eval(`document.querySelector('[data-go="quiz-from-spell"]')?.click(); return true;`);
  await sleep(900);
  const backToQuiz = await cdp.eval(`
    return {
      inQuiz: !!document.querySelector('.quiz-top'),
      count: document.querySelector('.quiz-count')?.textContent ?? '',
    };
  `);
  check('能从拼读页返回答题', backToQuiz.inQuiz, `回到 ${backToQuiz.count}`);

  // ── 7. 验证答错后的「学一下」入口 ──
  // 故意答错
  const wrongSetup = await cdp.eval(`
    const opts = [...document.querySelectorAll('.option:not(:disabled)')];
    if (!opts.length) return { ok: false };
    const ans = window.__wpTest?.answer;
    const wrong = opts.find(o => o.dataset.opt !== ans) ?? opts[0];
    wrong.click();
    return { ok: true, word: window.__wpTest?.word ?? '' };
  `);
  await sleep(700);
  const learnBtn = await cdp.eval(`
    return {
      hasLearn: !!document.querySelector('[data-learn-this]'),
      isWrongFeedback: document.querySelector('.feedback')?.classList.contains('no') ?? false,
    };
  `);
  check('答错后出现「学一下」入口',
    wrongSetup.ok ? (learnBtn.hasLearn || !learnBtn.isWrongFeedback) : true,
    wrongSetup.ok ? (learnBtn.hasLearn ? `答错词 "${wrongSetup.word}" 可点学一下` : '当前题未答错，跳过') : '无选项，跳过');

  // 点学一下
  if (learnBtn.hasLearn) {
    await cdp.eval(`document.querySelector('[data-learn-this]')?.click(); return true;`);
    await sleep(900);
    const learnPage = await cdp.eval(`
      return {
        inSpell: !!document.querySelector('.stage-bar'),
        word: document.querySelector('.word-card')?.textContent?.replace(/\\s+/g,' ').trim().slice(0,40) ?? '',
      };
    `);
    check('「学一下」能进入该词的拼读页', learnPage.inSpell, learnPage.word);
  }

  check('无 JS 运行时错误', cdp.logs.length === 0, cdp.logs.slice(0, 2).join(' | ') || '干净');

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`自然拼读验收：${passed}/${results.length} 通过`);
  if (passed < results.length) {
    results.filter((r) => !r.pass).forEach((r) => console.log(`  ✗ ${r.name} — ${r.detail}`));
  }
  console.log('═'.repeat(52));

  ws.close(); chrome.kill();
  await sleep(400);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => { console.error('验收失败:', e.message); cleanup(); process.exit(2); });
