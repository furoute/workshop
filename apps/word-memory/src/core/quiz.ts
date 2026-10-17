/**
 * 单词猫 — 出题与学习队列
 *
 * 学习会话由三部分词组成：
 *   1. 到期复习词（按遗忘曲线）
 *   2. 错题本里的词
 *   3. 该单元还没学过的新词
 */

import type { Word, QuizQuestion, QuizMode } from './types';
import { store } from './store';
import { allWords, books } from '../data';

/** 取某个教材 + 单元范围内的词 */
export function wordsInScope(bookId: string, unit: number): Word[] {
  const book = books().find((b) => b.id === bookId);
  if (!book) return [];
  if (unit === 0) return book.units.flatMap((u) => u.words);
  return book.units.find((u) => u.no === unit)?.words ?? [];
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 构建一次学习会话的词表
 * @param size 本次想学的词数
 */
export function buildSession(size = 10): Word[] {
  const d = store.data;
  const scope = wordsInScope(d.currentBook, d.currentUnit);
  const scopeIds = new Set(scope.map((w) => w.id));
  const now = Date.now();

  // 1) 到期复习（限本单元范围内）
  const due = scope
    .filter((w) => {
      const p = store.peek(w.id);
      return p && p.level > 0 && p.due <= now;
    })
    .sort((a, b) => (store.peek(a.id)?.due ?? 0) - (store.peek(b.id)?.due ?? 0));

  // 2) 错题
  const wrong = store
    .wrongBook()
    .filter((id) => scopeIds.has(id))
    .map((id) => scope.find((w) => w.id === id)!)
    .filter(Boolean);

  // 3) 新词（未学过）
  const fresh = scope.filter((w) => !store.peek(w.id) || store.peek(w.id)!.level === 0);

  const picked: Word[] = [];
  const seen = new Set<string>();
  const push = (list: Word[], n: number) => {
    for (const w of list) {
      if (picked.length >= size) return;
      if (seen.has(w.id)) continue;
      seen.add(w.id);
      picked.push(w);
      if (--n <= 0) return;
    }
  };

  // 复习优先，但保证有新词进来（学习体验需要新鲜感）
  const newQuota = Math.max(2, Math.round(size * 0.4));
  push(shuffle(due).concat(wrong), size - newQuota);
  push(shuffle(fresh), size - picked.length);

  // 不够就用范围里任意词补足
  if (picked.length < size) {
    push(shuffle(scope), size - picked.length);
  }
  // 范围本身词太少时，从全库补
  if (picked.length < size) {
    push(shuffle(allWords()), size - picked.length);
  }

  return shuffle(picked).slice(0, size);
}

/** 根据单词的掌握情况选择合适题型 */
function pickMode(word: Word): QuizMode {
  const p = store.peek(word.id);
  const level = p?.level ?? 0;
  const wrongs = p?.wrong ?? 0;

  // 生词先认识，从看英文选中文开始
  if (level <= 1) {
    return Math.random() < 0.75 ? 'en2cn' : 'listen';
  }
  if (level === 2) {
    return Math.random() < 0.5 ? 'en2cn' : 'cn2en';
  }
  if (level === 3) {
    const r = Math.random();
    if (r < 0.4) return 'cn2en';
    if (r < 0.7) return 'listen';
    return 'spell';
  }
  // 高熟练度：多练拼写和听力
  const r = Math.random();
  if (r < 0.35) return 'spell';
  if (r < 0.7) return 'listen';
  return wrongs > 2 ? 'en2cn' : 'cn2en';
}

/** 为一道题生成干扰项 */
function makeOptions(word: Word, mode: QuizMode, pool: Word[]): { options: string[]; answer: string } {
  const isCn = mode === 'en2cn';
  const answer = isCn ? word.cn : word.en;

  // 优先从同一单元/同册里找干扰项，更有挑战性
  const sameBook = pool.filter((w) => w.id !== word.id && w.book === word.book);
  const others = allWords().filter((w) => w.id !== word.id);

  const candidates: string[] = [];
  const seen = new Set<string>([answer]);
  for (const src of [sameBook, others]) {
    for (const w of shuffle(src)) {
      const val = isCn ? w.cn : w.en;
      if (seen.has(val)) continue;
      // 避免答案过于相似的选项（如中文释义完全相同）
      seen.add(val);
      candidates.push(val);
      if (candidates.length >= 12) break;
    }
    if (candidates.length >= 12) break;
  }

  const options = shuffle([answer, ...shuffle(candidates).slice(0, 3)]);
  return { options, answer };
}

/** 生成一道题 */
export function makeQuestion(word: Word, pool: Word[]): QuizQuestion {
  const mode = pickMode(word);
  const { options, answer } = makeOptions(word, mode, pool);
  return { word, mode, options, answer };
}

/** 打乱字母用于拼写题的字母块 */
export function scrambleLetters(word: Word): string[] {
  const letters = word.en.replace(/[^a-zA-Z]/g, '').split('');
  let out = shuffle(letters);
  // 避免打乱后仍是原词
  if (out.join('').toLowerCase() === letters.join('').toLowerCase() && letters.length > 2) {
    out = shuffle(letters);
  }
  return out;
}

/** 题型的中文说明 */
export const MODE_LABEL: Record<QuizMode, string> = {
  en2cn: '选出正确的中文意思',
  cn2en: '选出正确的英文单词',
  listen: '听发音，选出正确的单词',
  spell: '按顺序点击字母，拼出单词',
};
