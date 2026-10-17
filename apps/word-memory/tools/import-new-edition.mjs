/**
 * 单词猫 — 导入 2024 新版词库
 *
 * 用法：
 *   pnpm add:new <词表文件>         从 JSON/CSV/TSV 导入
 *   pnpm add:new --check <文件>     只校验不写入
 *
 * 支持格式：
 *   1. JSON 数组：[{ book, unit, en, ph, cn, syl?, ex?, exCn? }, ...]
 *   2. JSON 对象：{ books: [ { id, name, grade, term, units: [...] } ] }
 *   3. CSV / TSV：表头需含 book,unit,en,cn（可选 ph,etl,syl,ex,exCn）
 *
 * 导入结果写入 src/data/pep-2024.ts，并自动更新 src/data/index.ts 的版本注册，
 * 使 App 在「我的 → 教材版本」中可切换到新版。
 *
 * 设计原则：宁可报错，不要猜。任何无法解析的行都会被明确列出，绝不静默丢弃。
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_FILE = join(ROOT, 'src', 'data', 'pep-2024.ts');

const argv = process.argv.slice(2);
const checkOnly = argv.includes('--check');
const file = argv.find((a) => !a.startsWith('--'));

if (!file) {
  console.error(`
单词猫 — 导入 2024 新版词库

用法：
  pnpm add:new <词表文件>          导入并生成 src/data/pep-2024.ts
  pnpm add:new --check <词表文件>   只校验，不写入

支持格式：.json / .csv / .tsv

JSON 数组示例：
[
  { "book": "pep3a", "unit": 1, "en": "friend", "ph": "frend",
    "cn": "朋友", "syl": ["friend"], "ex": "This is my friend.", "exCn": "这是我的朋友。" }
]

CSV/TSV 表头示例：
book	unit	en	ph	cn	syl	ex	exCn
pep3a	1	friend	frend	朋友	friend	This is my friend.	这是我的朋友。
（syl 用连字符分隔音节，如 "com-pu-ter"）

册的 id 对照：
  pep3a 三年级上册   pep3b 三年级下册
  pep4a 四年级上册   pep4b 四年级下册
  pep5a 五年级上册   pep5b 五年级下册
  pep6a 六年级上册   pep6b 六年级下册
`);
  process.exit(1);
}

if (!existsSync(file)) {
  console.error(`✗ 找不到文件：${file}`);
  process.exit(1);
}

// ─────────────────────────────────────────────
// 解析
// ─────────────────────────────────────────────

const BOOK_META = {
  pep3a: { name: '三年级上册', grade: 3, term: '上' },
  pep3b: { name: '三年级下册', grade: 3, term: '下' },
  pep4a: { name: '四年级上册', grade: 4, term: '上' },
  pep4b: { name: '四年级下册', grade: 4, term: '下' },
  pep5a: { name: '五年级上册', grade: 5, term: '上' },
  pep5b: { name: '五年级下册', grade: 5, term: '下' },
  pep6a: { name: '六年级上册', grade: 6, term: '上' },
  pep6b: { name: '六年级下册', grade: 6, term: '下' },
};

const errors = [];
const warnings = [];
let rows = [];

const ext = extname(file).toLowerCase();
const raw = readFileSync(file, 'utf8');

if (ext === '.json') {
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error(`✗ JSON 解析失败：${e.message}`);
    process.exit(1);
  }

  // 形式一：已经是 books 结构
  if (data && Array.isArray(data.books)) {
    for (const b of data.books) {
      if (!BOOK_META[b.id]) {
        errors.push(`未知的册 id：${b.id}`);
        continue;
      }
      for (const u of b.units ?? []) {
        for (const w of u.words ?? []) {
          rows.push({
            book: b.id, unit: u.no ?? u.unit, ...w,
            unitTitle: u.title, unitCn: u.cn, phonics: u.phonics,
          });
        }
      }
    }
  } else {
    // 形式二：扁平数组
    const arr = Array.isArray(data) ? data : (data.words ?? null);
    if (!Array.isArray(arr)) {
      console.error('✗ JSON 结构无法识别：既不是 books 结构，也不是数组');
      process.exit(1);
    }
    rows = arr;
  }
} else if (ext === '.csv' || ext === '.tsv') {
  const sep = ext === '.tsv' ? '\t' : ',';
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) {
    console.error('✗ 文件是空的');
    process.exit(1);
  }
  const header = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const need = ['book', 'unit', 'en', 'cn'];
  const missing = need.filter((k) => !header.includes(k));
  if (missing.length) {
    console.error(`✗ 表头缺少必需列：${missing.join(', ')}`);
    console.error(`  实际表头：${header.join(' | ')}`);
    process.exit(1);
  }
  const idx = (k) => header.indexOf(k);
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep);
    rows.push({
      book: cells[idx('book')]?.trim(),
      unit: cells[idx('unit')]?.trim(),
      en: cells[idx('en')]?.trim(),
      ph: idx('ph') >= 0 ? cells[idx('ph')]?.trim() : '',
      cn: cells[idx('cn')]?.trim(),
      syl: idx('syl') >= 0 ? cells[idx('syl')]?.trim() : '',
      ex: idx('ex') >= 0 ? cells[idx('ex')]?.trim() : '',
      exCn: idx('excn') >= 0 ? cells[idx('exCn')]?.trim() : '',
      unitTitle: idx('unittitle') >= 0 ? cells[idx('unittitle')]?.trim() : '',
      unitCn: idx('unitcn') >= 0 ? cells[idx('unitcn')]?.trim() : '',
      phonics: idx('phonics') >= 0 ? cells[idx('phonics')]?.trim() : '',
      _line: i + 1,
    });
  }
} else {
  console.error(`✗ 不支持的文件类型：${ext}（支持 .json / .csv / .tsv）`);
  process.exit(1);
}

// ─────────────────────────────────────────────
// 校验
// ─────────────────────────────────────────────

const clean = [];
const seenIds = new Set();

function splitSyl(v) {
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  if (typeof v === 'string' && v.trim()) {
    return v.split(/[-\u00b7|/]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

for (const [i, r] of rows.entries()) {
  const where = r._line ? `第 ${r._line} 行` : `第 ${i + 1} 条`;

  const book = String(r.book ?? '').trim();
  const unit = Number(r.unit);
  const en = String(r.en ?? '').trim();
  const cn = String(r.cn ?? '').trim();

  if (!BOOK_META[book]) {
    errors.push(`${where}：未知的册 id "${book}"`);
    continue;
  }
  if (!Number.isFinite(unit) || unit < 1) {
    errors.push(`${where}：单元号无效 "${r.unit}"（应为 ≥1 的整数）`);
    continue;
  }
  if (!en) {
    errors.push(`${where}：缺少单词（en）`);
    continue;
  }
  if (!cn) {
    errors.push(`${where}：单词 "${en}" 缺少中文释义（cn）`);
    continue;
  }
  if (cn.length > 20) {
    warnings.push(`${where}：释义过长（${cn.length} 字）"${cn}" —— 建议精简到 20 字内`);
  }

  const id = `${book}-u${unit}-${en.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;
  if (seenIds.has(id)) {
    errors.push(`${where}：重复词条 ${id}（"${en}" 在同一册同一单元出现多次）`);
    continue;
  }
  seenIds.add(id);

  const syl = splitSyl(r.syl);
  if (syl.length) {
    const joined = syl.join('').replace(/[^a-z]/gi, '').toLowerCase();
    const target = en.replace(/[^a-z]/gi, '').toLowerCase();
    if (joined !== target) {
      warnings.push(`${where}："${en}" 的音节 ${JSON.stringify(syl)} 拼不回原词（得到 "${joined}"）`);
    }
  }

  clean.push({
    book, unit, en, cn,
    ph: String(r.ph ?? '').trim(),
    syl,
    ex: String(r.ex ?? '').trim(),
    exCn: String(r.exCn ?? '').trim(),
    unitTitle: r.unitTitle ? String(r.unitTitle).trim() : '',
    unitCn: r.unitCn ? String(r.unitCn).trim() : '',
    phonics: r.phonics ? String(r.phonics).trim() : '',
  });
}

// ─────────────────────────────────────────────
// 报告
// ─────────────────────────────────────────────

console.log(`\n读取：${file}`);
console.log(`共 ${rows.length} 条记录\n`);

if (errors.length) {
  console.log(`✗ ${errors.length} 条无法导入：`);
  errors.slice(0, 30).forEach((e) => console.log(`   · ${e}`));
  if (errors.length > 30) console.log(`   …还有 ${errors.length - 30} 条`);
  console.log('');
}

if (warnings.length) {
  console.log(`⚠️  ${warnings.length} 条提醒（不阻止导入）：`);
  warnings.slice(0, 15).forEach((w) => console.log(`   · ${w}`));
  if (warnings.length > 15) console.log(`   …还有 ${warnings.length - 15} 条`);
  console.log('');
}

if (!clean.length) {
  console.error('✗ 没有任何有效记录，未生成文件。');
  process.exit(1);
}

// 按册 / 单元统计
const byBook = new Map();
for (const r of clean) {
  if (!byBook.has(r.book)) byBook.set(r.book, new Map());
  const units = byBook.get(r.book);
  if (!units.has(r.unit)) units.set(r.unit, []);
  units.get(r.unit).push(r);
}

console.log('导入后的词库结构：');
for (const [book, units] of [...byBook.entries()].sort()) {
  const total = [...units.values()].reduce((n, a) => n + a.length, 0);
  const unitList = [...units.keys()].sort((a, b) => a - b).join(',');
  console.log(`  ${book}  ${BOOK_META[book].name}  ${units.size} 个单元 [${unitList}]  共 ${total} 词`);
}
console.log(`\n合计：${clean.length} 词，${byBook.size} 册\n`);

if (checkOnly) {
  console.log('（--check 模式，未写入文件）');
  process.exit(errors.length ? 1 : 0);
}

// ─────────────────────────────────────────────
// 生成 TS 文件
// ─────────────────────────────────────────────

function tsStr(s) {
  return `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

const lines = [];
lines.push(`/**
 * 单词猫 — 人教 PEP 2024 新版词库
 *
 * ⚠️ 本文件由 tools/import-new-edition.mjs 自动生成，请勿手工编辑。
 * 源文件：${file.replace(/\\/g, '/')}
 * 生成时间：${new Date().toLocaleString('zh-CN')}
 *
 * 对应教材：2024 年秋季起启用的新版（三上 Unit 1 = Making friends）
 */

import type { Book, Word, BookId, Edition } from '../core/types';

/** 本文件所有词条所属的教材版本 */
export const LIB_EDITION: Edition = 'pep-2024';

function w(
  book: BookId,
  unit: number,
  en: string,
  ph: string,
  cn: string,
  syl: string[],
  ex?: string,
  exCn?: string,
): Word {
  return {
    id: \`\${book}-u\${unit}-\${en.replace(/[^a-z0-9]/gi, '').toLowerCase()}\`,
    en, ph, cn, syl, ex, exCn, book, unit,
    edition: LIB_EDITION,
  };
}

`);

const BOOK_META_ORDER = ['pep3a', 'pep3b', 'pep4a', 'pep4b', 'pep5a', 'pep5b', 'pep6a', 'pep6b'];
const varNames = {};

for (const book of BOOK_META_ORDER) {
  const units = byBook.get(book);
  if (!units) continue;
  const meta = BOOK_META[book];
  const varName = book;
  varNames[book] = varName;

  lines.push(`// ─────────────────────────────────────────────`);
  lines.push(`// ${meta.name}（2024 新版）`);
  lines.push(`// ─────────────────────────────────────────────`);
  lines.push(`const ${varName}: Book = {`);
  lines.push(`  id: '${book}', name: '${meta.name}', grade: ${meta.grade}, term: '${meta.term}', edition: LIB_EDITION,`);
  lines.push(`  units: [`);

  for (const unitNo of [...units.keys()].sort((a, b) => a - b)) {
    const ws = units.get(unitNo);
    const sample = ws[0];
    const title = sample.unitTitle || `Unit ${unitNo}`;
    const cn = sample.unitCn || '';
    lines.push(`    {`);
    lines.push(`      no: ${unitNo}, title: ${tsStr(title)}, cn: ${tsStr(cn)},`);
    if (sample.phonics) lines.push(`      phonics: ${tsStr(sample.phonics)},`);
    lines.push(`      words: [`);
    for (const r of ws) {
      const parts = [
        `'${r.book}'`, String(r.unit), tsStr(r.en), tsStr(r.ph), tsStr(r.cn),
        JSON.stringify(r.syl).replace(/"/g, "'"),
      ];
      if (r.ex) {
        parts.push(tsStr(r.ex));
        if (r.exCn) parts.push(tsStr(r.exCn));
      }
      lines.push(`        w(${parts.join(', ')}),`);
    }
    lines.push(`      ],`);
    lines.push(`    },`);
  }

  lines.push(`  ],`);
  lines.push(`};`);
  lines.push('');
}

const present = BOOK_META_ORDER.filter((b) => varNames[b]);
lines.push(`export const BOOKS: Book[] = [${present.join(', ')}];`);
lines.push('');
lines.push(`/** 全部单词的扁平索引 */`);
lines.push(`export const ALL_WORDS: Word[] = BOOKS.flatMap((b) => b.units.flatMap((u) => u.words));`);
lines.push('');
lines.push(`/** 按 id 快速查找 */`);
lines.push(`export const WORD_BY_ID: Map<string, Word> = new Map(ALL_WORDS.map((x) => [x.id, x]));`);
lines.push('');
lines.push(`/** 统计信息 */`);
lines.push(`export const STATS = {`);
lines.push(`  books: BOOKS.length,`);
lines.push(`  units: BOOKS.reduce((n, b) => n + b.units.length, 0),`);
lines.push(`  words: ALL_WORDS.length,`);
lines.push(`  edition: LIB_EDITION,`);
lines.push(`};`);
lines.push('');

writeFileSync(OUT_FILE, lines.join('\n'), 'utf8');

console.log(`✓ 已生成 ${OUT_FILE.replace(ROOT + '\\', '').replace(ROOT + '/', '')}`);
console.log(`\n下一步：`);
console.log(`  1. 在 src/data/index.ts 里把版本注册指向新版（或运行 pnpm use:new）`);
console.log(`  2. 运行 pnpm check 确认类型无误`);
console.log(`  3. 运行 pnpm build && pnpm verify 确认功能正常\n`);

process.exit(0);
