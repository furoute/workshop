/**
 * 词库覆盖度校验
 *
 * 把手工精编词库与调研抓取的真实教材词表对比，找出：
 *   - 精编库缺失的单词（按册）
 *   - 精编库多出的单词（可能是拼写错误或非本册词）
 * 不自动改数据，只出报告供人工判断。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESEARCH = process.env.WORDPET_REFERENCE || 'reference/pep_primary_app_vocab.json';
const OUT = join(__dirname, '..', 'wordpet-vocab-report.md');

const raw = JSON.parse(readFileSync(RESEARCH, 'utf8'));

// 调研数据的册 id -> 我们的册 id
const ID_MAP = {
  'pep-primary-g3-s1': 'pep3a',
  'pep-primary-g3-s2': 'pep3b',
  'pep-primary-g4-s1': 'pep4a',
  'pep-primary-g4-s2': 'pep4b',
  'pep-primary-g5-s1': 'pep5a',
  'pep-primary-g5-s2': 'pep5b',
  'pep-primary-g6-s1': 'pep6a',
  'pep-primary-g6-s2': 'pep6b',
};

// 从 TS 源文件里抽取我们已有的词（用正则轻量解析，避免引入构建步骤）
const src = readFileSync(join(__dirname, '..', 'src', 'data', 'pep.ts'), 'utf8');
const ours = new Map(); // bookId -> Set(小写词)
const re = /w\('(pep\w+)',\s*(\d+),\s*'([^']+)'/g;
let m;
while ((m = re.exec(src))) {
  const [, book, , en] = m;
  if (!ours.has(book)) ours.set(book, new Set());
  ours.get(book).add(en.toLowerCase());
}

// 调研数据的列表
const books = raw.textbooks ?? raw.books ?? raw;
const list = Array.isArray(books) ? books : Object.values(books);

const lines = [];
lines.push('# 词库覆盖度校验报告\n');
lines.push(`生成时间：${new Date().toLocaleString('zh-CN')}\n`);
lines.push('对比：手工精编词库（src/data/pep.ts） vs 调研抓取的真实教材词表\n');

let totalOurs = 0, totalRef = 0, totalMissing = 0;

for (const b of list) {
  const ourId = ID_MAP[b.id];
  if (!ourId) continue;
  const mine = ours.get(ourId) ?? new Set();
  const refWords = (b.words ?? []).map((w) => w.spelling);

  // 归一化：忽略大小写、连字符与空格差异
  const norm = (s) => s.toLowerCase().replace(/[-\s]+/g, ' ').trim();
  const myNorm = new Set([...mine].map(norm));
  const refNorm = new Set(refWords.map(norm));

  const missing = refWords.filter((w) => !myNorm.has(norm(w)));
  const extra = [...mine].filter((w) => !refNorm.has(norm(w)));

  totalOurs += mine.size;
  totalRef += refWords.length;
  totalMissing += missing.length;

  const pct = ((mine.size / Math.max(1, refWords.length)) * 100).toFixed(0);
  lines.push(`\n## ${b.name}（${ourId}）\n`);
  lines.push(`- 精编库：**${mine.size}** 词`);
  lines.push(`- 参考词表：**${refWords.length}** 词`);
  lines.push(`- 覆盖率：**${pct}%**（缺 ${missing.length} 词）`);

  if (missing.length) {
    lines.push(`\n**参考词表中有、精编库缺失（${missing.length}）：**\n`);
    lines.push('```');
    // 每行若干词，便于阅读
    for (let i = 0; i < missing.length; i += 8) {
      lines.push(missing.slice(i, i + 8).join('  |  '));
    }
    lines.push('```');
  }

  if (extra.length) {
    lines.push(`\n**精编库有、参考词表未见（${extra.length}，可能是词组拆分差异或需核对）：**\n`);
    lines.push('```');
    lines.push([...extra].join('  |  '));
    lines.push('```');
  }
}

lines.push('\n---\n');
lines.push(`## 汇总\n`);
lines.push(`- 精编库总词数：**${totalOurs}**`);
lines.push(`- 参考词表总词数：**${totalRef}**`);
lines.push(`- 缺口合计：**${totalMissing}**`);

writeFileSync(OUT, lines.join('\n'), 'utf8');

console.log(`精编库 ${totalOurs} 词 | 参考 ${totalRef} 词 | 缺口 ${totalMissing} 词`);
console.log(`报告已写入: ${OUT}\n`);

// 控制台也打印每册摘要
for (const b of list) {
  const ourId = ID_MAP[b.id];
  if (!ourId) continue;
  const mine = ours.get(ourId) ?? new Set();
  const refWords = (b.words ?? []).map((w) => w.spelling);
  const norm = (s) => s.toLowerCase().replace(/[-\s]+/g, ' ').trim();
  const myNorm = new Set([...mine].map(norm));
  const missing = refWords.filter((w) => !myNorm.has(norm(w)));
  console.log(
    `${b.name.padEnd(22)} 精编 ${String(mine.size).padStart(3)} / 参考 ${String(refWords.length).padStart(3)}  缺 ${String(missing.length).padStart(3)}  覆盖 ${String(Math.round((mine.size / Math.max(1, refWords.length)) * 100)).padStart(3)}%`,
  );
}
