/**
 * 单词猫 — 共享工具：局域网地址探测
 *
 * 电脑重启或路由器重连后 IP 会变，所以任何地方都不能写死地址。
 * 所有脚本、验收、启动器都通过这里拿当前地址。
 */

import { networkInterfaces } from 'node:os';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/** 服务端口（与 vite.config.ts 保持一致） */
export const PORT = Number(process.env.PORT ?? 5273);

/**
 * 列出本机所有局域网 IPv4 地址，按「最可能是家用网段」排序。
 * @returns {{ name: string, address: string }[]}
 */
export function lanIPs() {
  const out = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      // 跳过虚拟网卡（VMware / VirtualBox / WSL / Hyper-V）
      if (/vmware|virtualbox|vethernet|hyper-v|wsl|loopback|bluetooth/i.test(name)) continue;
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

/** 最可能可用的那个地址（找不到时回退 127.0.0.1） */
export function primaryIP() {
  return lanIPs()[0]?.address ?? '127.0.0.1';
}

/** 完整的访问地址，如 http://<host-ip>:5273 */
export function baseUrl() {
  return `http://${primaryIP()}:${PORT}`;
}

/**
 * 供验收脚本使用：优先环境变量，其次从运行中的服务探测，
 * 最后回退到本机探测的地址。
 */
export function testUrl() {
  if (process.env.WP_URL) return process.env.WP_URL;
  if (process.env.WP_LAN) return process.env.WP_LAN;
  return baseUrl() + '/';
}

export { ROOT };
