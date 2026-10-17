/**
 * 词库音节-音标对齐统计
 *
 * 遍历 2024 新版词库的每个词，统计音标对齐的成功率，
 * 并列出无法对齐的词（这些词的「拼」环节不显示音标）。
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { alignPhonetic } from './phonetic-align.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'src', 'data', 'pep-2024.ts'), 'utf8');

const RE = /w\('(pep\w+)',\s*(\d+),\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)',\s*\[([^\]]*)\]/g;

const words = [];
let m;
while ((m = RE.exec(src))) {
  const en = m[3].replace(/\\'/g, "'");
  const ph = m[4];
  const syl = m[6]
    .split(',')
    .map((s) => s.trim().replace(/^'/, '').replace(/'$/, ''))
    .filter(Boolean);
  words.push({ en, ph, syl, book: m[1], unit: m[2] });
}

console.log(`词条总数：${words.length}`);

const multi = words.filter((w) => w.syl.length > 1);
const single = words.filter((w) => w.syl.length <= 1);
console.log(`单音节词：${single.length}（无需切分）`);
console.log(`多音节词：${multi.length}\n`);

let ok = 0;
const failed = [];
for (const w of multi) {
  const r = alignPhonetic(w.ph, w.syl.length, w.en);
  if (r && r.length === w.syl.length && r.join('').replace(/[/ˈˌ.]/g, '') === w.ph.replace(/[/ˈˌ.]/g, '')) {
    ok++;
  } else {
    failed.push(w);
  }
}

const rate = multi.length ? Math.round((ok / multi.length) * 100) : 100;
console.log(`音标对齐成功：${ok}/${multi.length}（${rate}%）`);

if (failed.length) {
  console.log(`\n无法对齐的词（拼读页不显示音标，避免误导）：`);
  failed.forEach((w) => {
    console.log(`  ${w.book} u${w.unit}  ${w.en.padEnd(14)} ${w.syl.join('-').padEnd(18)} /${w.ph}/`);
  });
}

// 抽样展示对齐效果最好的多音节词
console.log('\n对齐示例：');
multi
  .filter((w) => {
    const r = alignPhonetic(w.ph, w.syl.length, w.en);
    return r && r.length > 1;
  })
  .slice(0, 15)
  .forEach((w) => {
    const r = alignPhonetic(w.ph, w.syl.length, w.en);
    console.log(
      `  ${w.en.padEnd(14)} ${w.syl.map((s, i) => `${s}/${r[i] ?? ''}`).join('  ')}`,
    );
  });
