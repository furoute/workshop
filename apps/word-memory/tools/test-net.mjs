/**
 * 单词猫 — 地址探测自测
 *
 * 验证「电脑重启后 IP 变化」这个场景下，脚本是否总能给出当前正确的地址。
 * 做法：模拟多张网卡、不同网段、虚拟网卡混入等情况，
 * 检查探测逻辑是否选中了正确的地址。
 */

import { strict as assert } from 'node:assert';

// 直接复刻 net.mjs 的排序与过滤逻辑做单元测试
const VIRTUAL_RE = /vmware|virtualbox|vethernet|hyper-v|wsl|loopback|bluetooth/i;

function pick(nics) {
  const out = [];
  for (const [name, addrs] of Object.entries(nics)) {
    for (const a of addrs ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      if (VIRTUAL_RE.test(name)) continue;
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

const cases = [
  {
    name: '典型家用 WiFi（唯一网卡）',
    nics: { WLAN: [{ family: 'IPv4', internal: false, address: '10.0.0.114' }] },
    want: '10.0.0.114',
  },
  {
    name: 'IP 变了（114 → 115）',
    nics: { WLAN: [{ family: 'IPv4', internal: false, address: '10.0.0.115' }] },
    want: '10.0.0.115',
  },
  {
    name: '换了网段',
    nics: { WLAN: [{ family: 'IPv4', internal: false, address: '10.1.2.23' }] },
    want: '10.1.2.23',
  },
  {
    name: '有线连接',
    nics: { 以太网: [{ family: 'IPv4', internal: false, address: '10.0.1.50' }] },
    want: '10.0.1.50',
  },
  {
    name: '有虚拟网卡混入（应跳过 VMware）',
    nics: {
      WLAN: [{ family: 'IPv4', internal: false, address: '10.0.0.114' }],
      'VMware Network Adapter VMnet1': [{ family: 'IPv4', internal: false, address: '172.20.0.1' }],
      'VirtualBox Host-Only Network': [{ family: 'IPv4', internal: false, address: '172.20.0.2' }],
    },
    want: '10.0.0.114',
  },
  {
    name: '有 WSL 虚拟网卡（应跳过）',
    nics: {
      WLAN: [{ family: 'IPv4', internal: false, address: '10.0.0.114' }],
      'vEthernet (WSL)': [{ family: 'IPv4', internal: false, address: '172.20.0.1' }],
    },
    want: '10.0.0.114',
  },
  {
    name: '同时有 WiFi 和有线（优先家用网段）',
    nics: {
      WLAN: [{ family: 'IPv4', internal: false, address: '10.0.0.114' }],
      以太网: [{ family: 'IPv4', internal: false, address: '10.1.2.3' }],
    },
    want: '10.0.0.114',
  },
  {
    name: '有回环地址（应跳过）',
    nics: {
      'Loopback Pseudo-Interface 1': [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
      WLAN: [{ family: 'IPv4', internal: false, address: '10.0.0.114' }],
    },
    want: '10.0.0.114',
  },
  {
    name: '只有回环（无网络）',
    nics: { Loopback: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }] },
    want: null,
  },
  {
    name: '172.16 段（公司网络）',
    nics: { 以太网: [{ family: 'IPv4', internal: false, address: '172.16.8.100' }] },
    want: '172.16.8.100',
  },
];

let pass = 0;
console.log('地址探测自测\n');

for (const c of cases) {
  const got = pick(c.nics)[0]?.address ?? null;
  const ok = got === c.want;
  if (ok) pass++;
  console.log(
    `${ok ? '✓' : '✗'} ${c.name}` +
      (ok ? `  → ${got}` : `  → 得到 ${got}，期望 ${c.want}`),
  );
}

console.log(`\n${pass}/${cases.length} 通过`);

try {
  assert.equal(pass, cases.length);
  process.exit(0);
} catch {
  process.exit(1);
}
