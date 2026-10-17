/**
 * 单词猫 — 答题循环诊断（简化版）
 *
 * 直接在页面内用 element.click() 驱动，避免坐标换算与滚动带来的问题。
 * 目的是定位「答完一题后无法推进到下一题」的真实原因。
 */

import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = process.env.CHROME_PATH || 'chrome.exe';
const PORT = 9334;
const URL_BASE = process.env.WP_URL ?? 'http://127.0.0.1:5273/';
const PROFILE = join(process.env.TEMP ?? '/tmp', `wp-diag2-${Date.now()}`);

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
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return r.json();
    } catch { /* wait */ }
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
      } else if (m.method === 'Runtime.consoleAPICalled') {
        this.logs.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description).join(' '));
      } else if (m.method === 'Runtime.exceptionThrown') {
        this.logs.push('[异常] ' + (m.params.exceptionDetails.exception?.description ?? JSON.stringify(m.params.exceptionDetails)));
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej });
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error('超时 ' + method)); } }, 15000);
    });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', {
      expression: `(() => { ${expr} })()`, returnByValue: true,
    });
    if (r.exceptionDetails) {
      throw new Error('页面异常: ' + (r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails)));
    }
    return r.result.value;
  }
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
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cdp.send('Page.navigate', { url: URL_BASE });
  await sleep(2500);

  console.log('=== 答题流程诊断（页面内点击）===\n');

  // 进入答题
  await cdp.eval(`document.querySelector('[data-go="study"]').click(); return true;`);
  await sleep(900);

  for (let step = 0; step < 14; step++) {
    const st = await cdp.eval(`
      return {
        count: document.querySelector('.quiz-count')?.textContent ?? '',
        mode: (document.querySelector('.mode-hint')?.textContent ?? '').slice(0,10),
        options: document.querySelectorAll('.option:not(:disabled)').length,
        letters: document.querySelectorAll('.letter:not(:disabled)').length,
        hasFeedback: !!document.querySelector('.feedback'),
        nextLabel: document.querySelector('[data-next]')?.textContent?.trim() ?? '',
        done: !!document.querySelector('.done-screen'),
      };
    `);
    console.log(`[${step}] 进度=${st.count} 题型=${st.mode} 可选项=${st.options} 可点字母=${st.letters} 反馈条=${st.hasFeedback} 下一题按钮="${st.nextLabel}" 结算=${st.done}`);

    if (st.done) { console.log('\n✓ 成功到达结算页'); break; }

    if (st.hasFeedback) {
      const clicked = await cdp.eval(`
        const b = document.querySelector('[data-next]');
        if (!b) return 'no-button';
        b.click();
        return 'clicked';
      `);
      console.log(`     -> 点「下一个」: ${clicked}`);
      await sleep(700);
      continue;
    }

    if (st.options > 0) {
      await cdp.eval(`document.querySelector('.option:not(:disabled)').click(); return true;`);
      console.log('     -> 点了第一个选项');
      await sleep(700);
      continue;
    }

    if (st.letters > 0) {
      for (let i = 0; i < 20; i++) {
        const open = await cdp.eval(`return { fb: !!document.querySelector('.feedback'), left: document.querySelectorAll('.letter:not(:disabled)').length };`);
        if (open.fb || open.left === 0) break;
        await cdp.eval(`document.querySelector('.letter:not(:disabled)').click(); return true;`);
        await sleep(150);
      }
      await sleep(500);
      continue;
    }

    console.log('     -> 未知状态，等待');
    await sleep(500);
  }

  const save = await cdp.eval(`
    const s = JSON.parse(localStorage.getItem('wordpet.save.v1') || '{}');
    return { history: (s.history||[]).length, learned: Object.values(s.progress||{}).filter(p=>p.level>0).length, coins: s.coins, exp: s.pet?.exp };
  `);
  console.log('\n存档:', JSON.stringify(save));

  console.log('\n页面控制台:');
  if (cdp.logs.length) cdp.logs.slice(0, 25).forEach((l) => console.log('  ' + l));
  else console.log('  （无输出，干净）');

  ws.close(); chrome.kill();
  await sleep(300);
  process.exit(0);
}

main().catch((e) => { console.error('诊断失败:', e.message); cleanup(); process.exit(2); });
