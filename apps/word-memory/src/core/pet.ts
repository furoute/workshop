/**
 * 单词猫 — 宠物系统
 *
 * 猫咪有 5 个成长阶段，通过背单词积累经验值成长。
 * 饱食度 / 清洁度 / 心情会随时间衰减，需要照顾。
 */

import { store, todayStr } from './store';
import type { PetState } from './types';

export interface Stage {
  /** 阶段序号 1-5 */
  no: number;
  /** 名称 */
  name: string;
  /** 需要的累计经验 */
  need: number;
  /** 图片文件名 */
  img: string;
  /** 鼓励语 */
  word: string;
}

export const STAGES: Stage[] = [
  { no: 1, name: '猫宝宝', need: 0, img: 'cats/stage1.png', word: '刚出生的小猫，多背单词喂饱它吧！' },
  { no: 2, name: '小奶猫', need: 200, img: 'cats/stage2.png', word: '会坐起来啦，它开始好奇这个世界了。' },
  { no: 3, name: '少年猫', need: 600, img: 'cats/stage3.png', word: '精力旺盛的小少年，继续加油！' },
  { no: 4, name: '成年猫', need: 1400, img: 'cats/stage4.png', word: '长大了，戴上了属于它的项圈。' },
  { no: 5, name: '猫大王', need: 3000, img: 'cats/stage5.png', word: '单词之力满格，加冕成为猫大王！' },
];

/** 当前阶段（1-5） */
export function currentStage(exp: number): Stage {
  let s = STAGES[0];
  for (const st of STAGES) if (exp >= st.need) s = st;
  return s;
}

/** 下一个阶段，已满级返回 null */
export function nextStage(exp: number): Stage | null {
  return STAGES.find((s) => s.need > exp) ?? null;
}

/** 当前阶段内的成长进度 0-1 */
export function stageProgress(exp: number): number {
  const cur = currentStage(exp);
  const nxt = nextStage(exp);
  if (!nxt) return 1;
  return Math.min(1, Math.max(0, (exp - cur.need) / (nxt.need - cur.need)));
}

/** 距离升级还差多少经验 */
export function expToNext(exp: number): number {
  const nxt = nextStage(exp);
  return nxt ? nxt.need - exp : 0;
}

// ─────────────────────────────────────────────
// 状态衰减
// ─────────────────────────────────────────────

/** 每小时衰减的点数 */
const DECAY_PER_HOUR = { hunger: 4, clean: 3, mood: 2.5 };

/**
 * 根据离线时长结算衰减。返回是否有变化。
 * 心情额外受饱食与清洁影响：太饿太脏会掉心情。
 */
export function settleDecay(now = Date.now()): boolean {
  const pet = store.data.pet;
  const hours = (now - pet.lastDecay) / 3_600_000;
  if (hours < 0.5) return false; // 半小时内不结算，避免频繁抖动

  pet.hunger = clamp(pet.hunger - hours * DECAY_PER_HOUR.hunger);
  pet.clean = clamp(pet.clean - hours * DECAY_PER_HOUR.clean);
  pet.mood = clamp(pet.mood - hours * DECAY_PER_HOUR.mood);

  // 状态不好时心情加速下降
  if (pet.hunger < 25) pet.mood = clamp(pet.mood - hours * 2);
  if (pet.clean < 25) pet.mood = clamp(pet.mood - hours * 1.5);

  pet.lastDecay = now;
  store.commit();
  return true;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** 猫咪当前的即时状态，用于展示文案与动作 */
export type PetMood = 'happy' | 'normal' | 'hungry' | 'dirty' | 'sad' | 'sleepy';

export function petMood(pet: PetState): PetMood {
  if (pet.hunger < 25) return 'hungry';
  if (pet.clean < 25) return 'dirty';
  if (pet.mood < 30) return 'sad';
  if (pet.hunger > 80 && pet.clean > 80 && pet.mood > 80) return 'happy';
  return 'normal';
}

export const MOOD_TEXT: Record<PetMood, string> = {
  happy: '心情超好，转圈圈～',
  normal: '安安静静地待着',
  hungry: '肚子饿了，喵呜……',
  dirty: '身上脏兮兮的，想洗澡',
  sad: '有点不开心，陪陪我吧',
  sleepy: '有点困了，打哈欠中',
};

// ─────────────────────────────────────────────
// 互动
// ─────────────────────────────────────────────

export interface InteractResult {
  ok: boolean;
  msg: string;
  cost: number;
}

const COST = { feed: 5, bath: 5, play: 3, pet: 0 };

/** 喂食 */
export function feed(): InteractResult {
  const d = store.data;
  if (d.coins < COST.feed) {
    return { ok: false, msg: `金币不够啦，需要 ${COST.feed} 枚，背单词可以赚金币哦～`, cost: COST.feed };
  }
  if (d.pet.hunger >= 98) {
    return { ok: false, msg: '它已经吃得饱饱的，肚子圆滚滚啦！', cost: COST.feed };
  }
  d.coins -= COST.feed;
  d.pet.hunger = clamp(d.pet.hunger + 30);
  d.pet.mood = clamp(d.pet.mood + 6);
  d.pet.exp += 5;
  store.commit();
  return { ok: true, msg: '吃得津津有味，喵～ 🐟', cost: COST.feed };
}

/** 洗澡 */
export function bath(): InteractResult {
  const d = store.data;
  if (d.coins < COST.bath) {
    return { ok: false, msg: `金币不够啦，需要 ${COST.bath} 枚～`, cost: COST.bath };
  }
  if (d.pet.clean >= 98) {
    return { ok: false, msg: '它刚刚洗过，干干净净的呢！', cost: COST.bath };
  }
  d.coins -= COST.bath;
  d.pet.clean = clamp(d.pet.clean + 35);
  d.pet.mood = clamp(d.pet.mood + 8);
  d.pet.exp += 5;
  store.commit();
  return { ok: true, msg: '满身泡泡，香喷喷的～ 🛁', cost: COST.bath };
}

/** 玩耍 / 抚摸 */
export function play(): InteractResult {
  const d = store.data;
  if (d.coins < COST.play) {
    return { ok: false, msg: `金币不够啦，需要 ${COST.play} 枚～`, cost: COST.play };
  }
  d.coins -= COST.play;
  d.pet.mood = clamp(d.pet.mood + 22);
  d.pet.hunger = clamp(d.pet.hunger - 4);
  d.pet.exp += 8;
  store.commit();
  return { ok: true, msg: '它开心地打起了呼噜，咕噜咕噜～ 💕', cost: COST.play };
}

/** 免费抚摸，有冷却（靠心情值判断） */
export function petPet(): InteractResult {
  const d = store.data;
  if (d.pet.mood >= 98) {
    return { ok: false, msg: '它已经开心得冒泡泡啦！', cost: 0 };
  }
  d.pet.mood = clamp(d.pet.mood + 4);
  d.pet.exp += 2;
  store.commit();
  return { ok: true, msg: '它蹭了蹭你的手～ 😽', cost: 0 };
}

// ─────────────────────────────────────────────
// 装扮
// ─────────────────────────────────────────────

export interface Hat {
  id: string;
  name: string;
  emoji: string;
  price: number;
  /** 需要的成长阶段才能解锁购买 */
  needStage: number;
}

export const HATS: Hat[] = [
  { id: 'ribbon', name: '蝴蝶结', emoji: '🎀', price: 30, needStage: 1 },
  { id: 'crown', name: '小王冠', emoji: '👑', price: 80, needStage: 2 },
  { id: 'scarf', name: '围巾', emoji: '🧣', price: 60, needStage: 2 },
  { id: 'glasses', name: '墨镜', emoji: '🕶️', price: 100, needStage: 3 },
  { id: 'wizard', name: '魔法帽', emoji: '🎩', price: 150, needStage: 4 },
  { id: 'medal', name: '金牌', emoji: '🏅', price: 200, needStage: 5 },
];

export function buyHat(hat: Hat): InteractResult {
  const d = store.data;
  const stage = currentStage(d.pet.exp).no;
  if (d.pet.hats.includes(hat.id)) {
    return { ok: false, msg: '已经拥有这个装扮啦', cost: hat.price };
  }
  if (stage < hat.needStage) {
    return { ok: false, msg: `猫咪要长到「${STAGES[hat.needStage - 1].name}」才能戴哦`, cost: hat.price };
  }
  if (d.coins < hat.price) {
    return { ok: false, msg: `还差 ${hat.price - d.coins} 枚金币，继续加油！`, cost: hat.price };
  }
  d.coins -= hat.price;
  d.pet.hats.push(hat.id);
  d.pet.worn = hat.id;
  store.commit();
  return { ok: true, msg: `买到啦！猫咪戴上了${hat.name} ${hat.emoji}`, cost: hat.price };
}

export function wearHat(id: string | null): void {
  store.data.pet.worn = id;
  store.commit();
}

// ─────────────────────────────────────────────
// 成就
// ─────────────────────────────────────────────

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  /** 判定条件 */
  check: () => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', name: '启程', desc: '学会第一个单词', emoji: '🌱', check: () => store.learnedCount() >= 1 },
  { id: 'w50', name: '小有积累', desc: '学会 50 个单词', emoji: '📗', check: () => store.learnedCount() >= 50 },
  { id: 'w150', name: '词汇达人', desc: '学会 150 个单词', emoji: '📘', check: () => store.learnedCount() >= 150 },
  { id: 'w300', name: '单词富翁', desc: '学会 300 个单词', emoji: '📚', check: () => store.learnedCount() >= 300 },
  { id: 'm100', name: '百词斩', desc: '掌握 100 个单词', emoji: '⚔️', check: () => store.masteredCount() >= 100 },
  { id: 's3', name: '三日之约', desc: '连续打卡 3 天', emoji: '🔥', check: () => store.data.streakDays >= 3 },
  { id: 's7', name: '一周坚持', desc: '连续打卡 7 天', emoji: '🔥', check: () => store.data.streakDays >= 7 },
  { id: 's30', name: '月度冠军', desc: '连续打卡 30 天', emoji: '🏆', check: () => store.data.streakDays >= 30 },
  { id: 'cat2', name: '小奶猫', desc: '猫咪成长到第 2 阶段', emoji: '🐱', check: () => store.data.pet.exp >= 200 },
  { id: 'cat5', name: '猫大王', desc: '猫咪成长到第 5 阶段', emoji: '👑', check: () => store.data.pet.exp >= 3000 },
  { id: 'rich', name: '小富婆', desc: '攒够 500 枚金币', emoji: '💰', check: () => store.data.coins >= 500 },
  { id: 'book1', name: '一册通关', desc: '某一册全部单词都学过', emoji: '🎓', check: () => anyBookDone() },
];

function anyBookDone(): boolean {
  // 简化：只要学过的词数达到 80 就算通关一册
  return store.learnedCount() >= 80;
}

/** 检查并解锁新成就，返回本次新解锁的列表 */
export function checkAchievements(): Achievement[] {
  const d = store.data;
  const unlocked: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!d.achievements.includes(a.id) && a.check()) {
      d.achievements.push(a.id);
      unlocked.push(a);
    }
  }
  if (unlocked.length) store.commit();
  return unlocked;
}

/** 今日是否已打卡 */
export function checkedInToday(): boolean {
  return store.data.lastCheckin === todayStr();
}
