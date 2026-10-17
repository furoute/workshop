/**
 * 单词猫 — 无头浏览器验收脚本
 *
 * 用 Chrome DevTools Protocol 真实驱动页面：检查布局溢出、跑通答题流程、
 * 截图关键页面。不依赖 puppeteer，直接用 Node 内置 WebSocket 连 CDP。
 */

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(__dirname, '..', '_shots');
mkdirSync(SHOTS, { recursive: true });

const CHROME = process.env.CHROME_PATH || 'chrome.exe';
const PORT = 9222;
const URL_BASE = process.env.WP_URL ?? 'http://127.0.0.1:5273/';
const PROFILE = join(process.env.TEMP ?? '/tmp', `wp-cdp-${Date.now()}`);

// ── 启动 Chrome ──────────────────────────────
const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--window-size=390,844',
  'about:blank',
], { stdio: 'ignore' });

process.on('exit', () => {
  try { chrome.kill(); } catch { /* ignore */ }
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
});

/** 等待 CDP 端口就绪 */
async function waitForCdp() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return await r.json();
    } catch { /* 还没起来 */ }
    await sleep(250);
  }
  throw new Error('Chrome CDP 启动超时');
}

// ── 极简 CDP 客户端 ──────────────────────────
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP 超时: ${method}`));
        }
      }, 30000);
    });
  }

  /** 在当前页面执行 JS 并返回结果（带一次重试，规避偶发超时） */
  async eval(expr, retry = true) {
    try {
      const r = await this.send('Runtime.evaluate', {
        expression: `(async () => { ${expr} })()`,
        awaitPromise: true,
        returnByValue: true,
      });
      if (r.exceptionDetails) {
        throw new Error('页面脚本异常: ' + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails));
      }
      return r.result.value;
    } catch (e) {
      if (retry && /超时/.test(e.message)) {
        await sleep(800);
        return this.eval(expr, false);
      }
      throw e;
    }
  }

  async shot(name, opts = {}) {
    const r = await this.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: opts.full ?? false,
    });
    const buf = Buffer.from(r.data, 'base64');
    writeFileSync(join(SHOTS, `${name}.png`), buf);
    return buf.length;
  }

  /** 派发一次真实点击（按坐标）*/
  async click(x, y) {
    for (const type of ['mousePressed', 'mouseReleased']) {
      await this.send('Input.dispatchMouseEvent', {
        type, x, y, button: 'left', clickCount: 1,
      });
    }
    await sleep(120);
  }

  /** 找到元素中心坐标并点击 */
  async clickSel(sel, nth = 0) {
    const box = await this.eval(`
      const els = document.querySelectorAll(${JSON.stringify(sel)});
      const el = els[${nth}];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    `);
    if (!box) throw new Error(`找不到元素: ${sel} [${nth}]`);
    await this.click(box.x, box.y);
    return box;
  }
}

// ── 主流程 ───────────────────────────────────
const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`);
}

async function main() {
  const ver = await waitForCdp();
  console.log(`Chrome: ${ver.Browser}\n`);

  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  const cdp = new CDP(ws);

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 3, mobile: true,
  });

  // 收集控制台报错
  const errors = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown') {
      errors.push(m.params.exceptionDetails.exception?.description ?? 'unknown');
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  });

  // ── 1. 加载首页 ──
  await cdp.send('Page.navigate', { url: URL_BASE });
  await sleep(3000);

  const boot = await cdp.eval(`
    return {
      title: document.title,
      hasApp: !!document.querySelector('#app'),
      screenHTML: document.querySelector('.screen') ? document.querySelector('.screen').innerHTML.length : 0,
      tabbar: document.querySelectorAll('.tabbar button').length,
      hero: !!document.querySelector('.hero'),
      stats: document.querySelectorAll('.stat').length,
      actions: document.querySelectorAll('.action-btn').length,
      catImgOk: (() => {
        const im = document.querySelector('.hero-cat');
        return im ? im.complete && im.naturalWidth > 0 : false;
      })(),
    };
  `);
  check('页面标题正确', boot.title.includes('单词猫'), boot.title);
  check('首页渲染出内容', boot.screenHTML > 400, `${boot.screenHTML} 字符`);
  check('底部导航 4 个标签', boot.tabbar === 4, String(boot.tabbar));
  check('英雄区 + 统计卡渲染', boot.hero && boot.stats === 3);
  check('两个主按钮存在', boot.actions >= 2, String(boot.actions));
  check('猫咪图片加载成功', boot.catImgOk);

  // ── 2. 布局溢出检测（关键）──
  const layout = await cdp.eval(`
    const de = document.documentElement;
    const overflow = [];
    document.querySelectorAll('.screen *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      if (r.right > window.innerWidth + 1 || r.left < -1) {
        overflow.push({
          cls: el.className && typeof el.className === 'string' ? el.className.slice(0,40) : el.tagName,
          left: Math.round(r.left), right: Math.round(r.right),
        });
      }
    });
    return {
      innerWidth: window.innerWidth,
      docScrollW: de.scrollWidth,
      bodyScrollW: document.body.scrollWidth,
      screenW: document.querySelector('.screen')?.getBoundingClientRect().width,
      tabbarW: document.querySelector('.tabbar')?.getBoundingClientRect().width,
      overflowCount: overflow.length,
      overflow: overflow.slice(0, 6),
    };
  `);
  check(
    '无横向溢出',
    layout.docScrollW <= layout.innerWidth + 1 && layout.overflowCount === 0,
    `视口${layout.innerWidth} 文档${layout.docScrollW} screen宽${Math.round(layout.screenW ?? 0)} 溢出元素${layout.overflowCount}`,
  );
  if (layout.overflowCount) console.log('   溢出元素:', JSON.stringify(layout.overflow));

  await cdp.shot('01-home');

  // ── 3. 底部导航切换 ──
  await cdp.eval(`document.querySelectorAll('.tabbar button')[1]?.click(); return true;`); // 猫咪
  await sleep(700);
  const petPage = await cdp.eval(`
    return {
      hasStage: !!document.querySelector('.pet-stage'),
      gauges: document.querySelectorAll('.gauge').length,
      acts: document.querySelectorAll('.pet-act').length,
      hats: document.querySelectorAll('.hat').length,
      achs: document.querySelectorAll('.ach').length,
      catOk: (() => { const i = document.querySelector('.pet-cat'); return i ? i.complete && i.naturalWidth > 0 : false; })(),
    };
  `);
  check('宠物页渲染', petPage.hasStage && petPage.gauges === 3, `属性条${petPage.gauges} 互动${petPage.acts} 装扮${petPage.hats} 成就${petPage.achs}`);
  check('宠物页猫咪图加载', petPage.catOk);
  await cdp.shot('02-pet');

  // 点"摸摸它"（免费互动）
  await cdp.eval(`document.querySelector('[data-act="pet"]')?.click(); return true;`);
  await sleep(800);
  const afterPet = await cdp.eval(`
    return {
      toast: document.querySelector('.toast')?.textContent ?? '',
      mood: document.querySelector('.gauge:nth-child(3) .val')?.textContent ?? '',
    };
  `);
  check('宠物互动有反馈', afterPet.toast.length > 0, `提示「${afterPet.toast}」心情${afterPet.mood}`);

  await cdp.eval(`document.querySelectorAll('.tabbar button')[2]?.click(); return true;`); // 报告
  await sleep(700);
  const rep = await cdp.eval(`
    return {
      cells: document.querySelectorAll('.report-cell').length,
      chartCols: document.querySelectorAll('.chart .col').length,
      heatCells: document.querySelectorAll('.heat .cell').length,
      cards: document.querySelectorAll('.card').length,
    };
  `);
  check('报告页渲染', rep.cells === 4 && rep.chartCols === 7, `统计卡${rep.cells} 柱状${rep.chartCols} 热力${rep.heatCells}`);
  await cdp.shot('03-report');

  await cdp.eval(`document.querySelectorAll('.tabbar button')[3]?.click(); return true;`); // 我的
  await sleep(600);
  const me = await cdp.eval(`
    return { settings: document.querySelectorAll('.setting').length, switches: document.querySelectorAll('.switch').length };
  `);
  check('设置页渲染', me.settings >= 6 && me.switches >= 1, `设置项${me.settings} 开关${me.switches}`);
  await cdp.shot('04-me');

  // ── 4. 选教材单元 ──
  await cdp.eval(`document.querySelectorAll('.tabbar button')[0]?.click(); return true;`);
  await sleep(400);
  await cdp.eval(`document.querySelector('[data-go="pick"]')?.click(); return true;`);
  await sleep(700);
  const pick = await cdp.eval(`
    return {
      tabs: document.querySelectorAll('.book-tabs .tab').length,
      units: document.querySelectorAll('.unit').length,
      title: document.querySelector('[data-book-name]')?.textContent?.trim() ?? '',
      edition: window.__wpTest?.edition ?? '',
    };
  `);
  // 册数随版本而变：旧版 8 册，2024 新版目前只有三年级 2 册
  check('教材选择页册数正确', pick.tabs >= 2 && pick.tabs <= 8,
    `${pick.tabs} 册（版本：${pick.edition || '未知'}）· 当前册「${pick.title || '标题为空'}」`);
  check('单元列表已渲染', pick.units >= 1, `${pick.units} 个单元项`);
  await cdp.shot('05-pick');

  // 切到第二册（新版只有 2 册时切到三下；旧版切到三下）
  if (pick.tabs >= 2) {
    await cdp.eval(`document.querySelectorAll('.book-tabs .tab')[1]?.click(); return true;`);
    await sleep(700);
    const pick2 = await cdp.eval(`
      return {
        title: document.querySelector('[data-book-name]')?.textContent?.trim() ?? '',
        units: document.querySelectorAll('.unit').length,
        firstUnit: document.querySelectorAll('.unit .unit-body b')[1]?.textContent?.trim() ?? '',
      };
    `);
    check('能切换到第二册', pick2.title.length > 0,
      `${pick2.title} · ${pick2.units} 项 · 首单元「${pick2.firstUnit}」`);
  }

  // ── 5. 背单词流程 ──
  await cdp.eval(`document.querySelector('[data-go="home"]')?.click(); return true;`);
  await sleep(500);
  await cdp.eval(`document.querySelector('[data-go="study"]')?.click(); return true;`);
  await sleep(900);

  const quiz0 = await cdp.eval(`
    return {
      route: !!document.querySelector('.quiz-top'),
      mode: document.querySelector('.mode-hint')?.textContent ?? '',
      options: document.querySelectorAll('.option').length,
      count: document.querySelector('.quiz-count')?.textContent ?? '',
      hasCard: !!document.querySelector('.word-card'),
    };
  `);
  check('答题页进入成功', quiz0.route && quiz0.hasCard, `${quiz0.count} · ${quiz0.mode} · 选项${quiz0.options}`);
  await cdp.shot('06-quiz');

  // ── 6. 完整答完一轮 ──
  let answered = 0, correct = 0, rounds = 0;
  const maxRounds = 80;

  while (rounds < maxRounds) {
    rounds++;
    const st = await cdp.eval(`
      return {
        done: !!document.querySelector('.done-screen'),
        feedback: !!document.querySelector('.feedback'),
        hasOptions: document.querySelectorAll('.option').length > 0,
        hasLetters: document.querySelectorAll('.letter').length > 0,
      };
    `);

    if (st.done) break;

    // 已经作答，等反馈条上的「下一个」并点击
    if (st.feedback) {
      answered++;
      await cdp.eval(`document.querySelector('[data-next]')?.click(); return true;`);
      await sleep(550);
      continue;
    }

    if (st.hasOptions) {
      // 通过应用暴露的测试钩子点击「正确答案」，让流程验证更有意义
      const r = await cdp.eval(`
        const t = window.__wpTest;
        if (!t) return { ok: false, reason: 'no-hook' };
        const ok = t.pickRight();
        return { ok, answer: t.answer, word: t.word, mode: t.mode };
      `);
      if (!r.ok) {
        // 钩子不可用时退回点第一个
        await cdp.eval(`document.querySelector('.option:not(:disabled)')?.click(); return true;`);
      }
      await sleep(520);
      const ok = await cdp.eval(`return document.querySelector('.feedback')?.classList.contains('ok') ?? false;`);
      if (ok) correct++;
      if (rounds <= 3) console.log(`      题：${r.word ?? '?'} (${r.mode ?? '?'}) 正确答案=${r.answer ?? '?'}`);
      continue;
    }

    if (st.hasLetters) {
      // 拼写题：按目标单词的字母顺序，依次找匹配的字母块点击
      const target = await cdp.eval(`return window.__wpTest?.word?.replace(/[^a-zA-Z]/g,'').toLowerCase() ?? '';`);
      if (target) {
        for (let i = 0; i < target.length; i++) {
          const clicked = await cdp.eval(`
            const ch = ${JSON.stringify(target)}[${i}];
            const els = [...document.querySelectorAll('.letter:not(:disabled)')];
            const el = els.find(e => e.textContent.trim().toLowerCase() === ch);
            if (!el) return false;
            el.click();
            return true;
          `);
          if (!clicked) break;
          await sleep(140);
          const done = await cdp.eval(`return !!document.querySelector('.feedback');`);
          if (done) break;
        }
      } else {
        // 拿不到目标词时，随便点完触发判定
        for (let i = 0; i < 24; i++) {
          const open = await cdp.eval(`return { fb: !!document.querySelector('.feedback'), left: document.querySelectorAll('.letter:not(:disabled)').length };`);
          if (open.fb || open.left === 0) break;
          await cdp.eval(`document.querySelector('.letter:not(:disabled)').click(); return true;`);
          await sleep(120);
        }
      }
      await sleep(500);
      const ok = await cdp.eval(`return document.querySelector('.feedback')?.classList.contains('ok') ?? false;`);
      if (ok) correct++;
      continue;
    }

    // 意外状态：兜底等待
    await sleep(300);
  }

  const final = await cdp.eval(`
    const save = JSON.parse(localStorage.getItem('wordpet.save.v1') || '{}');
    return {
      done: !!document.querySelector('.done-screen'),
      doneTitle: document.querySelector('.done-screen h2')?.textContent ?? '',
      rewards: [...document.querySelectorAll('.reward b')].map(e => e.textContent),
      coins: save.coins ?? 0,
      learned: Object.values(save.progress || {}).filter(p => p.level > 0).length,
      checkins: Object.keys(save.checkins || {}).length,
      exp: save.pet?.exp ?? 0,
      historyLen: (save.history || []).length,
      streak: save.streakDays ?? 0,
    };
  `);
  check('完成整轮答题并进入结算页', final.done, `标题「${final.doneTitle}」奖励${JSON.stringify(final.rewards)}`);
  check('正确作答后学习记录写入存档', final.learned > 0 && final.historyLen > 0,
    `已学 ${final.learned} 词 · 记录 ${final.historyLen} 条 · 答对 ${correct}/${answered}`);
  check('答题正确率符合预期（应能答对）', correct > 0, `答对 ${correct} 题`);
  check('金币已累计', final.coins > 0, `${final.coins} 枚`);
  check('宠物经验已增长', final.exp > 0, `${final.exp} 经验`);
  check('打卡已记录', final.checkins >= 1, `${final.checkins} 天 · 连续${final.streak}天`);
  await cdp.shot('07-done');

  console.log(`   （本轮共作答 ${answered} 题，其中答对 ${correct} 题，循环 ${rounds} 次）`);

  // ── 7. 数据持久化：刷新后仍在 ──
  await cdp.send('Page.reload');
  await sleep(2600);
  const after = await cdp.eval(`
    const save = JSON.parse(localStorage.getItem('wordpet.save.v1') || '{}');
    const learnedEl = document.querySelector('.stat b')?.textContent ?? '';
    return { learned: Object.values(save.progress||{}).filter(p=>p.level>0).length, shownLearned: learnedEl, coins: save.coins };
  `);
  check('刷新后数据仍在（本地存档）', after.learned > 0, `已学 ${after.learned} 词，首页显示 ${after.shownLearned}`);
  // ── 8. PWA 资源 ──
  const pwa = await cdp.eval(`
    const mf = document.querySelector('link[rel=manifest]');
    const ico = document.querySelector('link[rel="apple-touch-icon"]');
    const res = await fetch(mf ? mf.href : './manifest.webmanifest');
    const json = res.ok ? await res.json() : null;
    return {
      hasManifest: !!mf,
      manifestOk: res.ok,
      name: json?.name ?? '',
      display: json?.display ?? '',
      icons: json?.icons?.length ?? 0,
      hasAppleIcon: !!ico,
      appleIconOk: ico ? (await fetch(ico.href)).ok : false,
    };
  `);
  check('manifest 可访问且配置正确', pwa.manifestOk && pwa.display === 'standalone' && pwa.icons >= 3,
    `${pwa.name} · display=${pwa.display} · ${pwa.icons} 个图标`);
  check('Apple 主屏图标可用', pwa.hasAppleIcon && pwa.appleIconOk);

  // ── 9. 控制台无报错 ──
  const realErrors = errors.filter((e) => !/favicon|sw\.js|Service Worker/i.test(e));
  check('无 JS 运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | ') || '干净');

  // ── 10. 词库规模 ──
  const data = await cdp.eval(`
    const save = JSON.parse(localStorage.getItem('wordpet.save.v1') || '{}');
    return { keys: Object.keys(save) };
  `);
  check('存档字段完整', data.keys.length >= 10, data.keys.join(','));

  // ── 汇总 ──
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`验收结果：${passed}/${results.length} 通过`);
  if (passed < results.length) {
    console.log('\n未通过项：');
    results.filter((r) => !r.pass).forEach((r) => console.log(`  ✗ ${r.name} — ${r.detail}`));
  }
  console.log('═'.repeat(52));
  console.log(`截图已保存到 ${SHOTS}`);

  ws.close();
  chrome.kill();
  await sleep(400);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error('\n验收脚本失败:', e.message);
  try { chrome.kill(); } catch { /* ignore */ }
  process.exit(2);
});
