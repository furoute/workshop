/**
 * 单词猫 — 界面渲染
 *
 * 不引入框架，用模板字符串 + 事件委托，保证包体极小、iOS 上启动快。
 */

import { store, todayLearned, todayProgress, recentDays, calendarGrid, todayStr } from '../core/store';
import { books, wordById, stats, activeEdition, HAS_NEW_EDITION } from '../data';
import { EDITIONS } from '../core/types';
import { PHONICS_3A, type LetterSound } from '../data/phonics-2024';
import { alignPhonetic } from '../core/phonetic';
import {
  currentStage, nextStage, stageProgress, expToNext,
  petMood, MOOD_TEXT, HATS,
  ACHIEVEMENTS, checkAchievements,
} from '../core/pet';
import { speak, speechAvailable } from '../core/audio';
import { buildSession, makeQuestion, scrambleLetters, MODE_LABEL } from '../core/quiz';
import type { Word, QuizQuestion } from '../core/types';

export type Tab = 'home' | 'pet' | 'report' | 'me';

interface AppState {
  tab: Tab;
  route: string;
  /** 会话 */
  session: Word[];
  qi: number;
  question: QuizQuestion | null;
  answered: boolean;
  correctCount: number;
  wrongList: Word[];
  sessionCoins: number;
  sessionStart: number;
  qStart: number;
  /** 拼写题已填字母索引 */
  spellPicked: number[];
  /** 拼读高亮的音节 */
  activeSyl: number;
  /** 当前朗读的音节（拼读页用） */
  spellingWord: Word | null;
  /** 拼读页当前环节：学 / 读 / 练 / 拼 */
  spellStage: 'xue' | 'du' | 'lian' | 'pin';
  /** 拼写题当前这一题的乱序字母缓存 */
  _letters: string[];
}

export const app: AppState = {
  tab: 'home',
  route: 'home',
  session: [],
  qi: 0,
  question: null,
  answered: false,
  correctCount: 0,
  wrongList: [],
  sessionCoins: 0,
  sessionStart: 0,
  qStart: 0,
  spellPicked: [],
  activeSyl: -1,
  spellingWord: null,
  spellStage: 'xue',
  _letters: [],
};

// ─────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

export function toast(msg: string): void {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 260);
  }, 1800);
}

const CAT_IMG: Record<string, string> = {};
function catImg(stage: number): string {
  if (!CAT_IMG[stage]) {
    const base = import.meta.env.BASE_URL || './';
    CAT_IMG[stage] = `${base}cats/stage${stage}.png`;
  }
  return CAT_IMG[stage];
}

// ─────────────────────────────────────────────
// 首页
// ─────────────────────────────────────────────

function screenHome(): string {
  const d = store.data;
  const stage = currentStage(d.pet.exp);
  const learned = store.learnedCount();
  const due = store.dueCount();
  const goal = d.dailyGoal;
  const done = todayLearned();
  const pct = Math.round(todayProgress() * 100);
  const week = recentDays(7);

  const wornHat = HATS.find((h) => h.id === d.pet.worn);

  return `
  <div class="screen">
    <div class="hero">
      <div class="hero-top">
        <div class="greeting">
          你好呀，${esc(d.nickname)}
          <b>今天背单词了吗？</b>
        </div>
        <div style="position:relative">
          <img class="hero-cat" src="${catImg(stage.no)}" alt="我的猫" />
        </div>
      </div>
      <div class="hero-sub">
        🐱 ${esc(d.pet.name)} · ${stage.name}　${
          wornHat ? `戴着${wornHat.name}${wornHat.emoji}` : ''
        }
      </div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="hero-sub" style="margin-top:6px">
        今日目标 ${done}/${goal} 个单词　${pct >= 100 ? '🎉 已完成！' : `还差 ${goal - done} 个`}
      </div>
    </div>

    <div class="stats">
      <div class="stat"><b>${learned}</b><span>已学单词</span></div>
      <div class="stat"><b>${d.streakDays}</b><span>连续天数</span></div>
      <div class="stat"><b>${d.coins}</b><span>金币</span></div>
    </div>

    <div class="actions">
      <button class="action-btn primary" data-go="study">
        <div class="emoji">📖</div>
        <div class="txt">
          <b>开始背单词</b>
          <span>${books().find((b) => b.id === d.currentBook)?.name ?? ''}${
            d.currentUnit === 0 ? ' · 全部单元' : ` · Unit ${d.currentUnit}`
          }</span>
        </div>
        <div class="arrow">›</div>
      </button>

      ${
        due > 0
          ? `<button class="action-btn" data-go="review">
              <div class="emoji">🔁</div>
              <div class="txt">
                <b>复习 ${due} 个到期单词</b>
                <span>按遗忘曲线安排的复习</span>
              </div>
              <div class="arrow">›</div>
            </button>`
          : ''
      }

      <button class="action-btn" data-go="pick">
        <div class="emoji">🎯</div>
        <div class="txt">
          <b>选择教材单元</b>
          <span>学到哪，背到哪</span>
        </div>
        <div class="arrow">›</div>
      </button>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <b style="font-size:15px">本周打卡</b>
        <span style="font-size:12.5px;color:var(--gray);font-weight:600">
          已连续 ${d.streakDays} 天
        </span>
      </div>
      <div class="week">
        ${week
          .map(
            (x) => `
          <div class="day ${x.count > 0 ? 'done' : ''} ${x.date === todayStr() ? 'today' : ''}">
            <div class="dot">${x.count > 0 ? '✓' : ''}</div>
            ${x.label}
          </div>`,
          )
          .join('')}
      </div>
    </div>

    <div class="section-title">🐾 我的猫咪</div>
    <div class="card" style="display:flex;align-items:center;gap:14px">
      <img src="${catImg(stage.no)}" style="width:72px;height:72px;object-fit:contain" alt="" />
      <div style="flex:1">
        <div style="font-weight:800;font-size:15px">${esc(d.pet.name)} · ${stage.name}</div>
        <div style="font-size:12.5px;color:var(--gray);margin:3px 0 7px">
          距离「${nextStage(d.pet.exp)?.name ?? '满级'}」还差 ${expToNext(d.pet.exp)} 经验
        </div>
        <div class="bar dark" style="margin:0"><i style="width:${Math.round(
          stageProgress(d.pet.exp) * 100,
        )}%"></i></div>
      </div>
    </div>
  </div>`;
}

// ─────────────────────────────────────────────
// 选教材单元
// ─────────────────────────────────────────────

function screenPick(): string {
  const d = store.data;
  const book = books().find((b) => b.id === d.currentBook) ?? books()[0];
  const bookWords = book.units.flatMap((u) => u.words);
  const bookLearned = bookWords.filter((w) => (store.peek(w.id)?.level ?? 0) > 0).length;

  return `
  <div class="screen">
    <div class="topbar">
      <button class="icon-btn" data-go="home">‹</button>
      <h1>选择教材</h1>
      <span class="pill">${stats().words} 词</span>
    </div>

    <div class="book-tabs">
      ${books().map(
        (b) => `<button class="tab ${b.id === d.currentBook ? 'active' : ''}" data-book="${b.id}">
          ${b.grade}年${b.term}
        </button>`,
      ).join('')}
    </div>

    <div class="card" style="margin-bottom:12px;display:flex;align-items:center;gap:12px">
      <div style="flex:1">
        <b data-book-name style="font-weight:800;font-size:16px;display:block">${book.name}</b>
        <div style="font-size:12.5px;color:var(--gray);margin-top:2px">
          ${book.units.length} 个单元 · 共 ${bookWords.length} 词 · 已学 ${bookLearned} 词
        </div>
      </div>
      <div style="font-size:20px;font-weight:800;color:var(--green-deep)">
        ${Math.round((bookLearned / Math.max(1, bookWords.length)) * 100)}%
      </div>
    </div>

    <div class="unit-list">
      <button class="unit ${d.currentUnit === 0 ? 'active' : ''}" data-unit="0">
        <div class="unit-no">全部</div>
        <div class="unit-body">
          <b>整册综合练习</b>
          <span>把这一册所有单元混在一起背</span>
        </div>
        <div class="unit-pct">${bookLearned}/${bookWords.length}</div>
      </button>
      ${
        // 三上额外提供「26 个字母」总览（新版 Letters and sounds 的核心内容）
        book.id === 'pep3a'
          ? `<button class="unit" data-go="letters">
              <div class="unit-no" style="background:var(--yellow);color:#fff">ABC</div>
              <div class="unit-body">
                <b>26 个字母发音表</b>
                <span>Letters and sounds · 点字母听发音</span>
              </div>
              <div class="unit-pct">›</div>
            </button>`
          : ''
      }
      ${book.units
        .map((u) => {
          const learned = u.words.filter((w) => (store.peek(w.id)?.level ?? 0) > 0).length;
          const allDone = learned >= u.words.length;
          return `
        <button class="unit ${d.currentUnit === u.no ? 'active' : ''}" data-unit="${u.no}">
          <div class="unit-no">U${u.no}</div>
          <div class="unit-body">
            <b>${esc(u.title)}</b>
            <span>${esc(u.cn)} · ${u.words.length} 词${u.phonics ? ` · 拼读：${esc(u.phonics)}` : ''}</span>
          </div>
          <div class="unit-pct">${allDone ? '✓' : `${learned}/${u.words.length}`}</div>
        </button>`;
        })
        .join('')}
    </div>
  </div>`;
}

// ─────────────────────────────────────────────
// 背单词
// ─────────────────────────────────────────────

function screenQuiz(): string {
  const q = app.question;
  if (!q) return screenHome();
  const total = app.session.length;
  const pct = Math.round((app.qi / total) * 100);

  let body = '';
  if (q.mode === 'spell') {
    const letters = scrambleLetters(q.word);
    const target = q.word.en.replace(/[^a-zA-Z]/g, '').toLowerCase();
    const slots = target
      .split('')
      .map((_, i) => {
        const picked = app.spellPicked[i];
        const ch = picked !== undefined ? letters[picked] : '';
        return `<div class="slot ${ch ? 'filled' : ''}">${ch}</div>`;
      })
      .join('');
    body = `
      <div class="spell-answer">${slots}</div>
      <div class="letters">
        ${letters
          .map(
            (l, i) =>
              `<button class="letter" data-letter="${i}" ${
                app.spellPicked.includes(i) ? 'disabled' : ''
              }>${l}</button>`,
          )
          .join('')}
      </div>
      <div style="text-align:center;margin-top:14px">
        <button class="speak-btn" data-speak>🔊 听一听</button>
        <button class="btn ghost sm" data-undo style="margin-left:8px">撤销</button>
      </div>`;
  } else if (q.mode === 'listen') {
    body = `
      <div class="options">
        ${q.options
          .map(
            (o, i) =>
              `<button class="option" data-opt="${esc(o)}">
                <span class="idx">${i + 1}</span>${esc(o)}
              </button>`,
          )
          .join('')}
      </div>`;
  } else {
    body = `
      <div class="options">
        ${q.options
          .map(
            (o, i) =>
              `<button class="option" data-opt="${esc(o)}">
                <span class="idx">${i + 1}</span>${esc(o)}
              </button>`,
          )
          .join('')}
      </div>`;
  }

  // 题面
  let prompt = '';
  if (q.mode === 'en2cn') {
    prompt = `
      <div class="big-word">${esc(q.word.en)}</div>
      ${q.word.ph ? `<div class="phonetic">/${esc(q.word.ph)}/</div>` : ''}
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        <button class="speak-btn" data-speak>🔊 听发音</button>
        <button class="speak-btn" data-go="spell-now">🧩 拼读</button>
      </div>`;
  } else if (q.mode === 'cn2en') {
    prompt = `
      <div class="meaning" style="font-size:26px;margin-top:0">${esc(q.word.cn)}</div>
      <div style="font-size:13px;color:var(--gray);margin-top:6px">选出对应的英文单词</div>`;
  } else if (q.mode === 'listen') {
    prompt = `
      <div style="font-size:52px;line-height:1.1">🔊</div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:14px">
        <button class="speak-btn" data-speak>再听一次</button>
        <button class="speak-btn" data-go="spell-now">🧩 拼读</button>
      </div>
      <div style="font-size:13px;color:var(--gray);margin-top:8px">听发音，选出正确的单词</div>`;
  } else {
    prompt = `
      <div class="meaning" style="font-size:22px;margin-top:0">${esc(q.word.cn)}</div>
      ${q.word.ph ? `<div class="phonetic">/${esc(q.word.ph)}/</div>` : ''}
      <div style="font-size:13px;color:var(--gray);margin-top:6px">
        共 ${q.word.en.replace(/[^a-zA-Z]/g, '').length} 个字母
      </div>`;
  }

  return `
  <div class="screen">
    <div class="quiz-top">
      <button class="icon-btn" data-go="quit">✕</button>
      <div class="quiz-bar"><i style="width:${pct}%"></i></div>
      <div class="quiz-count">${app.qi + 1}/${total}</div>
      <span class="pill coin">🪙 ${store.data.coins}</span>
    </div>
    <div class="mode-hint">${MODE_LABEL[q.mode]}</div>
    <div class="word-card">${prompt}</div>
    ${body}
  </div>`;
}

// ─────────────────────────────────────────────
// 自然拼读详情页
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// 自然拼读（学 · 读 · 练 · 拼 四环节）
// ─────────────────────────────────────────────

/**
 * 把单词拆成「拼读块」——每一块是一个音节，而不是单个字母。
 *
 * 自然拼读的读法是把音节连起来读（co-lour-ful → colourful），
 * 而不是逐字母念字母名（c-o-l-o-u-r-f-u-l 是错的）。
 *
 * 每块同时给出对应的音标片段，帮孩子建立「这串字母 → 这个音」的对应。
 * 音标无法可靠切分时留空 —— 宁可不显示，也不显示错的音。
 */
export interface Chunk {
  /** 字母串，如 "co" */
  text: string;
  /** 对应的音标片段，如 "kʌ"；切不准时为空 */
  sound: string;
}

/** 生成拼读块 */
export function letterChunks(w: Word): Chunk[] {
  const syl = w.syl?.length ? w.syl : [w.en];
  const sounds = alignPhonetic(w.ph ?? '', syl.length, w.en);
  return syl.map((text, i) => ({
    text,
    sound: sounds ? (sounds[i] ?? '') : '',
  }));
}

function screenSpelling(): string {
  const w = app.spellingWord;
  if (!w) return screenHome();
  const syl = w.syl?.length ? w.syl : [w.en];
  const chunks = letterChunks(w);
  const stage = app.spellStage;

  // 顶部四环节进度条
  const STAGES = [
    { key: 'xue', label: '学', sub: '拆分音节' },
    { key: 'du', label: '读', sub: '专业发音' },
    { key: 'lian', label: '练', sub: '词义详解' },
    { key: 'pin', label: '拼', sub: '自然拼读' },
  ];
  const stageBar = `
    <div class="stage-bar">
      ${STAGES.map(
        (s) => `
        <button class="stage ${stage === s.key ? 'on' : ''}" data-spell-stage="${s.key}">
          <b>${s.label}</b><span>${s.sub}</span>
        </button>`,
      ).join('')}
    </div>`;

  // ── 学：音节拆分 ──
  const xue = `
    <div class="word-card">
      <div class="syl-row">
        ${syl
          .map(
            (s, i) =>
              `<span class="syl ${app.activeSyl === i ? 'active' : ''}" data-syl="${i}">${esc(s)}</span>`,
          )
          .join('')}
      </div>
      ${w.ph ? `<div class="phonetic">/${esc(w.ph)}/</div>` : ''}
      <div class="meaning">${esc(w.cn)}</div>
      <div style="font-size:13px;color:var(--gray);margin-top:10px">
        这个单词可以拆成 <b>${syl.length}</b> 块，点每一块单独听
      </div>
    </div>`;

  // ── 读：发音练习 ──
  const du = `
    <div class="word-card">
      <div class="big-word">${esc(w.en)}</div>
      ${w.ph ? `<div class="phonetic">/${esc(w.ph)}/</div>` : ''}
      <div class="meaning">${esc(w.cn)}</div>
      <div style="display:flex;gap:9px;justify-content:center;margin-top:16px;flex-wrap:wrap">
        <button class="speak-btn" data-speak-word>🔊 正常速度</button>
        <button class="speak-btn" data-speak-slow>🐢 慢速</button>
        <button class="speak-btn" data-speak-syl>🧩 逐块读</button>
      </div>
      <div style="font-size:13px;color:var(--gray);margin-top:14px;line-height:1.6">
        跟着读三遍：先听正常速度，再用慢速跟读，最后自己读一遍。
      </div>
    </div>`;

  // ── 练：词义与例句 ──
  const lian = `
    <div class="word-card">
      <div class="big-word" style="font-size:32px">${esc(w.en)}</div>
      ${w.ph ? `<div class="phonetic">/${esc(w.ph)}/</div>` : ''}
      <div class="meaning">${esc(w.cn)}</div>
    </div>
    <div class="card">
      <b style="font-size:14px">📖 例句</b>
      ${
        w.ex
          ? `<div class="example" style="margin-top:10px;border:0;padding:0">
              <div style="font-size:16px;font-weight:600;color:var(--ink)">${esc(w.ex)}</div>
              ${w.exCn ? `<div class="cn" style="font-size:14px;margin-top:5px">${esc(w.exCn)}</div>` : ''}
              <button class="speak-btn" data-speak-ex style="margin-top:10px">🔊 读例句</button>
            </div>`
          : `<div style="font-size:13.5px;color:var(--gray);margin-top:8px">这个单词暂时没有例句，多读几遍记住它吧～</div>`
      }
    </div>`;

  // ── 拼：自然拼读（按音节块读，不是逐字母读字母名）──
  const pin = `
    <div class="word-card" style="padding-bottom:16px">
      <div class="syl-row" style="margin-bottom:2px">
        ${syl.map((s) => `<span class="syl" style="font-size:26px">${esc(s)}</span>`).join('')}
      </div>
      ${w.ph ? `<div class="phonetic">/${esc(w.ph)}/</div>` : ''}
      <div class="meaning" style="font-size:17px">${esc(w.cn)}</div>
    </div>

    <div class="card">
      <b style="font-size:14px">🔤 音节与发音</b>
      <div style="font-size:12.5px;color:var(--gray);margin-top:5px;line-height:1.55">
        每一块读一个音，把它们连起来就是整个单词。
      </div>

      <div class="chunk-row">
        ${chunks
          .map(
            (c, i) => `
          <button class="chunk" data-chunk="${i}">
            <span class="ch">${esc(c.text)}</span>
            <span class="so">${c.sound ? `/${esc(c.sound)}/` : '&nbsp;'}</span>
          </button>`,
          )
          .join('')}
      </div>

      <div style="display:flex;gap:9px;margin-top:14px">
        <button class="btn sm" style="flex:1" data-blend>🧩 连起来读</button>
        <button class="speak-btn" data-speak-word style="margin-top:0">🔊 整词</button>
      </div>

      <div style="font-size:12.5px;color:var(--gray);margin-top:11px;line-height:1.6">
        先点每一块听它自己的音，再点「连起来读」把音节拼成单词。
        <br />注意读的是<b>字母在单词里的音</b>，不是字母的名字哦。
      </div>
    </div>`;

  const body = stage === 'du' ? du : stage === 'lian' ? lian : stage === 'pin' ? pin : xue;

  return `
  <div class="screen">
    <div class="topbar">
      <button class="icon-btn" data-go="back">‹</button>
      <h1>自然拼读</h1>
    </div>

    ${stageBar}
    ${body}

    <div style="margin-top:16px">
      <button class="btn block" data-go="quiz-from-spell">我学会了，去背单词 ›</button>
    </div>
  </div>`;
}

// ─────────────────────────────────────────────
// 宠物页
// ─────────────────────────────────────────────

function screenPet(): string {
  const d = store.data;
  const pet = d.pet;
  const stage = currentStage(pet.exp);
  const mood = petMood(pet);
  const worn = HATS.find((h) => h.id === pet.worn);
  const unlocked = checkAchievements();

  const gauge = (label: string, val: number, color: string) => `
    <div class="gauge">
      <div class="lbl">${label}</div>
      <div class="track"><i style="width:${Math.round(val)}%;background:${color}"></i></div>
      <div class="val">${Math.round(val)}</div>
    </div>`;

  return `
  <div class="screen">
    <div class="topbar">
      <h1>我的猫咪</h1>
      <span class="pill coin">🪙 ${d.coins}</span>
    </div>

    <div class="pet-stage">
      <div class="pet-cat-wrap">
        <img class="pet-cat" src="${catImg(stage.no)}" alt="猫咪" />
        ${worn ? `<div class="pet-hat">${worn.emoji}</div>` : ''}
        ${mood === 'happy' ? '<div class="pet-sparkle" style="top:14px;left:6px">✨</div><div class="pet-sparkle" style="top:44px;right:8px;animation-delay:.6s">💕</div>' : ''}
        ${mood === 'hungry' ? '<div class="pet-sparkle" style="top:10px;right:16px">🍽️</div>' : ''}
        ${mood === 'dirty' ? '<div class="pet-sparkle" style="top:10px;right:16px">💦</div>' : ''}
      </div>
      <div class="pet-name">${esc(pet.name)}</div>
      <div class="pet-stage-name">${stage.name}</div>
      <div class="pet-mood">${MOOD_TEXT[mood]}</div>

      <div style="margin-top:12px;position:relative;z-index:1">
        <div class="bar dark"><i style="width:${Math.round(stageProgress(pet.exp) * 100)}%"></i></div>
        <div style="font-size:12px;color:var(--gray);margin-top:5px;font-weight:600">
          经验 ${pet.exp}${
            nextStage(pet.exp) ? ` · 再 ${expToNext(pet.exp)} 升级为「${nextStage(pet.exp)!.name}」` : ' · 已满级 👑'
          }
        </div>
      </div>
    </div>

    <div class="gauges">
      ${gauge('🍚 饱食', pet.hunger, 'linear-gradient(90deg,#fbbf24,#f59e0b)')}
      ${gauge('🛁 清洁', pet.clean, 'linear-gradient(90deg,#60a5fa,#3b82f6)')}
      ${gauge('💗 心情', pet.mood, 'linear-gradient(90deg,#f472b6,#ec4899)')}
    </div>

    <div class="pet-actions">
      <button class="pet-act" data-act="feed">
        <div class="e">🐟</div><div class="t">喂食</div><div class="c">5 🪙</div>
      </button>
      <button class="pet-act" data-act="bath">
        <div class="e">🛁</div><div class="t">洗澡</div><div class="c">5 🪙</div>
      </button>
      <button class="pet-act" data-act="play">
        <div class="e">🎾</div><div class="t">玩耍</div><div class="c">3 🪙</div>
      </button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
      <button class="btn ghost sm" data-act="pet">🤚 摸摸它（免费）</button>
      <button class="btn ghost sm" data-go="rename">✏️ 改名字</button>
    </div>

    <div class="section-title">👗 装扮小铺</div>
    <div class="hat-grid">
      ${HATS.map((h) => {
        const owned = pet.hats.includes(h.id);
        const isWorn = pet.worn === h.id;
        const lockStage = currentStage(pet.exp).no < h.needStage;
        return `
        <button class="hat ${owned ? 'owned' : ''} ${isWorn ? 'worn' : ''} ${lockStage && !owned ? 'locked' : ''}"
                data-hat="${h.id}">
          <div class="e">${h.emoji}</div>
          <div class="n">${h.name}</div>
          <div class="p">${owned ? (isWorn ? '佩戴中' : '点击佩戴') : `${h.price} 🪙`}</div>
        </button>`;
      }).join('')}
    </div>
    ${
      pet.worn
        ? '<div style="margin-top:10px"><button class="btn ghost sm block" data-hat="">取下装扮</button></div>'
        : ''
    }

    <div class="section-title">🏆 成就徽章</div>
    <div class="ach-grid">
      ${ACHIEVEMENTS.map((a) => {
        const got = d.achievements.includes(a.id);
        return `<div class="ach ${got ? 'got' : ''}">
          <div class="e">${a.emoji}</div>
          <div class="n">${a.name}</div>
        </div>`;
      }).join('')}
    </div>

    ${
      unlocked.length
        ? `<div class="overlay" data-close="ach"><div class="modal">
            <div style="font-size:46px">🎉</div>
            <h3>解锁新成就！</h3>
            <p>${unlocked.map((a) => `${a.emoji} ${a.name}`).join('　')}</p>
            <button class="btn block" data-close="ach">太棒了</button>
          </div></div>`
        : ''
    }
  </div>`;
}

// ─────────────────────────────────────────────
// 报告页
// ─────────────────────────────────────────────

function screenReport(): string {
  const d = store.data;
  const learned = store.learnedCount();
  const mastered = store.masteredCount();
  const due = store.dueCount();
  const week = recentDays(7);
  const maxCount = Math.max(1, ...week.map((x) => x.count));
  const grid = calendarGrid(12);
  const wrongIds = store.wrongBook();

  // 掌握度分布
  const dist = [0, 0, 0, 0, 0, 0];
  Object.values(d.progress).forEach((p) => {
    dist[Math.min(5, p.level)]++;
  });

  const total = stats().words;
  const todayDone = todayLearned();

  return `
  <div class="screen">
    <div class="topbar"><h1>学习报告</h1></div>

    <div class="report-grid">
      <div class="report-cell"><b>${learned}</b><span>已学单词 / 共 ${total}</span></div>
      <div class="report-cell"><b>${mastered}</b><span>已掌握（4级以上）</span></div>
      <div class="report-cell"><b>${d.streakDays}</b><span>连续打卡天数</span></div>
      <div class="report-cell"><b>${todayDone}</b><span>今日学习词数</span></div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <b style="font-size:14px">📈 最近 7 天</b>
      <div class="chart">
        ${week
          .map(
            (x) => `
          <div class="col">
            <i style="height:${Math.round((x.count / maxCount) * 82)}%"></i>
            <span>${x.label}</span>
          </div>`,
          )
          .join('')}
      </div>
      <div style="font-size:12px;color:var(--gray);text-align:center;margin-top:4px">
        柱子越高表示那天背的单词越多
      </div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <b style="font-size:14px">🔥 打卡日历（近 12 周）</b>
      <div class="heat" style="margin-top:10px">
        ${grid
          .map(
            (wk) => `<div class="wk">${wk
              .map((c) => {
                const lv = c.count === 0 ? 0 : c.count < 5 ? 1 : c.count < 12 ? 2 : c.count < 25 ? 3 : 4;
                return `<div class="cell ${lv ? 'l' + lv : ''}" title="${c.date}: ${c.count}"></div>`;
              })
              .join('')}</div>`,
          )
          .join('')}
      </div>
      <div style="font-size:11.5px;color:var(--gray);margin-top:8px">
        颜色越深，那天学得越多
      </div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <b style="font-size:14px">🎚️ 掌握度分布</b>
      <div style="margin-top:10px;display:grid;gap:6px">
        ${dist
          .map((n, lv) => {
            const label = ['未学', '刚认识', '有印象', '较熟练', '熟练', '已掌握'][lv];
            const w = total ? (n / total) * 100 : 0;
            return `<div style="display:flex;align-items:center;gap:8px;font-size:12px">
              <span style="width:48px;color:var(--gray);font-weight:600">${label}</span>
              <div style="flex:1;height:9px;background:#f3f4f6;border-radius:99px;overflow:hidden">
                <i style="display:block;height:100%;width:${w}%;border-radius:99px;background:${
                  ['#e5e7eb', '#fca5a5', '#fdba74', '#fde047', '#86efac', '#22c55e'][lv]
                }"></i>
              </div>
              <span style="width:34px;text-align:right;font-weight:700">${n}</span>
            </div>`;
          })
          .join('')}
      </div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <b style="font-size:14px">📕 错题本</b>
        <span style="font-size:12.5px;color:var(--gray);font-weight:600">
          ${wrongIds.length} 个待攻克 · 到期复习 ${due}
        </span>
      </div>
      <div style="margin-top:10px">
        ${
          wrongIds.length === 0
            ? `<div class="empty" style="padding:20px">
                <div class="e">🌟</div><b>太厉害了</b><p>还没有错题，继续保持！</p>
              </div>`
            : wrongIds
                .slice(0, 30)
                .map((id) => {
                  const w = wordById().get(id);
                  if (!w) return '';
                  const p = store.peek(id)!;
                  return `<div class="wrong-item">
                    <div style="flex:1;min-width:0">
                      <div class="en">${esc(w.en)}</div>
                      <div class="cn">${esc(w.cn)}</div>
                    </div>
                    <span class="badge">错 ${p.wrong} 次</span>
                  </div>`;
                })
                .join('')
        }
      </div>
      ${
        wrongIds.length
          ? `<button class="btn block sm" data-go="wrong-practice" style="margin-top:10px">
              专项攻克这 ${wrongIds.length} 个错词
            </button>`
          : ''
      }
    </div>
  </div>`;
}

// ─────────────────────────────────────────────
// 我的 / 设置
// ─────────────────────────────────────────────

function screenMe(): string {
  const d = store.data;
  const s = d.settings;
  const cur = activeEdition();
  const meta = EDITIONS.find((e) => e.id === cur) ?? EDITIONS[0];
  const st = stats();
  const wrongEdition = cur !== 'pep-2024';

  return `
  <div class="screen">
    <div class="topbar"><h1>我的</h1></div>

    <div class="card" style="display:flex;align-items:center;gap:14px;margin-bottom:12px">
      <div style="width:56px;height:56px;border-radius:50%;background:var(--mint);display:grid;place-items:center;font-size:26px">
        ${currentStage(d.pet.exp).no >= 4 ? '😼' : '🐱'}
      </div>
      <div style="flex:1">
        <div style="font-weight:800;font-size:17px">${esc(d.nickname)}</div>
        <div style="font-size:12.5px;color:var(--gray)">已学 ${store.learnedCount()} 词 · 连续 ${d.streakDays} 天</div>
      </div>
      <button class="icon-btn" data-go="rename">✏️</button>
    </div>

    <div class="section-title">学习设置</div>

    <div class="setting">
      <div class="lbl">每日目标
        <span class="desc">每天计划背多少个单词</span>
      </div>
      <div class="stepper">
        <button data-goal="-5">−</button>
        <b>${d.dailyGoal}</b>
        <button data-goal="5">＋</button>
      </div>
    </div>

    <div class="setting">
      <div class="lbl">发音音效
        <span class="desc">答题时的提示音</span>
      </div>
      <button class="switch ${s.sound ? 'on' : ''}" data-toggle="sound"></button>
    </div>

    <div class="setting">
      <div class="lbl">语速
        <span class="desc">当前 ${s.rate.toFixed(2)} 倍速，慢一点听得更清楚</span>
      </div>
      <div class="stepper">
        <button data-rate="-0.05">−</button>
        <b>${s.rate.toFixed(2)}</b>
        <button data-rate="0.05">＋</button>
      </div>
    </div>

    <div class="setting">
      <div class="lbl">发音口音</div>
      <div style="display:flex;gap:6px">
        <button class="tab ${s.accent === 'en-US' ? 'active' : ''}" data-accent="en-US"
          style="box-shadow:none">美音</button>
        <button class="tab ${s.accent === 'en-GB' ? 'active' : ''}" data-accent="en-GB"
          style="box-shadow:none">英音</button>
      </div>
    </div>

    <div class="setting">
      <div class="lbl">测试发音
        <span class="desc">${speechAvailable() ? '点一下听听效果' : '当前浏览器不支持语音'}</span>
      </div>
      <button class="btn ghost sm" data-test-speak>🔊 试听</button>
    </div>

    <div class="section-title">数据</div>

    <div class="setting">
      <div class="lbl">导出学习数据
        <span class="desc">保存成文件，可备份或发给家长看</span>
      </div>
      <button class="btn ghost sm" data-go="export">导出</button>
    </div>

    <div class="setting">
      <div class="lbl">重置全部数据
        <span class="desc" style="color:var(--red)">会清空所有学习记录，谨慎操作</span>
      </div>
      <button class="btn ghost sm" data-go="reset" style="color:var(--red);box-shadow:0 3px 0 #fecaca,inset 0 0 0 2px #fecaca">重置</button>
    </div>

    <div class="section-title">📗 教材版本</div>

    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">${wrongEdition ? '⚠️' : '✅'}</div>
        <div style="flex:1">
          <b style="font-size:14px" data-edition-name>${meta.name}</b>
          <div style="font-size:12px;color:var(--gray);margin-top:2px">${meta.desc}</div>
        </div>
      </div>

      ${
        HAS_NEW_EDITION
          ? `<div style="margin-top:12px;display:flex;gap:8px">
              <button class="btn ${cur === 'pep-2012' ? '' : 'ghost'} sm" style="flex:1"
                data-edition="pep-2012">旧版</button>
              <button class="btn ${cur === 'pep-2024' ? '' : 'ghost'} sm" style="flex:1"
                data-edition="pep-2024">2024 新版</button>
            </div>
            <div style="font-size:11.5px;color:var(--gray);margin-top:8px;line-height:1.6">
              切换后词库立即生效，学习记录会保留（不同版本的单词各自独立计分）。
            </div>`
          : `<div style="margin-top:10px;padding:10px 12px;background:#fef3c7;border-radius:10px;
                font-size:12.5px;line-height:1.7;color:#92400e">
              <b>当前只有旧版词库</b>，还没有 2024 新版数据。<br />
              请确认孩子课本扉页的版次：
              <div style="margin-top:7px;padding:8px 10px;background:#fff;border-radius:8px;line-height:1.9">
                · 写「<b>2024年7月第1版</b>」→ 是<b>新版</b>，需要导入新版词表<br />
                · 写「2013年10月第1版」→ 是<b>旧版</b>，现在就能用
              </div>
              <div style="margin-top:8px">
                最简判断法：翻到目录看 <b>Unit 1</b>——
                <b>Making friends</b> 是新版，<b>Hello!</b> 是旧版。
              </div>
            </div>`
      }

      <div style="font-size:11.5px;color:var(--gray);margin-top:10px;line-height:1.6">
        当前词库：共 ${st.books} 册 ${st.units} 单元 <b>${st.words}</b> 个单词
      </div>
    </div>

    <div class="card" style="margin-top:14px;text-align:center;font-size:12px;color:var(--gray);line-height:1.7">
      <b style="color:var(--ink);font-size:13px">单词猫 v1.0</b><br />
      人教PEP 三年级起点 · 3-6 年级<br />
      <span style="opacity:.8">在 iPhone 上「添加到主屏幕」即可离线使用</span>
    </div>
  </div>`;
}

// ─────────────────────────────────────────────
// 会话结算
// ─────────────────────────────────────────────

function screenDone(): string {
  const total = app.session.length;
  const right = app.correctCount;
  const rate = total ? Math.round((right / total) * 100) : 0;
  const catMood = rate >= 80 ? '🎉' : rate >= 50 ? '👍' : '💪';
  const title = rate >= 80 ? '太棒啦！' : rate >= 50 ? '做得不错' : '继续加油';

  return `
  <div class="screen">
    <div class="done-screen">
      <div class="emoji-big">${catMood}</div>
      <h2>${title}</h2>
      <p>${esc(store.data.pet.name)} 也为你高兴～</p>

      <div class="reward-row">
        <div class="reward"><b>${right}</b><span>答对</span></div>
        <div class="reward"><b>${total - right}</b><span>答错</span></div>
        <div class="reward"><b>${rate}%</b><span>正确率</span></div>
      </div>

      <div class="card" style="width:100%;text-align:left;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700">
          <span>🪙 本次获得金币</span><span style="color:#b45309">+${app.sessionCoins}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;margin-top:9px">
          <span>🐱 猫咪经验</span><span style="color:var(--green-deep)">+${right * 10 + (total - right) * 3}</span>
        </div>
        ${
          app.wrongList.length
            ? `<div style="margin-top:12px;padding-top:11px;border-top:1px dashed var(--line)">
                <div style="font-size:13px;color:var(--gray);margin-bottom:7px">本次答错的词（已加入错题本）</div>
                ${app.wrongList
                  .slice(0, 6)
                  .map(
                    (w) =>
                      `<div style="font-size:14px;font-weight:700;color:var(--ink);margin:4px 0">
                        · ${esc(w.en)} <span style="color:var(--gray);font-weight:500">${esc(w.cn)}</span>
                      </div>`,
                  )
                  .join('')}
              </div>`
            : ''
        }
      </div>

      <div style="display:flex;gap:10px;width:100%">
        <button class="btn ghost" style="flex:1" data-go="home">回首页</button>
        <button class="btn" style="flex:1" data-go="study">再来一组</button>
      </div>
    </div>
  </div>`;
}

// ─────────────────────────────────────────────
// 26 个字母发音表（2024 新版三上 Letters and sounds）
// ─────────────────────────────────────────────

function screenLetters(): string {
  const units = PHONICS_3A;

  const letterCard = (l: LetterSound) => `
    <button class="letter-card" data-letter-say="${esc(l.upper)}">
      <div class="lc-big">${esc(l.upper)}${esc(l.lower)}</div>
      <div class="lc-ipa">/${esc(l.ipa)}/</div>
      <div class="lc-words">${l.examples.map((w) => esc(w)).join(' · ')}</div>
    </button>`;

  return `
  <div class="screen">
    <div class="topbar">
      <button class="icon-btn" data-go="pick">‹</button>
      <h1>字母发音表</h1>
      <span class="pill">26 个</span>
    </div>

    <div class="card" style="margin-bottom:12px;background:var(--mint)">
      <div style="font-size:13.5px;line-height:1.7;color:var(--ink-2)">
        <b>Letters and sounds</b> 是新版三上 Part A 的语音板块，
        教 26 个字母的<b>字母名</b>和<b>字母音</b>。
        <br />点任意字母可以听它的发音，跟着读一读吧！
      </div>
    </div>

    ${units
      .map(
        (u) => `
      <div class="section-title">U${u.unit} · ${esc(u.summary)}</div>
      <div class="letter-grid">
        ${(u.letters ?? []).map(letterCard).join('')}
      </div>`,
      )
      .join('')}

    <div style="margin-top:16px">
      <button class="btn block ghost" data-go="study">去背单词 ›</button>
    </div>
  </div>`;
}

// ─────────────────────────────────────────────
// 主渲染
// ─────────────────────────────────────────────

export function render(): void {
  const root = document.getElementById('app');
  if (!root) return;

  let html = '';
  switch (app.route) {
    case 'pick': html = screenPick(); break;
    case 'letters': html = screenLetters(); break;
    case 'quiz': html = screenQuiz(); break;
    case 'spell': html = screenSpelling(); break;
    case 'done': html = screenDone(); break;
    case 'report': html = screenReport(); break;
    case 'pet': html = screenPet(); break;
    case 'me': html = screenMe(); break;
    default: html = screenHome();
  }

  const showTabs = ['home', 'pet', 'report', 'me'].includes(app.route);
  const tabbar = showTabs
    ? `<nav class="tabbar">
        ${tabBtn('home', '🏠', '首页')}
        ${tabBtn('pet', '🐱', '猫咪')}
        ${tabBtn('report', '📊', '报告')}
        ${tabBtn('me', '⚙️', '我的')}
      </nav>`
    : '';

  root.innerHTML = html + tabbar;
}

function tabBtn(tab: Tab, emoji: string, label: string): string {
  return `<button class="${app.tab === tab ? 'active' : ''}" data-tab="${tab}">
    <span class="e">${emoji}</span><span class="t">${label}</span>
  </button>`;
}

export function go(route: string): void {
  app.route = route;
  if (['home', 'pet', 'report', 'me'].includes(route)) app.tab = route as Tab;
  render();
}

// ─────────────────────────────────────────────
// 学习会话控制
// ─────────────────────────────────────────────

export function startSession(words?: Word[]): void {
  app.session = words ?? buildSession(store.data.dailyGoal || 10);
  app.qi = 0;
  app.correctCount = 0;
  app.wrongList = [];
  app.sessionCoins = 0;
  app.sessionStart = Date.now();
  nextQuestion();
  go('quiz');
}

function nextQuestion(): void {
  const w = app.session[app.qi];
  if (!w) {
    app.route = 'done';
    return;
  }
  app.question = makeQuestion(w, app.session);
  app.answered = false;
  app.spellPicked = [];
  app.activeSyl = -1;
  app.qStart = Date.now();
  app.route = 'quiz';

  // 听力题自动播放
  if (app.question.mode === 'listen') {
    setTimeout(() => speak(w.en), 320);
  }
}
