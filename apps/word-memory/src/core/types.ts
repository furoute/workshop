/**
 * 单词猫 — 核心数据模型
 */

/**
 * 教材版本
 *
 * 人教 PEP 小学英语正处于改版期，新旧两版并行：
 *  - pep-2012：2012/2013 版（旧版），三上 Unit 1 是 Hello!
 *  - pep-2024：2024 年秋季起启用的新版，三上 Unit 1 是 Making friends
 *
 * 两版的单元标题、词汇编排、拼读体系都不同，词库必须按版本区分。
 */
export type Edition = 'pep-2012' | 'pep-2024';

export interface EditionMeta {
  id: Edition;
  /** 显示名 */
  name: string;
  /** 简短说明 */
  desc: string;
  /** 判断特征，帮助家长确认孩子用的是哪版 */
  hint: string;
}

export const EDITIONS: EditionMeta[] = [
  {
    id: 'pep-2012',
    name: '2012/2013 版（旧版）',
    desc: '三上 Unit 1 是 Hello!，语音板块叫 Let\'s spell',
    hint: '课本扉页版次写 2013年10月第1版',
  },
  {
    id: 'pep-2024',
    name: '2024 新版',
    desc: '三上 Unit 1 是 Making friends，语音板块叫 Phonics',
    hint: '课本扉页版次写 2024年7月第1版',
  },
];

/** 一个单词条目 */
export interface Word {
  /** 唯一 id，如 "pep3a-u1-hello" */
  id: string;
  /** 英文单词 */
  en: string;
  /** 音标，如 "həˈləʊ" */
  ph?: string;
  /** 中文释义 */
  cn: string;
  /** 例句（英文） */
  ex?: string;
  /** 例句翻译 */
  exCn?: string;
  /** 音节拆分，用于自然拼读，如 ["com","pu","ter"] */
  syl?: string[];
  /** 该单词所属教材位置 */
  book: BookId;
  unit: number;
  /** 所属教材版本 */
  edition?: Edition;
  /** 词性，如 n. / v. / adj. */
  pos?: string;
  /** 分类标签，如 "文具" "动物" */
  tag?: string;
}

export type BookId =
  | 'pep3a' | 'pep3b'
  | 'pep4a' | 'pep4b'
  | 'pep5a' | 'pep5b'
  | 'pep6a' | 'pep6b';

export interface Book {
  id: BookId;
  /** 显示名，如 "三年级上册" */
  name: string;
  grade: number;
  term: '上' | '下';
  /** 所属版本 */
  edition?: Edition;
  /** 单元列表 */
  units: Unit[];
}

export interface Unit {
  /** 单元序号，0 表示 Recycle / 综合复习 */
  no: number;
  /** 英文标题，如 "Hello!" */
  title: string;
  /** 中文主题，如 "问候" */
  cn: string;
  /** 本单元词表 */
  words: Word[];
  /** 本单元自然拼读规律，如 "a 的短音 /æ/" */
  phonics?: string;
}

/** 一个单词的学习掌握度（类似 SM-2 简化版） */
export interface WordProgress {
  /** 熟练度等级 0-5 */
  level: number;
  /** 下次复习时间戳(ms) */
  due: number;
  /** 累计答对次数 */
  right: number;
  /** 累计答错次数 */
  wrong: number;
  /** 连续答对次数 */
  streak: number;
  /** 最近一次作答时间 */
  last: number;
}

/** 宠物状态 */
export interface PetState {
  /** 名字 */
  name: string;
  /** 经验值，决定成长阶段 */
  exp: number;
  /** 饱食度 0-100 */
  hunger: number;
  /** 清洁度 0-100 */
  clean: number;
  /** 心情 0-100 */
  mood: number;
  /** 上次衰减结算时间戳 */
  lastDecay: number;
  /** 装扮：已解锁的小物件 */
  hats: string[];
  /** 当前佩戴 */
  worn: string | null;
}

/** 全局存档 */
export interface SaveData {
  version: number;
  /** 玩家昵称 */
  nickname: string;
  /** 金币 */
  coins: number;
  /** 历史总学习天数打卡记录：'YYYY-MM-DD' -> 当天新增词数 */
  checkins: Record<string, number>;
  /** 连续打卡天数 */
  streakDays: number;
  /** 最后一次打卡日期 */
  lastCheckin: string | null;
  /** 每个单词的进度，key = Word.id */
  progress: Record<string, WordProgress>;
  /** 宠物 */
  pet: PetState;
  /** 已解锁成就 id */
  achievements: string[];
  /** 当前选中的教材 */
  currentBook: BookId;
  /** 当前选中的单元（0 = 全部） */
  currentUnit: number;
  /** 每日目标词数 */
  dailyGoal: number;
  /** 设置 */
  settings: {
    /** 是否开启音效 */
    sound: boolean;
    /** 语音语速 0.5 - 1.2 */
    rate: number;
    /** 语音口音 */
    accent: 'en-US' | 'en-GB';
  };
  /** 每个单词最近一次作答时间，用于统计 */
  history: StudyLog[];
}

export interface StudyLog {
  /** 时间戳 */
  t: number;
  /** 日期 'YYYY-MM-DD' */
  d: string;
  wordId: string;
  /** 是否正确 */
  ok: boolean;
  /** 用时 ms */
  ms: number;
}

/** 题型 */
export type QuizMode =
  | 'en2cn'   // 看英文选中文
  | 'cn2en'   // 看中文选英文
  | 'listen'  // 听音选词
  | 'spell';  // 拼写（字母/音节排序）

export interface QuizQuestion {
  word: Word;
  mode: QuizMode;
  options: string[];
  answer: string;
}
