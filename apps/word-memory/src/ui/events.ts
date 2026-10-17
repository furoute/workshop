/**
 * 单词猫 — 事件处理
 *
 * 全部使用事件委托，绑定在 #app 上，避免重复渲染时反复解绑。
 */

import { store, recordAnswer } from '../core/store';
import { wordById, allWords, books, setEdition, activeEdition } from '../data';
import type { Edition } from '../core/types';
import { ALL_LETTERS } from '../data/phonics-2024';
import {
  feed, bath, play, petPet, HATS, buyHat, wearHat, settleDecay,
} from '../core/pet';
import { speak, speakSyllables, beep, unlockAudio, stopSpeaking } from '../core/audio';
import { wordsInScope, makeQuestion } from '../core/quiz';
import type { Word, BookId } from '../core/types';
import {
  app, render, go, toast, startSession, letterChunks, type Tab,
} from './screens';

/** 缓存当前题的乱序字母，保证渲染与判定一致 */
function buildLetters(w: Word): string[] {
  const letters = w.en.replace(/[^a-zA-Z]/g, '').split('');
  const out = letters.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─────────────────────────────────────────────
// 答题
// ─────────────────────────────────────────────

function answer(picked: string | null, isCorrect: boolean): void {
  const q = app.question;
  if (!q || app.answered) return;
  app.answered = true;

  const ms = Date.now() - app.qStart;
  recordAnswer(q.word.id, isCorrect, ms);
  beep(isCorrect ? 'right' : 'wrong');

  if (isCorrect) {
    app.correctCount++;
    app.sessionCoins += 2;
  } else {
    app.wrongList.push(q.word);
    app.sessionCoins += 1;
  }

  // 标记选项样式
  const opts = document.querySelectorAll<HTMLButtonElement>('.option');
  opts.forEach((el) => {
    el.disabled = true;
    const val = el.dataset.opt ?? '';
    if (val === q.answer) el.classList.add('right');
    else if (picked !== null && val === picked) el.classList.add('wrong');
  });

  showFeedback(isCorrect, picked);
}

function showFeedback(ok: boolean, picked: string | null): void {
  const q = app.question!;
  const old = document.querySelector('.feedback');
  if (old) old.remove();

  const el = document.createElement('div');
  el.className = `feedback ${ok ? 'ok' : 'no'}`;
  const emoji = ok ? ['🎉', '⭐️', '👏', '💯', '🌟'][Math.floor(Math.random() * 5)] : '💪';

  el.innerHTML = `
    <div class="fb-emoji">${emoji}</div>
    <div class="fb-txt">
      <b>${ok ? '答对啦！' : '再记一下'}</b>
      <span>${
        ok
          ? `+2 金币`
          : `${escapeHtml(q.word.en)} — ${escapeHtml(q.word.cn)}${
              picked ? `　你选了「${escapeHtml(picked)}」` : ''
            }`
      }</span>
    </div>
    ${
      ok
        ? ''
        : `<button class="btn sm" data-learn-this style="margin-right:6px;background:rgba(255,255,255,.95);color:#c2410c">🧩 学一下</button>`
    }
    <button class="btn sm" data-next>${app.qi + 1 >= app.session.length ? '完成' : '下一个'} ›</button>
  `;
  document.body.appendChild(el);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function nextQuestionPublic(): void {
  document.querySelector('.feedback')?.remove();
  app.qi++;
  if (app.qi >= app.session.length) {
    store.flush();
    go('done');
    return;
  }
  const w = app.session[app.qi];
  app._letters = buildLetters(w);
  app.question = makeQuestion(w, app.session);
  app.answered = false;
  app.spellPicked = [];
  app.activeSyl = -1;
  app.qStart = Date.now();
  render();
  if (app.question.mode === 'listen') setTimeout(() => speak(w.en), 320);
}

// ─────────────────────────────────────────────
// 点击处理
// ─────────────────────────────────────────────

async function onClick(e: Event): Promise<void> {
  const target = e.target as HTMLElement;
  unlockAudio();

  // 关闭弹层
  const closer = target.closest<HTMLElement>('[data-close]');
  if (closer) {
    closer.closest('.overlay')?.remove();
    return;
  }

  // 底部导航
  const tabEl = target.closest<HTMLElement>('[data-tab]');
  if (tabEl) {
    stopSpeaking();
    settleDecay();
    go(tabEl.dataset.tab as Tab);
    return;
  }

  // 页面跳转
  const goEl = target.closest<HTMLElement>('[data-go]');
  if (goEl) {
    const dest = goEl.dataset.go!;
    stopSpeaking();
    switch (dest) {
      case 'study':
        settleDecay();
        startSession();
        return;
      case 'review': {
        const now = Date.now();
        const scope = wordsInScope(store.data.currentBook, store.data.currentUnit);
        const due = scope.filter((w) => {
          const p = store.peek(w.id);
          return p && p.level > 0 && p.due <= now;
        });
        if (!due.length) {
          toast('暂时没有到期的复习词啦～');
          return;
        }
        startSession(due.slice(0, Math.max(5, store.data.dailyGoal)));
        return;
      }
      case 'wrong-practice': {
        const ids = store.wrongBook();
        const words = ids
          .map((id) => wordById().get(id))
          .filter((w): w is Word => !!w)
          .slice(0, 12);
        if (!words.length) {
          toast('错题本是空的，太棒啦！');
          return;
        }
        startSession(words);
        return;
      }
      case 'quit':
        stopSpeaking();
        go('home');
        return;
      case 'back':
        stopSpeaking();
        app.spellingWord = null;
        // 若从答题中途进来的，回到答题页
        render();
        return;
      case 'spell-now': {
        // 答题途中打开当前词的拼读页
        const w = app.question?.word;
        if (!w) return;
        stopSpeaking();
        app.spellingWord = w;
        app.spellStage = 'xue';
        app.activeSyl = -1;
        go('spell');
        return;
      }
      case 'quiz-from-spell':
        stopSpeaking();
        app.spellingWord = null;
        // 从答题中途进来的，回答题页继续；否则开新的一组
        if (app.question && app.route === 'spell' && app.session.length) {
          go('quiz');
        } else {
          startSession();
        }
        return;
      case 'rename': {
        const name = prompt('给猫咪起个名字吧：', store.data.pet.name);
        if (name && name.trim()) {
          store.data.pet.name = name.trim().slice(0, 8);
          // 顺便允许改玩家昵称
          const nick = prompt('你的昵称：', store.data.nickname);
          if (nick && nick.trim()) store.data.nickname = nick.trim().slice(0, 10);
          store.commit();
          toast('改好啦～');
        }
        render();
        return;
      }
      case 'export': {
        const blob = new Blob([JSON.stringify(store.data, null, 2)], {
          type: 'application/json',
        });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `单词猫-学习数据-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
        toast('数据已导出');
        return;
      }
      case 'reset': {
        const el = document.createElement('div');
        el.className = 'overlay';
        el.innerHTML = `<div class="modal">
          <div style="font-size:44px">⚠️</div>
          <h3>确定要重置吗？</h3>
          <p>所有学习记录、金币和猫咪成长都会被清空，无法恢复。</p>
          <div class="row">
            <button class="btn ghost" data-close>取消</button>
            <button class="btn" data-confirm-reset style="background:#ef4444;box-shadow:0 4px 0 #b91c1c">确定重置</button>
          </div>
        </div>`;
        document.body.appendChild(el);
        return;
      }
      default:
        go(dest);
        return;
    }
  }

  // 确认重置
  if (target.closest('[data-confirm-reset]')) {
    store.reset();
    document.querySelector('.overlay')?.remove();
    toast('已重置');
    go('home');
    return;
  }

  // 选教材
  const bookEl = target.closest<HTMLElement>('[data-book]');
  if (bookEl) {
    store.data.currentBook = bookEl.dataset.book as BookId;
    store.data.currentUnit = 0;
    store.commit();
    render();
    return;
  }

  // 选单元
  const unitEl = target.closest<HTMLElement>('[data-unit]');
  if (unitEl) {
    store.data.currentUnit = Number(unitEl.dataset.unit);
    store.commit();
    const words = wordsInScope(store.data.currentBook, store.data.currentUnit);
    toast(`已选择 ${words.length} 个单词`);
    render();
    return;
  }

  // 选项作答
  const optEl = target.closest<HTMLButtonElement>('.option');
  if (optEl && !app.answered) {
    const val = optEl.dataset.opt ?? '';
    answer(val, val === app.question?.answer);
    return;
  }

  // 下一个
  if (target.closest('[data-next]')) {
    nextQuestionPublic();
    return;
  }

  // 字母发音表：点字母读它的字母音 + 例词
  const sayEl = target.closest<HTMLElement>('[data-letter-say]');
  if (sayEl) {
    const upper = sayEl.dataset.letterSay!;
    const letter = ALL_LETTERS.find((l) => l.upper === upper);
    if (letter) {
      // 先读字母名，再读第一个例词
      speak(`${letter.upper}. /${letter.ipa}/. ${letter.examples[0] ?? ''}`, { rate: 0.7 });
      sayEl.classList.add('speaking');
      setTimeout(() => sayEl.classList.remove('speaking'), 900);
    }
    return;
  }

  // 发音
  if (target.closest('[data-speak]')) {
    const w = app.question?.word;
    if (w) speak(w.en);
    return;
  }

  // 答错后点「学一下」：进入该词的自然拼读页
  if (target.closest('[data-learn-this]')) {
    const w = app.question?.word;
    if (!w) return;
    stopSpeaking();
    document.querySelector('.feedback')?.remove();
    app.spellingWord = w;
    app.spellStage = 'xue';
    app.activeSyl = -1;
    go('spell');
    return;
  }

  // 拼读页四环节切换
  const stageEl = target.closest<HTMLElement>('[data-spell-stage]');
  if (stageEl) {
    stopSpeaking();
    app.spellStage = stageEl.dataset.spellStage as 'xue' | 'du' | 'lian' | 'pin';
    app.activeSyl = -1;
    render();
    // 进「读」环节自动读一遍
    if (app.spellStage === 'du' && app.spellingWord) {
      setTimeout(() => speak(app.spellingWord!.en), 250);
    }
    return;
  }

  // 拼读页「拼」环节：点单个音节块 —— 读该音节的音，不是读字母名
  const chunkEl = target.closest<HTMLElement>('[data-chunk]');
  if (chunkEl) {
    const w = app.spellingWord;
    if (!w) return;
    const chunks = letterChunks(w);
    const c = chunks[Number(chunkEl.dataset.chunk)];
    if (c) {
      // 关键：读音节本身（如 "co" → /kə/），而不是把字母名 c、o 逐个念出来
      speak(c.text, { rate: 0.55 });
      chunkEl.classList.add('speaking');
      setTimeout(() => chunkEl.classList.remove('speaking'), 700);
    }
    return;
  }

  // 连起来读：逐块读音节，最后读整词
  if (target.closest('[data-blend]')) {
    const w = app.spellingWord;
    if (!w) return;
    const chunks = letterChunks(w);
    // 按朗读节奏依次高亮每一块
    const per = 620;
    chunks.forEach((_, i) => {
      setTimeout(() => {
        document.querySelectorAll('.chunk').forEach((el, j) => {
          el.classList.toggle('speaking', i === j);
        });
      }, i * per);
    });
    setTimeout(() => {
      document.querySelectorAll('.chunk').forEach((el) => el.classList.remove('speaking'));
    }, chunks.length * per + 400);

    speakSyllables(chunks.map((c) => c.text), w.en);
    return;
  }

  // 慢速朗读
  if (target.closest('[data-speak-slow]')) {
    const w = app.spellingWord;
    if (w) speak(w.en, { rate: 0.55 });
    return;
  }

  // 朗读例句
  if (target.closest('[data-speak-ex]')) {
    const w = app.spellingWord;
    if (w?.ex) speak(w.ex, { rate: 0.8 });
    return;
  }

  // 拼读页：读整词 / 拆开读 / 点单个音节
  if (target.closest('[data-speak-word]')) {
    const w = app.spellingWord;
    if (w) speak(w.en);
    return;
  }
  if (target.closest('[data-speak-syl]')) {
    const w = app.spellingWord;
    if (w) speakSyllables(w.syl ?? [w.en], w.en);
    return;
  }
  const sylEl = target.closest<HTMLElement>('[data-syl]');
  if (sylEl) {
    const w = app.spellingWord;
    if (!w) return;
    const i = Number(sylEl.dataset.syl);
    const syl = w.syl ?? [w.en];
    app.activeSyl = i;
    speak(syl[i], { rate: Math.max(0.4, store.data.settings.rate - 0.3) });
    render();
    setTimeout(() => {
      if (app.activeSyl === i) {
        app.activeSyl = -1;
        render();
      }
    }, 900);
    return;
  }

  // 拼写题：点字母
  const letterEl = target.closest<HTMLButtonElement>('[data-letter]');
  if (letterEl && !app.answered) {
    const idx = Number(letterEl.dataset.letter);
    const letters = app._letters ?? (app._letters = buildLetters(app.question!.word));
    const ch = letters[idx];
    app._letters = letters;
    app.spellPicked.push(idx);
    // 立即重绘拼写区
    updateSpellUI();
    speak(ch, { rate: 0.7 });

    const target = app.question!.word.en.replace(/[^a-zA-Z]/g, '').toLowerCase();
    const cur = app.spellPicked.map((i) => letters[i]).join('').toLowerCase();
    if (cur.length === target.length) {
      setTimeout(() => answer(cur, cur === target), 260);
    }
    return;
  }

  // 撤销
  if (target.closest('[data-undo]') && !app.answered) {
    app.spellPicked.pop();
    updateSpellUI();
    return;
  }

  // 宠物互动
  const actEl = target.closest<HTMLElement>('[data-act]');
  if (actEl) {
    settleDecay();
    const act = actEl.dataset.act!;
    const r =
      act === 'feed' ? feed() : act === 'bath' ? bath() : act === 'play' ? play() : petPet();
    toast(r.msg);
    render();
    return;
  }

  // 装扮
  const hatEl = target.closest<HTMLElement>('[data-hat]');
  if (hatEl) {
    const id = hatEl.dataset.hat!;
    if (!id) {
      wearHat(null);
      toast('取下装扮啦');
      render();
      return;
    }
    const hat = HATS.find((h) => h.id === id)!;
    if (store.data.pet.hats.includes(id)) {
      wearHat(store.data.pet.worn === id ? null : id);
      toast(store.data.pet.worn ? `戴上${hat.name}啦 ${hat.emoji}` : '取下装扮啦');
    } else {
      const r = buyHat(hat);
      toast(r.msg);
    }
    render();
    return;
  }

  // 设置项
  const togEl = target.closest<HTMLElement>('[data-toggle]');
  if (togEl) {
    const k = togEl.dataset.toggle!;
    if (k === 'sound') store.data.settings.sound = !store.data.settings.sound;
    store.commit();
    render();
    return;
  }

  const goalEl = target.closest<HTMLElement>('[data-goal]');
  if (goalEl) {
    const delta = Number(goalEl.dataset.goal);
    store.data.dailyGoal = Math.max(5, Math.min(50, store.data.dailyGoal + delta));
    store.commit();
    render();
    return;
  }

  const rateEl = target.closest<HTMLElement>('[data-rate]');
  if (rateEl) {
    const delta = Number(rateEl.dataset.rate);
    const r = Math.round((store.data.settings.rate + delta) * 100) / 100;
    store.data.settings.rate = Math.max(0.5, Math.min(1.2, r));
    store.commit();
    render();
    return;
  }

  const accEl = target.closest<HTMLElement>('[data-accent]');
  if (accEl) {
    store.data.settings.accent = accEl.dataset.accent as 'en-US' | 'en-GB';
    store.commit();
    render();
    return;
  }

  // 教材版本切换
  const edEl = target.closest<HTMLElement>('[data-edition]');
  if (edEl) {
    const want = edEl.dataset.edition as Edition;
    if (setEdition(want)) {
      // 切换版本后，当前选中的册/单元可能不存在，重置到该版本的第一册
      const list = books();
      const first = list[0];
      if (first && !list.some((b) => b.id === store.data.currentBook)) {
        store.data.currentBook = first.id;
        store.data.currentUnit = 0;
        store.commit();
      }
      toast(want === 'pep-2024' ? '已切换到 2024 新版词库' : '已切换到旧版词库');
    } else {
      toast('新版词库还没导入，请先运行 pnpm add:new');
    }
    render();
    return;
  }

  if (target.closest('[data-test-speak]')) {
    speak('Hello! I am your word pet. Let us learn English together.');
    return;
  }
}

/** 只更新拼写区，避免整页重绘导致动画闪烁 */
function updateSpellUI(): void {
  const q = app.question;
  if (!q) return;
  const letters = app._letters ?? [];
  const target = q.word.en.replace(/[^a-zA-Z]/g, '').toLowerCase();

  const slots = document.querySelectorAll<HTMLElement>('.slot');
  slots.forEach((el, i) => {
    const picked = app.spellPicked[i];
    const ch = picked !== undefined ? letters[picked] ?? '' : '';
    el.textContent = ch;
    el.classList.toggle('filled', !!ch);
  });

  document.querySelectorAll<HTMLButtonElement>('.letter').forEach((el) => {
    const idx = Number(el.dataset.letter);
    el.disabled = app.spellPicked.includes(idx);
  });

  if (target.length !== slots.length) render();
}

// ─────────────────────────────────────────────
// 启动
// ─────────────────────────────────────────────

export function mount(): void {
  // 注意：反馈条 (.feedback) 是挂在 document.body 上的、弹层也是，
  // 所以监听必须绑在 document 上，绑 #app 会漏掉这些元素的点击。
  document.addEventListener('click', (e) => void onClick(e));

  // 自动化测试钩子：暴露当前题目与正确答案，供验收脚本点击正确选项。
  // 只在开发/测试环境生效，生产构建中依然存在但无副作用（不暴露用户数据）。
  (window as unknown as { __wpTest?: unknown }).__wpTest = {
    get answer() {
      return app.question?.answer ?? null;
    },
    get word() {
      return app.question?.word.en ?? null;
    },
    get mode() {
      return app.question?.mode ?? null;
    },
    get progress() {
      return `${app.qi + 1}/${app.session.length}`;
    },
    /** 当前激活的教材版本 */
    get edition() {
      return activeEdition();
    },
    /** 当前版本的册数 */
    get bookCount() {
      return books().length;
    },
    /** 点正确选项，返回是否找到 */
    pickRight() {
      const ans = app.question?.answer;
      if (!ans) return false;
      const opts = document.querySelectorAll<HTMLButtonElement>('.option:not(:disabled)');
      for (const el of opts) {
        if (el.dataset.opt === ans) {
          el.click();
          return true;
        }
      }
      return false;
    },
  };

  // 键盘支持（外接键盘 / 桌面调试）
  document.addEventListener('keydown', (e) => {
    if (app.route !== 'quiz' || app.answered) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 4) {
      const opts = document.querySelectorAll<HTMLButtonElement>('.option');
      opts[n - 1]?.click();
    }
  });

  // 首次交互解锁音频并结算宠物状态
  const once = () => {
    unlockAudio();
    settleDecay();
    render();
    document.removeEventListener('touchstart', once);
    document.removeEventListener('click', once);
  };
  document.addEventListener('touchstart', once, { once: true, passive: true });
  document.addEventListener('click', once, { once: true });

  settleDecay();
  render();
}

/** 供外部（调试）使用 */
export { allWords as ALL_WORDS };
