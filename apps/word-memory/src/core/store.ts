/**
 * 单词猫 — 存档与状态管理
 *
 * 使用 localStorage 持久化，所有变更通过 store 统一入口，变更后自动落盘。
 */

import type { SaveData, WordProgress, PetState } from './types';
import { books } from '../data';

const KEY = 'wordpet.save.v1';

export function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultPet(): PetState {
  return {
    name: '咪咪',
    exp: 0,
    hunger: 75,
    clean: 75,
    mood: 80,
    lastDecay: Date.now(),
    hats: [],
    worn: null,
  };
}

export function defaultSave(): SaveData {
  return {
    version: 1,
    nickname: '小朋友',
    coins: 0,
    checkins: {},
    streakDays: 0,
    lastCheckin: null,
    progress: {},
    pet: defaultPet(),
    achievements: [],
    currentBook: 'pep3a',
    currentUnit: 0,
    dailyGoal: 10,
    settings: {
      sound: true,
      rate: 0.85,
      accent: 'en-US',
    },
    history: [],
  };
}

/** 合并旧存档，保证新增字段有默认值 */
function migrate(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  return {
    ...base,
    ...r,
    pet: { ...base.pet, ...(r.pet ?? {}) },
    settings: { ...base.settings, ...(r.settings ?? {}) },
    progress: r.progress ?? {},
    checkins: r.checkins ?? {},
    achievements: r.achievements ?? [],
    history: Array.isArray(r.history) ? r.history : [],
  };
}

export function emptyProgress(): WordProgress {
  return { level: 0, due: 0, right: 0, wrong: 0, streak: 0, last: 0 };
}

// ─────────────────────────────────────────────
// 响应式 store（极简实现，够用且无依赖）
// ─────────────────────────────────────────────
type Listener = () => void;

class Store {
  data: SaveData;
  private listeners = new Set<Listener>();
  private saveTimer: number | null = null;

  constructor() {
    let loaded: unknown = null;
    try {
      const s = localStorage.getItem(KEY);
      if (s) loaded = JSON.parse(s);
    } catch {
      loaded = null;
    }
    this.data = migrate(loaded);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** 通知 UI 更新，并延迟落盘 */
  commit(): void {
    this.listeners.forEach((fn) => fn());
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.flush(), 250);
  }

  flush(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('[wordpet] 存档写入失败', e);
    }
  }

  reset(): void {
    this.data = defaultSave();
    this.commit();
  }

  // ── 单词进度 ──
  prog(wordId: string): WordProgress {
    let p = this.data.progress[wordId];
    if (!p) {
      p = emptyProgress();
      this.data.progress[wordId] = p;
    }
    return p;
  }

  peek(wordId: string): WordProgress | undefined {
    return this.data.progress[wordId];
  }

  /** 全部学过的词数（level > 0） */
  learnedCount(): number {
    return Object.values(this.data.progress).filter((p) => p.level > 0).length;
  }

  /** 已掌握词数（level >= 4） */
  masteredCount(): number {
    return Object.values(this.data.progress).filter((p) => p.level >= 4).length;
  }

  /** 待复习词数 */
  dueCount(now = Date.now()): number {
    return Object.values(this.data.progress).filter(
      (p) => p.level > 0 && p.due <= now,
    ).length;
  }

  /** 错题本：答错次数 > 0 且尚未掌握 */
  wrongBook(): string[] {
    return Object.entries(this.data.progress)
      .filter(([, p]) => p.wrong > 0 && p.level < 4)
      .sort((a, b) => b[1].wrong - a[1].wrong)
      .map(([id]) => id);
  }

  currentBookUnits() {
    return books().find((b) => b.id === this.data.currentBook)?.units ?? [];
  }
}

export const store = new Store();

// ─────────────────────────────────────────────
// 打卡
// ─────────────────────────────────────────────

/** 计算两个日期字符串相差的天数 */
function dayDiff(a: string, b: string): number {
  const ta = new Date(a + 'T00:00:00').getTime();
  const tb = new Date(b + 'T00:00:00').getTime();
  return Math.round((tb - ta) / 86400000);
}

/**
 * 记录一次单词作答，返回本次获得的金币。
 * 同时处理每日打卡与连续天数。
 */
export function recordAnswer(
  wordId: string,
  ok: boolean,
  ms: number,
): { coins: number; levelUp: boolean; newLevel: number } {
  const d = store.data;
  const p = store.prog(wordId);
  const now = Date.now();
  const before = p.level;

  if (ok) {
    p.right++;
    p.streak++;
    // 连续答对 2 次升一级，最多 5 级
    if (p.streak >= 2 && p.level < 5) {
      p.level++;
      p.streak = 0;
    }
    if (p.level === 0) p.level = 1;
  } else {
    p.wrong++;
    p.streak = 0;
    p.level = Math.max(0, p.level - 1);
  }
  p.last = now;
  p.due = now + intervalFor(p.level, ok);

  // 金币：答对 +2，答错 +1（鼓励继续）
  const coins = ok ? 2 : 1;
  d.coins += coins;

  // 记录历史
  const today = todayStr();
  d.history.push({ t: now, d: today, wordId, ok, ms });
  // 只保留最近 3000 条，避免存档无限膨胀
  if (d.history.length > 3000) d.history.splice(0, d.history.length - 3000);

  // 打卡
  const gained = ok ? 1 : 0;
  d.checkins[today] = (d.checkins[today] ?? 0) + gained;
  if (d.lastCheckin !== today) {
    if (d.lastCheckin && dayDiff(d.lastCheckin, today) === 1) {
      d.streakDays++;
    } else {
      d.streakDays = 1;
    }
    d.lastCheckin = today;
  }

  // 宠物经验
  d.pet.exp += ok ? 10 : 3;

  store.commit();
  return { coins, levelUp: p.level > before, newLevel: p.level };
}

/**
 * 基于熟练度的复习间隔（简化版遗忘曲线）
 * level: 0 立刻, 1: 10分钟, 2: 1天, 3: 3天, 4: 7天, 5: 21天
 */
function intervalFor(level: number, ok: boolean): number {
  const MIN = 60_000;
  const DAY = 86_400_000;
  const table = [0, 10 * MIN, 1 * DAY, 3 * DAY, 7 * DAY, 21 * DAY];
  const base = table[Math.min(level, 5)] ?? 0;
  // 答错的话缩短一半间隔，尽快再见
  return ok ? base : Math.max(5 * MIN, Math.floor(base / 2));
}

/** 今天已学新词数 */
export function todayLearned(): number {
  return store.data.checkins[todayStr()] ?? 0;
}

/** 今天的目标完成比例 0-1 */
export function todayProgress(): number {
  const goal = Math.max(1, store.data.dailyGoal);
  return Math.min(1, todayLearned() / goal);
}

/** 最近 n 天的学习统计 */
export function recentDays(n: number): { date: string; count: number; label: string }[] {
  const out: { date: string; count: number; label: string }[] = [];
  const labels = ['日', '一', '二', '三', '四', '五', '六'];
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    const key = todayStr(dt);
    out.push({
      date: key,
      count: store.data.checkins[key] ?? 0,
      label: labels[dt.getDay()],
    });
  }
  return out;
}

/** 打卡日历热力图数据（最近 n 周，从周一开始） */
export function calendarGrid(weeks: number): { date: string; count: number }[][] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // 回退到本周周一
  const dow = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(start.getDate() - dow - (weeks - 1) * 7);

  const grid: { date: string; count: number }[][] = [];
  const cur = new Date(start);
  for (let wi = 0; wi < weeks; wi++) {
    const row: { date: string; count: number }[] = [];
    for (let di = 0; di < 7; di++) {
      const key = todayStr(cur);
      row.push({ date: key, count: store.data.checkins[key] ?? 0 });
      cur.setDate(cur.getDate() + 1);
    }
    grid.push(row);
  }
  return grid;
}
