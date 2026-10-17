/**
 * 单词猫 — 从 2024 新版调研报告中提取词表，生成导入用的 TSV
 *
 * 输入：reference/pep2024_grade3_report.md
 * 输出：_new-edition-grade3.tsv（供 tools/import-new-edition.mjs 使用）
 *
 * 报告的词汇表格式为：
 *   #### Unit 1 Making friends（17 词）
 *   | 单词 | 音标 | 中文 |
 *   |---|---|---|
 *   | nice | /naɪs/ | 令人愉快的；友好的 |
 *
 * 脚本会按「三上 / 三下」两个大节分别提取，并把音标去掉斜杠。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syllables } from './syllables.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.WORDPET_SOURCE_REPORT || 'reference/pep2024_grade3_report.md';
const OUT = join(__dirname, '..', '_new-edition-grade3.tsv');

const md = readFileSync(SRC, 'utf8');
const lines = md.split(/\r?\n/);

/** 三下单元标题（来自报告，用于生成 unitTitle 与中文主题） */
const BOOK3A_UNITS = [
  { no: 1, title: 'Making friends', cn: '交朋友' },
  { no: 2, title: 'Different families', cn: '不同的家庭' },
  { no: 3, title: 'Amazing animals', cn: '奇妙的动物' },
  { no: 4, title: 'Plants around us', cn: '我们身边的植物' },
  { no: 5, title: 'The colourful world', cn: '多彩的世界' },
  { no: 6, title: 'Useful numbers', cn: '有用的数字' },
];

const BOOK3B_UNITS = [
  { no: 1, title: 'Meeting new people', cn: '认识新朋友' },
  { no: 2, title: 'Expressing yourself', cn: '表达自己' },
  { no: 3, title: 'Learning better', cn: '更好地学习' },
  { no: 4, title: 'Healthy food', cn: '健康食物' },
  { no: 5, title: 'Old toys', cn: '旧玩具' },
  { no: 6, title: 'Numbers in life', cn: '生活中的数字' },
];

/**
 * 三上 Letters and sounds 的字母分组（来自报告）
 * 用于给每个单元标注拼读内容
 */
const PHONICS_3A = {
  1: '字母 Aa-Dd 的发音',
  2: '字母 Ee-Hh 的发音',
  3: '字母 Ii-Ll 的发音',
  4: '字母 Mm-Pp 的发音',
  5: '字母 Qq-Uu 的发音',
  6: '字母 Vv-Zz 的发音',
};

/** 三下 Let's spell 的拼读内容（来自报告，已修正 U2/U6） */
const PHONICS_3B = {
  1: 'a 与 a-e 的发音（cat / face）',
  2: 'e 的长音 /iː/（he, she, we）',
  3: 'i 与 i-e 的发音（big / bike）',
  4: 'o 与 o-e 的发音（hot / nose）',
  5: 'u 与 u-e 的发音（but / use）',
  6: 'c, g, l, y 的双音规律',
};

/** 教材原文较长、但不适合小学生阅读的释义，替换为精简版 */
const CN_OVERRIDES = {
  has: '有（have 的第三人称单数）',
  shelf: '架子（复数 shelves）',
  right: '对的；准确的',
  long: '长的',
  short: '短的；矮的',
  much: '许多',
  so: '这么；那么',
  talk: '说；讲',
  old: '旧的；（多少）岁',
  from: '来自',
  about: '大约',
  on: '在……上面',
  in: '在……里面',
  or: '或者',
  all: '全部；所有',
};

// ─────────────────────────────────────────────
// 解析
// ─────────────────────────────────────────────

/**
 * 定位「三年级上册」和「三年级下册」词汇表的起止行。
 * 报告结构：3.1 三上词汇 / 3.2 三下词汇
 */
function findSection(startMarker, endMarker) {
  const start = lines.findIndex((l) => l.includes(startMarker));
  if (start < 0) return null;
  let end = lines.length;
  if (endMarker) {
    const e = lines.findIndex((l, i) => i > start && l.includes(endMarker));
    if (e >= 0) end = e;
  }
  return { start, end };
}

const sec3a = findSection('3.1 三年级上册', '3.2 三年级下册');
const sec3b = findSection('3.2 三年级下册', '### 4.1');

if (!sec3a) {
  console.error('✗ 找不到「3.1 三年级上册」章节');
  process.exit(1);
}

const rows = [];
const stats = {};

/** 从一个章节里提取所有单元的词表 */
function extract(section, bookId, unitMeta, phonicsMap) {
  if (!section) return;
  let currentUnit = 0;

  for (let i = section.start; i < section.end; i++) {
    const line = lines[i];

    // 形如：#### Unit 1 Making friends（17 词）
    const unitMatch = line.match(/^####\s+Unit\s+(\d+)/i);
    if (unitMatch) {
      currentUnit = Number(unitMatch[1]);
      continue;
    }
    // 跳过非表格行
    if (!line.trim().startsWith('|')) continue;
    // 跳过表头与分隔行
    if (/^\|\s*单词\s*\|/.test(line)) continue;
    if (/^\|[\s\-:|]+\|$/.test(line)) continue;
    if (!currentUnit) continue;

    const cells = line.split('|').map((c) => c.trim());
    // 形如 ['', 'nice', '/naɪs/', '令人愉快的；友好的', '']
    if (cells.length < 5) continue;
    const [, en, ph, cn] = cells;
    if (!en || !cn) continue;
    // 跳过明显不是词条的行
    if (en === '单词' || en.startsWith('---')) continue;

    const meta = unitMeta.find((u) => u.no === currentUnit);
    if (!meta) continue;

    // 释义：优先用精简覆盖版
    const cnOut = CN_OVERRIDES[en.toLowerCase()] ?? cn;

    rows.push({
      book: bookId,
      unit: currentUnit,
      en,
      // 去掉音标两侧斜杠；源页面未标音标时保留空
      ph: ph && ph !== '—' && !ph.includes('未标') ? ph.replace(/^\/|\/$/g, '') : '',
      cn: cnOut,
      unitTitle: meta.title,
      unitCn: meta.cn,
      phonics: phonicsMap[currentUnit] ?? '',
    });

    const k = `${bookId}-u${currentUnit}`;
    stats[k] = (stats[k] ?? 0) + 1;
  }
}

extract(sec3a, 'pep3a', BOOK3A_UNITS, PHONICS_3A);
extract(sec3b, 'pep3b', BOOK3B_UNITS, PHONICS_3B);

if (!rows.length) {
  console.error('✗ 没有提取到任何词条，请检查报告格式是否变化');
  process.exit(1);
}

// ─────────────────────────────────────────────
// 生成 TSV
// ─────────────────────────────────────────────

const header = ['book', 'unit', 'en', 'ph', 'cn', 'syl', 'ex', 'exCn', 'unitTitle', 'unitCn', 'phonics'];

const out = [header.join('\t')];
for (const r of rows) {
  // 用音节切分器生成 syl（连字符分隔）
  const syl = syllables(r.en).join('-');
  out.push([
    r.book, r.unit, r.en, r.ph, r.cn, syl, '', '', r.unitTitle, r.unitCn, r.phonics,
  ].join('\t'));
}

writeFileSync(OUT, out.join('\n') + '\n', 'utf8');

// ─────────────────────────────────────────────
// 报告
// ─────────────────────────────────────────────

console.log(`源文件：${SRC}`);
console.log(`输出：${OUT}\n`);
console.log('提取结果：');

let total = 0, noPh = 0;
for (const [k, n] of Object.entries(stats).sort()) {
  console.log(`  ${k}  ${n} 词`);
  total += n;
}
for (const r of rows) if (!r.ph) noPh++;

console.log(`\n合计：${total} 词`);
console.log(`其中无音标：${noPh} 词${noPh ? '（需补）' : ''}`);

// 与报告声称的词数对比
const expected = { 'pep3a': 107, 'pep3b': 114 };
for (const [book, exp] of Object.entries(expected)) {
  const got = rows.filter((r) => r.book === book).length;
  const mark = got === exp ? '✓' : '⚠️';
  console.log(`${mark} ${book}：提取 ${got} 词，报告声称 ${exp} 词`);
}
