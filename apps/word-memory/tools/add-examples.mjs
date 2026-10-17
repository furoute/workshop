/**
 * 单词猫 — 为 2024 新版三年级词库补例句
 *
 * 新版调研只拿到「单词 / 音标 / 释义」，没有例句。
 * 本脚本为三上、三下 221 个词各写一句贴合小学生生活的简单例句。
 *
 * 用法：
 *   node tools/add-examples.mjs           写入 pep-2024.ts
 *   node tools/add-examples.mjs --check   只报告覆盖情况
 *
 * 设计原则：
 *   - 例句 4-9 个词，用词控制在小学范围内
 *   - 尽量用上该单词本身，并贴合对应单元主题
 *   - 例句与该词的教材单元语境一致（如 U1 Making friends 用打招呼场景）
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXAMPLES } from './examples-data.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'src', 'data', 'pep-2024.ts');
const checkOnly = process.argv.includes('--check');

let src = readFileSync(FILE, 'utf8');

// 匹配形如：w('pep3a', 1, 'nice', 'naɪs', '令人愉快的；友好的', ['nice']),
// 注意单词本身可能含转义单引号（如 o\'clock）
const RE = /w\('(pep\w+)',\s*(\d+),\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)',\s*(\[[^\]]*\])(\)?,)/g;

let total = 0;
let patched = 0;
const missing = [];
const seen = new Set();

src = src.replace(RE, (full, book, unit, en, ph, cn, syl, tail) => {
  total++;
  // 还原转义，用于查例句表
  const raw = en.replace(/\\'/g, "'");
  const key = raw.toLowerCase();
  seen.add(key);

  const ex = EXAMPLES[key];
  if (!ex) {
    missing.push(`${book} u${unit} ${raw}`);
    return full;
  }

  patched++;
  // tail 目前是 '),' 或 ')'，需要插入 ex, exCn
  const closing = tail.endsWith(',') ? '),' : ')';
  const exEsc = ex[0].replace(/'/g, "\\'");
  const cnEsc = ex[1].replace(/'/g, "\\'");
  return `w('${book}', ${unit}, '${en}', '${ph}', '${cn}', ${syl}, '${exEsc}', '${cnEsc}'${closing}`;
});

console.log(`词库总数：${total}`);
console.log(`已补例句：${patched}`);
console.log(`覆盖词条：${seen.size}`);

if (missing.length) {
  console.log(`\n缺少例句（${missing.length}）：`);
  missing.slice(0, 40).forEach((m) => console.log(`  · ${m}`));
  if (missing.length > 40) console.log(`  …还有 ${missing.length - 40} 条`);
}

// 检查例句表里有没有多余的、词库里不存在的词
const extra = Object.keys(EXAMPLES).filter((k) => !seen.has(k));
if (extra.length) {
  console.log(`\n例句表中有、词库中无（${extra.length}）：`);
  console.log('  ' + extra.join(', '));
}

if (checkOnly) {
  console.log('\n（--check 模式，未写入）');
  process.exit(missing.length ? 1 : 0);
}

if (missing.length) {
  console.error('\n✗ 仍有词条缺例句，未写入文件。请补全 EXAMPLES 后重试。');
  process.exit(1);
}

writeFileSync(FILE, src, 'utf8');
console.log(`\n✓ 已写入 ${FILE}`);
