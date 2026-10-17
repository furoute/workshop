/**
 * 单词猫 — 词库注册中心
 *
 * App 的所有词库访问都经过这里，从而支持「新旧版教材切换」。
 *
 * 人教 PEP 正处于改版期：
 *   - pep-2012 旧版：本仓库已内置完整词库（913 词）
 *   - pep-2024 新版：需先用 `pnpm add:new <词表文件>` 导入
 *
 * 切换方式：`pnpm use:new` / `pnpm use:old`，或在设置页切换（运行时）。
 */

import * as oldEdition from './pep';
import type { Book, Word, Edition, BookId } from '../core/types';

/**
 * 2024 新版词库是可选的 —— 用 try/catch 动态探测文件是否存在。
 * Vite 在构建时会把 import.meta.glob 的结果静态内联，
 * 所以这里用 glob 拿到所有候选模块，再按需选用。
 */
const newEditionModules = import.meta.glob<{
  BOOKS: Book[];
  ALL_WORDS: Word[];
  WORD_BY_ID: Map<string, Word>;
  STATS: { books: number; units: number; words: number; edition: Edition };
  LIB_EDITION: Edition;
}>('./pep-2024.ts', { eager: true });

const newEdition = Object.values(newEditionModules)[0] ?? null;

/** 新版词库是否已导入 */
export const HAS_NEW_EDITION: boolean = !!newEdition && (newEdition.STATS?.words ?? 0) > 0;

// ─────────────────────────────────────────────
// 当前激活的版本
// ─────────────────────────────────────────────

const PREF_KEY = 'wordpet.edition';

/**
 * 当前使用的版本。
 * 优先读用户偏好；若偏好指向新版但新版不存在，则回退到旧版。
 *
 * 默认值：若已导入新版词库则默认用新版（2024 秋起入学的小学生用新版），
 * 否则回退旧版。
 */
export function activeEdition(): Edition {
  let pref: string | null = null;
  try {
    pref = localStorage.getItem(PREF_KEY);
  } catch {
    pref = null;
  }
  if (pref === 'pep-2012') return 'pep-2012';
  if (pref === 'pep-2024' && HAS_NEW_EDITION) return 'pep-2024';
  // 没有偏好时：有新版就用新版
  return HAS_NEW_EDITION ? 'pep-2024' : 'pep-2012';
}

/** 切换版本 */
export function setEdition(ed: Edition): boolean {
  if (ed === 'pep-2024' && !HAS_NEW_EDITION) return false;
  try {
    localStorage.setItem(PREF_KEY, ed);
  } catch {
    /* 忽略：隐私模式下可能失败，此时仅本次会话生效 */
  }
  return true;
}

// ─────────────────────────────────────────────
// 数据访问（始终反映当前激活版本）
// ─────────────────────────────────────────────

export function books(): Book[] {
  return activeEdition() === 'pep-2024' && newEdition ? newEdition.BOOKS : oldEdition.BOOKS;
}

export function allWords(): Word[] {
  return activeEdition() === 'pep-2024' && newEdition ? newEdition.ALL_WORDS : oldEdition.ALL_WORDS;
}

export function wordById(): Map<string, Word> {
  return activeEdition() === 'pep-2024' && newEdition ? newEdition.WORD_BY_ID : oldEdition.WORD_BY_ID;
}

export function stats() {
  return activeEdition() === 'pep-2024' && newEdition ? newEdition.STATS : oldEdition.STATS;
}

// ─────────────────────────────────────────────
// 向后兼容的导出（保持既有 import 不变）
// ─────────────────────────────────────────────

/** @deprecated 请改用 books() —— 它会随版本切换而变化 */
export const BOOKS: Book[] = oldEdition.BOOKS;

/** @deprecated 请改用 allWords() */
export const ALL_WORDS: Word[] = oldEdition.ALL_WORDS;

/** @deprecated 请改用 wordById() */
export const WORD_BY_ID: Map<string, Word> = oldEdition.WORD_BY_ID;

/** @deprecated 请改用 stats() */
export const STATS = oldEdition.STATS;

export { oldEdition, newEdition };
export type { Book, Word, Edition, BookId };
