/**
 * 单词猫 — 语音发音
 *
 * 使用 Web Speech API（iOS Safari 原生支持），离线也能发音。
 */

import { store } from './store';

let voices: SpeechSynthesisVoice[] = [];
let ready = false;

function loadVoices(): void {
  if (typeof speechSynthesis === 'undefined') return;
  const list = speechSynthesis.getVoices();
  if (list.length) {
    voices = list;
    ready = true;
  }
}

if (typeof speechSynthesis !== 'undefined') {
  loadVoices();
  speechSynthesis.addEventListener('voiceschanged', loadVoices);
}

/** 挑一个合适的英文嗓音 */
function pickVoice(accent: string): SpeechSynthesisVoice | null {
  if (!ready) loadVoices();
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  if (!en.length) return null;
  const want = accent.toLowerCase();
  // 优先精确匹配口音，其次任何英文嗓音
  const exact = en.find((v) => v.lang.toLowerCase().replace('_', '-') === want);
  if (exact) return exact;
  // iOS 上 Samantha / Daniel 质量较好
  const prefer = en.find((v) => /samantha|daniel|karen|moira|alex/i.test(v.name));
  return prefer ?? en[0];
}

export function speechAvailable(): boolean {
  return typeof speechSynthesis !== 'undefined';
}

/**
 * 朗读文本
 * @param text 要读的内容
 * @param opts.rate 语速，默认取设置
 */
export function speak(text: string, opts: { rate?: number; accent?: string } = {}): void {
  if (!speechAvailable()) return;
  const { settings } = store.data;
  try {
    speechSynthesis.cancel(); // 打断上一条，避免排队
    const u = new SpeechSynthesisUtterance(text);
    u.lang = opts.accent ?? settings.accent;
    u.rate = opts.rate ?? settings.rate;
    u.pitch = 1.05;
    u.volume = 1;
    const v = pickVoice(u.lang);
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) {
    console.warn('[wordpet] 发音失败', e);
  }
}

/**
 * 拼读：把音节逐个读出来，再读整词。
 *
 * 用定时器逐个朗读，而不是一次性全部排队 ——
 * 这样节奏清晰、每块之间有明显停顿，孩子听得清，
 * 也避开了部分浏览器 onend 不触发的问题。
 */
export function speakSyllables(syl: string[], word: string): void {
  if (!speechAvailable()) return;
  const { settings } = store.data;
  try {
    speechSynthesis.cancel();
    const parts = syl.length ? syl : [word];
    const perSyl = 700; // 每块之间的间隔，听感更清楚

    parts.forEach((s, i) => {
      window.setTimeout(() => {
        const u = new SpeechSynthesisUtterance(s);
        u.lang = settings.accent;
        u.rate = Math.max(0.4, settings.rate - 0.3);
        u.pitch = 1.05;
        const v = pickVoice(u.lang);
        if (v) u.voice = v;
        speechSynthesis.speak(u);
      }, i * perSyl);
    });

    // 所有音节读完后，读一遍完整的词
    window.setTimeout(() => {
      speak(word, { rate: settings.rate });
    }, parts.length * perSyl + 250);
  } catch (e) {
    console.warn('[wordpet] 拼读失败', e);
  }
}

/** 停止所有发音 */
export function stopSpeaking(): void {
  if (speechAvailable()) speechSynthesis.cancel();
}

/** 读音效（用 WebAudio 合成，不依赖音频文件） */
let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (!store.data.settings.sound) return null;
  try {
    if (!audioCtx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

/** 播放一个简单的提示音 */
export function beep(kind: 'right' | 'wrong' | 'coin' | 'levelup'): void {
  const ac = ctx();
  if (!ac) return;

  const notes: Record<string, number[]> = {
    right: [660, 880],
    wrong: [300, 240],
    coin: [1046, 1318],
    levelup: [523, 659, 784, 1046],
  };
  const seq = notes[kind] ?? [440];

  seq.forEach((freq, i) => {
    const t0 = ac.currentTime + i * 0.09;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = kind === 'wrong' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + 0.16);
  });
}

/** 需要在用户手势中调用一次以解锁音频 */
export function unlockAudio(): void {
  ctx();
}
