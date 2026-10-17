/**
 * 单词猫 — 一键启动
 *
 * 自动完成：构建 → 找出「当前」局域网 IP → 打印地址和二维码 → 启动服务
 *
 * 用法：双击「启动单词猫.bat」或运行 pnpm serve
 *
 * 注意：电脑重启 / 路由器重连后 IP 会变，所以每次启动都重新探测，
 *       绝不缓存也不写死地址。
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lanIPs, PORT } from './net.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    // Windows 上 pnpm 是 .cmd 批处理，Node 24 不允许直接 spawn .cmd，
    // 必须交给 shell 执行（这是 cmd.exe 自己的机制，不是命令注入面）。
    const p = spawn(cmd, args, {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...opts,
    });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} 退出码 ${code}`))));
    p.on('error', reject);
  });
}

/**
 * 直接在当前进程里以编程方式启动 vite preview。
 * 不走子进程，因此完全没有 shell / .cmd / 路径转义的问题。
 */
async function startPreview(port) {
  const { preview } = await import('vite');
  const server = await preview({
    root: ROOT,
    base: './',
    preview: { host: true, port, strictPort: true },
    configFile: join(ROOT, 'vite.config.ts'),
  });
  return server;
}

/** 检查端口是否已被占用（已有服务在跑） */
async function portInUse(port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1500) });
    return r.status > 0;
  } catch {
    return false;
  }
}

const line = '─'.repeat(54);

/** 用终端二维码展示地址（未安装组件时静默跳过） */
async function printQR(url) {
  try {
    const qrcode = await import('qrcode-terminal');
    console.log('   或直接扫码：');
    console.log('');
    await new Promise((resolve) => {
      qrcode.default.generate(url, { small: true }, (q) => {
        console.log(q.split('\n').map((l) => '   ' + l).join('\n'));
        resolve();
      });
    });
  } catch {
    // 没装也不影响使用
  }
}

async function main() {
  console.log('');
  console.log('  ' + '═'.repeat(50));
  console.log('     单词猫 — 小学英语背单词');
  console.log('  ' + '═'.repeat(50));
  console.log('');

  // 0. 端口已被占用 → 说明服务已经在跑，直接报地址即可
  if (await portInUse(PORT)) {
    const ips = lanIPs();
    const primary = ips[0]?.address ?? '127.0.0.1';
    console.log('  ℹ️  服务已经在运行了，不用重复启动。');
    console.log('');
    console.log('  📱 在 iPhone / iPad 上用 Safari 打开：');
    console.log('');
    console.log(`        http://${primary}:${PORT}`);
    console.log('');
    await printQR(`http://${primary}:${PORT}`);
    console.log('  ' + '═'.repeat(50));
    console.log('');
    console.log('  如果手机打不开，请检查：');
    console.log('    1. 手机和电脑连的是同一个 WiFi 吗');
    console.log('    2. 电脑的 IP 是不是变了（上面显示的就是当前地址）');
    console.log('');
    return;
  }

  // 1. 依赖
  if (!existsSync(join(ROOT, 'node_modules'))) {
    console.log('  [1/3] 首次运行，安装依赖（可能要几分钟）...');
    await run('pnpm', ['install']);
  } else {
    console.log('  [1/3] 依赖已就绪');
  }

  // 2. 构建（直接用 vite 的 build API，不起子进程）
  console.log('  [2/3] 构建中...');
  try {
    const { build } = await import('vite');
    await build({
      root: ROOT,
      configFile: join(ROOT, 'vite.config.ts'),
      logLevel: 'warn',
    });
    console.log('        构建完成');
  } catch (e) {
    console.error('\n  ✗ 构建失败：');
    console.error(String(e.message ?? e).slice(-2000));
    process.exit(1);
  }

  // 3. 获取地址（每次启动都重新探测，因为重启后 IP 可能变）
  console.log('  [3/3] 正在获取本机当前地址...\n');
  const ips = lanIPs();

  if (!ips.length) {
    console.log('  ⚠️  没有找到局域网地址！');
    console.log('      请确认电脑已连接 WiFi 或网线，然后重新运行。\n');
  }

  const primary = ips[0]?.address ?? '127.0.0.1';
  const url = `http://${primary}:${PORT}`;

  console.log('  ' + '═'.repeat(50));
  console.log('');
  console.log('   📱 在 iPhone / iPad 上用 Safari 打开：');
  console.log('');
  console.log(`        ${url}`);
  console.log('');
  console.log('   打开后点「分享」→「添加到主屏幕」');
  console.log('   就会变成一个真正的 App，可离线使用');
  console.log('');

  // 二维码
  await printQR(url);

  if (ips.length > 1) {
    console.log('   其他可用地址（上面那个不行时试试）：');
    ips.slice(1).forEach((ip) => console.log(`     http://${ip.address}:${PORT}  (${ip.name})`));
    console.log('');
  }

  console.log('  ' + '═'.repeat(50));
  console.log('');
  console.log('   ⚠️  这个窗口不要关闭 —— 关掉服务就停了');
  console.log('');
  console.log('   💡 电脑重启后 IP 可能变化（比如 114 变成 115）：');
  console.log('      重新双击「启动单词猫.bat」，看这里显示的新地址即可。');
  console.log('      如果手机主屏幕上加了图标，IP 变了要删掉重新添加一次。');
  console.log('      学习记录不会丢，数据存在手机里。');
  console.log('');

  // 4. 启动（直接调 vite API，不起子进程）
  try {
    const server = await startPreview(PORT);
    const actual = server.resolvedUrls?.network?.[0] ?? url;
    console.log(`  ✅ 服务已启动：${actual}`);
    console.log('');
    console.log('  现在可以用手机打开上面的地址了。');
    console.log('');
  } catch (e) {
    console.error('');
    console.error(`  ✗ 启动失败：${e.message}`);
    console.error('');
    if (/already in use|EADDRINUSE/i.test(String(e.message))) {
      console.error('  端口 5273 被占用了，可能有另一个窗口已经在运行。');
      console.error('  关掉其他「单词猫」窗口后重试。');
    }
    console.error('');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('\n启动失败：', e.message);
  console.error('请把上面的错误信息截图发给开发者。');
  process.exit(1);
});
