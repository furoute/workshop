/**
 * 词库自检脚本
 *
 * 用法：node tools/vocab-check.mjs [--json]
 *
 * 检查项：
 *  1. 每册词数 vs 参考词表词数（覆盖率）
 *  2. 同一册同一单元内是否有重复 en
 *  3. 全库 id 是否唯一
 *  4. syl 拼接去空格/连字符/撇号后能否还原 en
 *  5. cn 长度是否超过 20 个汉字
 *  6. 缺失词清单
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { register } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const REF_PATH = process.env.WORDPET_REFERENCE || 'reference/pep_primary_app_vocab.json';

const BOOK_MAP = {
  'pep-primary-g3-s1': 'pep3a',
  'pep-primary-g3-s2': 'pep3b',
  'pep-primary-g4-s1': 'pep4a',
  'pep-primary-g4-s2': 'pep4b',
  'pep-primary-g5-s1': 'pep5a',
  'pep-primary-g5-s2': 'pep5b',
  'pep-primary-g6-s1': 'pep6a',
  'pep-primary-g6-s2': 'pep6b',
};

// ── 载入目标词库：把 TS 源文件里的 w(...) 调用抽出来解析 ──
// 直接 import TS 需要转译，这里用更稳的方式：正则提取 w() 调用的参数。
const src = readFileSync(join(ROOT, 'src/data/pep.ts'), 'utf8');

/** 把一行 w(...) 的参数按顶层逗号切开（尊重引号与方括号） */
function splitArgs(s) {
  const out = [];
  let cur = '';
  let depth = 0;
  let quote = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      cur += c;
      if (c === '\\') { cur += s[++i]; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') { quote = c; cur += c; continue; }
    if (c === '[' || c === '(') { depth++; cur += c; continue; }
    if (c === ']' || c === ')') { depth--; cur += c; continue; }
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** 解析一个字面量参数为 JS 值 */
function lit(tok) {
  if (tok == null) return undefined;
  tok = tok.trim();
  if (tok.startsWith("'") || tok.startsWith('"')) {
    const q = tok[0];
    let out = '';
    for (let i = 1; i < tok.length - 1; i++) {
      if (tok[i] === '\\') { out += tok[++i]; continue; }
      out += tok[i];
    }
    return out;
  }
  if (tok.startsWith('[')) {
    // 注意：不能复用 splitArgs——它把 '[' 视为 depth++，会忽略内层逗号。
    const inner = tok.slice(1, -1).trim();
    if (!inner) return [];
    const parts = [];
    let cur = '';
    let q = null;
    for (let i = 0; i < inner.length; i++) {
      const c = inner[i];
      if (q) {
        cur += c;
        if (c === '\\') { cur += inner[++i]; continue; }
        if (c === q) q = null;
        continue;
      }
      if (c === "'" || c === '"') { q = c; cur += c; continue; }
      if (c === ',') { parts.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts.map((x) => lit(x));
  }
  return tok; // 数字或裸标识符
}

const words = [];
const re = /w\(\s*((?:[^()]|\([^()]*\))*)\)\s*,?/g;
let m;
while ((m = re.exec(src))) {
  const args = splitArgs(m[1]);
  if (args.length < 6) continue;
  const [book, unit, en, ph, cn, syl, ex, exCn] = args;
  // 跳过函数签名 function w(book: BookId, ...)
  if (String(book).includes(':') || !/^\d+$/.test(String(lit(unit) ?? ''))) continue;
  words.push({
    book: lit(book),
    unit: Number(lit(unit)),
    en: lit(en),
    ph: lit(ph),
    cn: lit(cn),
    syl: lit(syl),
    ex: lit(ex),
    exCn: lit(exCn),
    line: src.slice(0, m.index).split('\n').length,
  });
}

// ── 参考词表 ──
const ref = JSON.parse(readFileSync(REF_PATH, 'utf8'));

/** 归一化：小写、去掉空格/连字符/撇号/点 */
const norm = (s) => String(s).toLowerCase().replace(/[\s\-'’.]/g, '');

const byBook = new Map();
for (const wd of words) {
  if (!byBook.has(wd.book)) byBook.set(wd.book, []);
  byBook.get(wd.book).push(wd);
}

const problems = { dupUnit: [], dupId: [], syl: [], cn: [], ph: [], missingEx: 0 };
const report = [];

for (const b of ref.books) {
  const bid = BOOK_MAP[b.id];
  const mine = byBook.get(bid) ?? [];
  const mineSet = new Set(mine.map((x) => norm(x.en)));
  const refUniq = [];
  const seen = new Set();
  for (const r of b.words) {
    const k = norm(r.spelling);
    if (seen.has(k)) continue;
    seen.add(k);
    refUniq.push(r);
  }
  const missing = refUniq.filter((r) => !mineSet.has(norm(r.spelling)));
  const covered = refUniq.length - missing.length;
  const rate = Math.round((covered / refUniq.length) * 1000) / 10;
  report.push({
    book: bid,
    name: b.name,
    mine: mine.length,
    ref: refUniq.length,
    refRaw: b.words.length,
    covered,
    rate,
    missing: missing.map((x) => x.spelling),
  });
}

// 重复检查
for (const [bid, list] of byBook) {
  const u = new Map();
  for (const wd of list) {
    const key = `${wd.unit}::${norm(wd.en)}`;
    if (u.has(key)) {
      problems.dupUnit.push(`${bid} u${wd.unit} "${wd.en}"（行 ${u.get(key)} 与 ${wd.line}）`);
    } else u.set(key, wd.line);
  }
}
// id 重复
{
  const ids = new Map();
  for (const wd of words) {
    const id = `${wd.book}-u${wd.unit}-${String(wd.en).replace(/[^a-z0-9]/gi, '').toLowerCase()}`;
    if (ids.has(id)) problems.dupId.push(`${id}（行 ${ids.get(id)} 与 ${wd.line}）`);
    else ids.set(id, wd.line);
  }
}
// syl 还原
for (const wd of words) {
  if (!wd.syl || !wd.syl.length) { problems.syl.push(`无 syl: ${wd.book} ${wd.en}`); continue; }
  const joined = norm(wd.syl.join(''));
  const target = norm(wd.en);
  if (joined !== target) {
    problems.syl.push(`${wd.book} "${wd.en}" -> [${wd.syl.join('|')}] 还原为 "${joined}"`);
  }
}
// cn 长度
for (const wd of words) {
  const han = (String(wd.cn).match(/[\u4e00-\u9fff]/g) ?? []).length;
  if (han > 20) problems.cn.push(`${wd.book} "${wd.en}" cn="${wd.cn}" (${han} 汉字)`);
}
// 音标缺失（仅单词，词组允许空）
for (const wd of words) {
  if (!wd.ph) problems.ph.push(`${wd.book} "${wd.en}"`);
}

// 未加例句的新词统计（仅提示）
for (const wd of words) if (!wd.ex) problems.missingEx++;

const totalMine = words.length;
const totalRef = report.reduce((n, r) => n + r.ref, 0);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ report, problems, totalMine, totalRef }, null, 2));
} else {
  console.log('='.repeat(72));
  console.log('词库自检报告');
  console.log('='.repeat(72));
  console.log('');
  console.log('【1】各册词数与覆盖率');
  console.log('-'.repeat(72));
  console.log('册别    精编库   参考词表   覆盖   覆盖率    缺失');
  let totalMissing = 0;
  for (const r of report) {
    totalMissing += r.missing.length;
    console.log(
      `${r.book.padEnd(7)} ${String(r.mine).padStart(6)} ${String(r.ref).padStart(10)} ` +
      `${String(r.covered).padStart(6)} ${(r.rate + '%').padStart(8)} ${String(r.missing.length).padStart(7)}`,
    );
  }
  console.log('-'.repeat(72));
  console.log(
    `合计    ${String(totalMine).padStart(6)} ${String(totalRef).padStart(10)} ` +
    `${String(totalRef - totalMissing).padStart(6)} ${(((totalRef - totalMissing) / totalRef * 100).toFixed(1) + '%').padStart(8)} ${String(totalMissing).padStart(7)}`,
  );
  console.log('');
  for (const r of report) {
    if (!r.missing.length) continue;
    console.log(`  ${r.book} 缺失(${r.missing.length})：${r.missing.join(' | ')}`);
  }
  console.log('');
  console.log('【2】同册同单元重复 en');
  console.log('-'.repeat(72));
  console.log(problems.dupUnit.length ? problems.dupUnit.map((x) => '  ✗ ' + x).join('\n') : '  ✓ 无重复');
  console.log('');
  console.log('【3】全库 id 唯一性');
  console.log('-'.repeat(72));
  console.log(problems.dupId.length ? problems.dupId.map((x) => '  ✗ ' + x).join('\n') : '  ✓ 全部唯一');
  console.log('');
  console.log('【4】syl 拼接还原 en');
  console.log('-'.repeat(72));
  console.log(problems.syl.length ? problems.syl.map((x) => '  ✗ ' + x).join('\n') : '  ✓ 全部可还原');
  console.log('');
  console.log('【5】cn 释义长度（>20 汉字报警）');
  console.log('-'.repeat(72));
  console.log(problems.cn.length ? problems.cn.map((x) => '  ✗ ' + x).join('\n') : '  ✓ 全部 ≤20 汉字');
  console.log('');
  console.log('【6】音标缺失');
  console.log('-'.repeat(72));
  console.log(problems.ph.length ? problems.ph.map((x) => '  ! ' + x).join('\n') : '  ✓ 全部有音标');
  console.log('');
  console.log(`【7】无例句词条：${problems.missingEx} / ${totalMine}`);
  console.log('');
  const fail = problems.dupUnit.length + problems.dupId.length + problems.syl.length + problems.cn.length;
  console.log(fail === 0 ? '结论：结构检查全部通过 ✓' : `结论：${fail} 项结构问题 ✗`);
}
