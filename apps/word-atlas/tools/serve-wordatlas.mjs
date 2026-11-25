/**
 * 词光 Word Atlas — 一键启动
 *
 * 干三件事：构建（如需要）→ 探测当前局域网 IP → 打印地址 + 二维码 → 起服务
 *
 * 关键：IP 每次开机都可能变，所以绝不缓存、绝不写死，每次启动都重新探测。
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PORT = Number(process.env.PORT ?? 4173);

/** 列出局域网 IPv4，家用网段优先，跳过虚拟网卡 */
function lanIPs() {
  const out = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      if (/vmware|virtualbox|vethernet|hyper-v|wsl|loopback|bluetooth|tap|tun/i.test(name)) continue;
      out.push({ name, address: a.address });
    }
  }
  const score = (ip) => {
    const [a, b] = ip.split('.').map(Number);
    return (a === 192 && b === 168) ? 0
      : a === 10 ? 1
        : (a === 172 && b >= 16 && b <= 31) ? 2
          : 3;
  };
  return out.sort((a, b) => score(a.address) - score(b.address));
}

function primaryIP() {
  return lanIPs()[0]?.address ?? '127.0.0.1';
}

const line = '─'.repeat(54);

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
    console.log('   （未装 qrcode-terminal，跳过二维码）');
  }
}

async function portInUse(port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1500) });
    return r.status > 0;
  } catch {
    return false;
  }
}

async function main() {
  console.log('');
  console.log('  ' + '═'.repeat(50));
  console.log('     词光 Word Atlas — 一词一画，点亮雅思');
  console.log('  ' + '═'.repeat(50));
  console.log('');

  if (await portInUse(PORT)) {
    const ip = primaryIP();
    const url = `http://${ip}:${PORT}`;
    console.log('  服务已在运行，直接用这个地址：');
    console.log('');
    console.log('   📱 ' + url);
    console.log('');
    await printQR(url);
    console.log('');
    console.log('  ' + line);
    return;
  }

  // 有 dist 就直接用，没有就先构建
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
    console.log('  [1/2] 首次运行，构建中（约 20 秒）...');
    await new Promise((resolve, reject) => {
      const p = spawn('npm', ['run', 'build'], {
        cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32',
      });
      p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error('build 失败'))));
      p.on('error', reject);
    });
  } else {
    console.log('  [1/2] 构建产物已就绪（跳过构建）');
  }

  console.log('  [2/2] 探测当前地址并启动服务...');
  console.log('');

  const ip = primaryIP();
  const url = `http://${ip}:${PORT}`;

  console.log('  ' + '═'.repeat(50));
  console.log('');
  console.log('   📱 手机上这样打开：');
  console.log('');
  console.log('        ' + url);
  console.log('');
  console.log('   打开后点「分享」→「添加到主屏幕」，就成了 App');
  console.log('');
  await printQR(url);
  console.log('');
  console.log('  ' + line);
  console.log('  ⚠ 这个窗口不要关，关了服务就停');
  console.log('  ' + line);
  console.log('');

  // 在本进程内起 vite preview，避免子进程/shell 转义问题
  const { preview } = await import('vite');
  await preview({
    root: ROOT,
    base: './',
    preview: { host: true, port: PORT, strictPort: true },
    configFile: join(ROOT, 'vite.config.ts'),
  });
}

main().catch((e) => {
  console.error('');
  console.error('  启动失败：', e.message);
  console.error('');
  process.exitCode = 1;
});
