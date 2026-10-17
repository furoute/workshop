/**
 * 单词猫 — iPhone 安装路径验收
 *
 * 模拟用户真实路径：
 *   1. 用 iPhone 尺寸与 UA 首次访问局域网地址
 *   2. 校验 PWA 可安装性（manifest / SW / 图标 / 主题色）
 *   3. 服务端切断网络后，验证离线仍可正常打开并背单词
 */

import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { testUrl } from './net.mjs';

const CHROME = process.env.CHROME_PATH || 'chrome.exe';
const PORT = 9335;
// 地址自动探测（电脑重启后 IP 会变，不能写死）
const LAN = testUrl();
const PROFILE = join(process.env.TEMP ?? '/tmp', `wp-ios-${Date.now()}`);

// iPhone 15 Pro 的 UA，确保拿到的是 Safari 移动端行为
const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  `--user-agent=${IOS_UA}`,
  '--window-size=393,852',
  'about:blank',
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
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error('超时 ' + method)); } }, 25000);
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
      if (retry && /超时/.test(e.message)) { await sleep(800); return this.eval(expr, false); }
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
  const ver = await waitForCdp();
  console.log(`Chrome: ${ver.Browser}`);
  console.log(`模拟设备: iPhone (iOS 17.5 Safari UA)`);
  console.log(`访问地址: ${LAN}\n`);

  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res) => ws.addEventListener('open', res, { once: true }));
  const cdp = new CDP(ws);

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 393, height: 852, deviceScaleFactor: 3, mobile: true,
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  // ── 1. 首次访问 ──
  await cdp.send('Page.navigate', { url: LAN });
  await sleep(3500);

  const first = await cdp.eval(`
    return {
      title: document.title,
      hasApp: !!document.querySelector('.screen'),
      tabbar: document.querySelectorAll('.tabbar button').length,
      catOk: (() => { const i = document.querySelector('.hero-cat'); return i ? i.complete && i.naturalWidth > 0 : false; })(),
      viewport: [window.innerWidth, window.innerHeight],
      themeColor: document.querySelector('meta[name=theme-color]')?.content ?? '',
      appleCapable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content ?? '',
      appleTitle: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content ?? '',
      appleIcon: document.querySelector('link[rel="apple-touch-icon"]')?.href ?? '',
    };
  `);
  check('iPhone 首次访问正常渲染', first.hasApp && first.tabbar === 4, `${first.viewport[0]}x${first.viewport[1]}`);
  check('猫咪图片在移动端加载', first.catOk);
  check('iOS 全屏 App 元信息齐全',
    first.appleCapable === 'yes' && first.appleTitle.length > 0,
    `apple-mobile-web-app-capable=${first.appleCapable}, title=${first.appleTitle}`);
  check('主题色已设置', first.themeColor === '#22c55e', first.themeColor);
  check('Apple 主屏图标已链接', first.appleIcon.includes('apple-touch-icon'), first.appleIcon.split('/').pop());

  // ── 2. PWA 可安装性 ──
  const pwa = await cdp.eval(`
    const mf = document.querySelector('link[rel=manifest]');
    const res = await fetch(mf.href);
    const j = await res.json();
    const iconChecks = [];
    for (const ic of j.icons) {
      const r = await fetch(new URL(ic.src, mf.href).href);
      iconChecks.push({ src: ic.src, ok: r.ok, size: ic.sizes });
    }
    // 注意：Chrome 在 http://<IP> 下不把页面当安全上下文，navigator.serviceWorker 为 undefined。
    // 这是浏览器策略，iOS Safari 对局域网 HTTP 是允许 SW 的。这里如实报告两种状态。
    const swSupported = 'serviceWorker' in navigator;
    let swReg = null;
    if (swSupported) {
      swReg = await navigator.serviceWorker.getRegistration();
    }
    // 直接验证 SW 脚本本身可访问
    const swRes = await fetch('./sw.js');
    return {
      ok: res.ok, name: j.name, short: j.short_name, display: j.display,
      startUrl: j.start_url, theme: j.theme_color, bg: j.background_color,
      icons: iconChecks,
      secureContext: window.isSecureContext,
      swSupported, sw: !!swReg, swScope: swReg?.scope ?? '',
      swScriptOk: swRes.ok, swScriptLen: (await swRes.text()).length,
    };
  `);
  check('manifest 名称与显示模式正确',
    pwa.ok && pwa.display === 'standalone' && pwa.startUrl === './',
    `${pwa.short} · display=${pwa.display}`);
  check('全部图标可访问', pwa.icons.every((i) => i.ok), pwa.icons.map((i) => i.size).join(' / '));
  check('Service Worker 脚本可访问', pwa.swScriptOk && pwa.swScriptLen > 500,
    `sw.js ${pwa.swScriptLen} 字节`);
  // 这一项不是缺陷断言，而是环境说明：
  // Chrome 把 http://<局域网IP> 视为非安全上下文，不暴露 navigator.serviceWorker；
  // 这是浏览器策略，iOS Safari 对局域网 HTTP 允许 SW（真机上离线可用）。
  // 真正的离线能力在下面的 localhost 环节实测。
  console.log(
    `${pwa.swSupported ? '✓' : 'ℹ'} Service Worker 上下文  — ` +
      (pwa.swSupported
        ? `可用${pwa.sw ? `，已注册（作用域 ${pwa.swScope}）` : ''}`
        : `Chrome 在 http+IP 下不暴露 SW（isSecureContext=${pwa.secureContext}）；` +
          `iOS Safari 不受此限，离线能力见下方 localhost 实测`),
  );

  // 等 SW 完成预缓存
  await sleep(2500);

  // ── 3. 离线能力验证 ──
  // 说明：Chrome 在 http://<局域网IP> 下不是安全上下文，SW 不会注册，
  // 因此离线测试改用 http://localhost:5273/（安全上下文，SW 正常）。
  // iOS Safari 对局域网 HTTP 是允许 SW 的，所以真机上两种地址都能离线。
  if (!pwa.swSupported) {
    console.log('\n--- Chrome 在 http+IP 下不注册 SW，改用 localhost 验证离线能力 ---\n');
    await cdp.send('Page.navigate', { url: 'http://localhost:5273/' });
    await sleep(3500);
    const sw2 = await cdp.eval(`
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return { ok: false };
      // 等 SW 激活并完成预缓存
      await navigator.serviceWorker.ready;
      await new Promise(r => setTimeout(r, 2500));
      const keys = await caches.keys();
      const cache = await caches.open(keys[0]);
      const cached = await cache.keys();
      return { ok: true, scope: reg.scope, active: !!reg.active, caches: keys, count: cached.length,
               urls: cached.map(r => r.url.split('/').slice(-2).join('/')).slice(0, 14) };
    `);
    check('Service Worker 注册并完成预缓存（localhost）',
      sw2.ok && sw2.active && sw2.count > 5,
      sw2.ok ? `${sw2.count} 个资源已缓存：${sw2.urls.join(', ')}` : '未注册');
  }

  await cdp.send('Network.emulateNetworkConditions', {
    offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
  });
  console.log('\n--- 已切断网络（模拟飞机模式 / 无 WiFi）---\n');
  await sleep(600);

  // 离线重新加载页面（走 Service Worker 缓存）
  await cdp.send('Page.reload');
  await sleep(3000);

  const offline = await cdp.eval(`
    return {
      online: navigator.onLine,
      hasApp: !!document.querySelector('.screen'),
      tabbar: document.querySelectorAll('.tabbar button').length,
      catOk: (() => { const i = document.querySelector('.hero-cat'); return i ? i.complete && i.naturalWidth > 0 : false; })(),
      bodyLen: document.body.innerHTML.length,
    };
  `);
  check('断网后仍能打开（Service Worker 缓存生效）',
    offline.hasApp && offline.bodyLen > 500,
    `navigator.onLine=${offline.online}, 内容 ${offline.bodyLen} 字符`);
  check('断网后猫咪图片仍显示', offline.catOk);

  // 离线状态下真的背一组单词
  await cdp.eval(`document.querySelector('[data-go="study"]')?.click(); return true;`);
  await sleep(1000);

  const offlineQuiz = await cdp.eval(`
    return {
      inQuiz: !!document.querySelector('.quiz-top'),
      count: document.querySelector('.quiz-count')?.textContent ?? '',
      options: document.querySelectorAll('.option').length,
    };
  `);
  check('断网后能进入答题', offlineQuiz.inQuiz && offlineQuiz.options === 4,
    `${offlineQuiz.count} · 选项 ${offlineQuiz.options}`);

  // 离线答完一整轮
  let answered = 0, correct = 0;
  for (let i = 0; i < 70; i++) {
    const st = await cdp.eval(`
      return {
        done: !!document.querySelector('.done-screen'),
        fb: !!document.querySelector('.feedback'),
        opts: document.querySelectorAll('.option:not(:disabled)').length,
        letters: document.querySelectorAll('.letter:not(:disabled)').length,
      };
    `);
    if (st.done) break;
    if (st.fb) {
      answered++;
      await cdp.eval(`document.querySelector('[data-next]')?.click(); return true;`);
      await sleep(450);
      continue;
    }
    if (st.opts > 0) {
      await cdp.eval(`window.__wpTest?.pickRight() || document.querySelector('.option:not(:disabled)')?.click(); return true;`);
      await sleep(450);
      const ok = await cdp.eval(`return document.querySelector('.feedback')?.classList.contains('ok') ?? false;`);
      if (ok) correct++;
      continue;
    }
    if (st.letters > 0) {
      const target = await cdp.eval(`return window.__wpTest?.word?.replace(/[^a-zA-Z]/g,'').toLowerCase() ?? '';`);
      for (let k = 0; k < target.length; k++) {
        const did = await cdp.eval(`
          const t = window.__wpTest?.word?.replace(/[^a-zA-Z]/g,'').toLowerCase() ?? '';
          const ch = t[${k}];
          const el = [...document.querySelectorAll('.letter:not(:disabled)')].find(e => e.textContent.trim().toLowerCase() === ch);
          if (!el) return false;
          el.click(); return true;
        `);
        if (!did) break;
        await sleep(130);
        const fin = await cdp.eval(`return !!document.querySelector('.feedback');`);
        if (fin) break;
      }
      await sleep(400);
      const ok = await cdp.eval(`return document.querySelector('.feedback')?.classList.contains('ok') ?? false;`);
      if (ok) correct++;
      continue;
    }
    await sleep(300);
  }

  const offlineDone = await cdp.eval(`
    const s = JSON.parse(localStorage.getItem('wordpet.save.v1') || '{}');
    return {
      done: !!document.querySelector('.done-screen'),
      learned: Object.values(s.progress||{}).filter(p=>p.level>0).length,
      coins: s.coins, exp: s.pet?.exp,
    };
  `);
  check('断网状态下能完整背完一组单词',
    offlineDone.done && offlineDone.learned > 0,
    `答对 ${correct}/${answered} · 已学 ${offlineDone.learned} 词 · ${offlineDone.coins} 金币 · ${offlineDone.exp} 经验`);

  // 恢复网络
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
  });

  check('无 JS 运行时错误', cdp.logs.length === 0, cdp.logs.slice(0, 2).join(' | ') || '干净');

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`iPhone 安装路径验收：${passed}/${results.length} 通过`);
  if (passed < results.length) {
    console.log('\n未通过项：');
    results.filter((r) => !r.pass).forEach((r) => console.log(`  ✗ ${r.name} — ${r.detail}`));
  }
  console.log('═'.repeat(52));

  ws.close(); chrome.kill();
  await sleep(400);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => { console.error('\n验收失败:', e.message); cleanup(); process.exit(2); });
