/**
 * 单词猫 — 2024 新版「自然拼读」教材数据
 *
 * 来源：pep2024_grade3_report.md（人教社官网 + 教材附录扫描图 + 多来源交叉验证）
 *
 * 三上：板块叫 `Letters and sounds`，教 26 个字母的字母名 + 字母音 + 书写
 *       分配为 4+4+4+4+5+5 = 26（U1~U4 各 4 个，U5/U6 各 5 个）
 * 三下：板块叫 `Let's spell`，按「短音 → 长音」成对推进
 */

export interface LetterSound {
  /** 大写字母 */
  upper: string;
  /** 小写字母 */
  lower: string;
  /** 音标 */
  ipa: string;
  /** 教材例词（1-2 个） */
  examples: string[];
}

export interface PhonicsUnit {
  /** 单元号 */
  unit: number;
  /** 板块名（三上 Letters and sounds / 三下 Let's spell） */
  board: string;
  /** 本单元教学内容简述 */
  summary: string;
  /** 三上：字母音数据 */
  letters?: LetterSound[];
  /** 三下：拼读规律的例词分组 */
  groups?: { sound: string; desc: string; words: string[] }[];
}

// ─────────────────────────────────────────────
// 三年级上册 — Letters and sounds（26 个字母）
// ─────────────────────────────────────────────

export const PHONICS_3A: PhonicsUnit[] = [
  {
    unit: 1,
    board: 'Letters and sounds',
    summary: '字母 Aa–Dd 的字母音与书写',
    letters: [
      { upper: 'A', lower: 'a', ipa: 'æ', examples: ['apple', 'bag'] },
      { upper: 'B', lower: 'b', ipa: 'b', examples: ['bed', 'Bob'] },
      { upper: 'C', lower: 'c', ipa: 'k', examples: ['cat', 'can'] },
      // 报告标注：Dd 例词两来源不一致（dog, dad vs dog, sad），采用多数来源
      { upper: 'D', lower: 'd', ipa: 'd', examples: ['dog', 'dad'] },
    ],
  },
  {
    unit: 2,
    board: 'Letters and sounds',
    summary: '字母 Ee–Hh 的字母音与书写',
    letters: [
      { upper: 'E', lower: 'e', ipa: 'e', examples: ['egg', 'nest'] },
      { upper: 'F', lower: 'f', ipa: 'f', examples: ['fish', 'beef'] },
      { upper: 'G', lower: 'g', ipa: 'ɡ', examples: ['girl', 'pig'] },
      { upper: 'H', lower: 'h', ipa: 'h', examples: ['hot', 'hat'] },
    ],
  },
  {
    unit: 3,
    board: 'Letters and sounds',
    summary: '字母 Ii–Ll 的字母音与书写',
    letters: [
      { upper: 'I', lower: 'i', ipa: 'ɪ', examples: ['ill', 'kid'] },
      { upper: 'J', lower: 'j', ipa: 'dʒ', examples: ['jet', 'job'] },
      { upper: 'K', lower: 'k', ipa: 'k', examples: ['kite', 'Kim'] },
      { upper: 'L', lower: 'l', ipa: 'l', examples: ['leg', 'lion'] },
    ],
  },
  {
    unit: 4,
    board: 'Letters and sounds',
    summary: '字母 Mm–Pp 的字母音与书写',
    letters: [
      { upper: 'M', lower: 'm', ipa: 'm', examples: ['map', 'mum'] },
      { upper: 'N', lower: 'n', ipa: 'n', examples: ['new', 'fan'] },
      { upper: 'O', lower: 'o', ipa: 'ɒ', examples: ['orange', 'fox'] },
      { upper: 'P', lower: 'p', ipa: 'p', examples: ['pen', 'cup'] },
    ],
  },
  {
    unit: 5,
    board: 'Letters and sounds',
    summary: '字母 Qq–Uu 的字母音与书写',
    letters: [
      { upper: 'Q', lower: 'q', ipa: 'kw', examples: ['queen', 'quiet'] },
      { upper: 'R', lower: 'r', ipa: 'r', examples: ['red', 'ruler'] },
      { upper: 'S', lower: 's', ipa: 's', examples: ['see', 'bus'] },
      { upper: 'T', lower: 't', ipa: 't', examples: ['Ted', 'sit'] },
      { upper: 'U', lower: 'u', ipa: 'ʌ', examples: ['up', 'run'] },
    ],
  },
  {
    unit: 6,
    board: 'Letters and sounds',
    summary: '字母 Vv–Zz 的字母音与书写',
    letters: [
      { upper: 'V', lower: 'v', ipa: 'v', examples: ['van', 'vet'] },
      { upper: 'W', lower: 'w', ipa: 'w', examples: ['we', 'win'] },
      { upper: 'X', lower: 'x', ipa: 'ks', examples: ['box', 'six'] },
      { upper: 'Y', lower: 'y', ipa: 'j', examples: ['yellow', 'yo-yo'] },
      { upper: 'Z', lower: 'z', ipa: 'z', examples: ['Zip', 'quiz'] },
    ],
  },
];

// ─────────────────────────────────────────────
// 三年级下册 — Let's spell（短音 / 长音成对）
// ─────────────────────────────────────────────

export const PHONICS_3B: PhonicsUnit[] = [
  {
    unit: 1,
    board: "Let's spell",
    summary: 'a 的短音 /æ/ 与 a-e 的长音 /eɪ/',
    groups: [
      { sound: 'æ', desc: 'a 的短音', words: ['cat', 'dad', 'bag', 'map'] },
      { sound: 'eɪ', desc: 'a-e 的长音', words: ['face', 'cake', 'name', 'make', 'take', 'lake'] },
    ],
  },
  {
    unit: 2,
    board: "Let's spell",
    summary: 'e 的长音 /iː/',
    groups: [
      // 报告指出：本单元只教 e 的长音，不是 e / e-e 配对
      { sound: 'iː', desc: 'e 的长音', words: ['he', 'she', 'we', 'be', 'me'] },
    ],
  },
  {
    unit: 3,
    board: "Let's spell",
    summary: 'i 的短音 /ɪ/ 与 i-e 的长音 /aɪ/',
    groups: [
      { sound: 'ɪ', desc: 'i 的短音', words: ['big', 'sit', 'lip', 'six', 'pink'] },
      { sound: 'aɪ', desc: 'i-e 的长音', words: ['bike', 'size', 'like', 'kite', 'write', 'nine', 'nice', 'five'] },
    ],
  },
  {
    unit: 4,
    board: "Let's spell",
    summary: 'o 的短音 /ɒ/ 与 o-e 的长音 /əʊ/',
    groups: [
      { sound: 'ɒ', desc: 'o 的短音', words: ['hot', 'dog', 'fox', 'log'] },
      { sound: 'əʊ', desc: 'o-e 的长音', words: ['nose', 'note', 'Coke', 'rose', 'home', 'hope'] },
    ],
  },
  {
    unit: 5,
    board: "Let's spell",
    summary: 'u 的短音 /ʌ/ 与 u-e 的长音 /juː/',
    groups: [
      { sound: 'ʌ', desc: 'u 的短音', words: ['but', 'cut', 'bus', 'cup', 'up', 'run', 'duck'] },
      { sound: 'juː', desc: 'u-e 的长音', words: ['use', 'cute', 'excuse', 'tube', 'mule', 'mute'] },
    ],
  },
  {
    unit: 6,
    board: "Let's spell",
    summary: 'c, g, l, y 的两种读音',
    groups: [
      { sound: 'k / s', desc: 'c 的两种读音', words: ['cat', 'face'] },
      { sound: 'g / dʒ', desc: 'g 的两种读音', words: ['girl', 'age'] },
      { sound: 'l', desc: 'l 的两种位置', words: ['leg', 'cool'] },
      { sound: 'j / aɪ', desc: 'y 的两种读音', words: ['yes', 'my'] },
    ],
  },
];

// ─────────────────────────────────────────────
// 查询接口
// ─────────────────────────────────────────────

/** 取某册某单元的拼读数据 */
export function phonicsOf(bookEdition: string, bookId: string, unit: number): PhonicsUnit | undefined {
  if (bookEdition !== 'pep-2024') return undefined;
  const list = bookId === 'pep3a' ? PHONICS_3A : bookId === 'pep3b' ? PHONICS_3B : null;
  return list?.find((u) => u.unit === unit);
}

/** 三上全部 26 个字母（用于「字母表」总览页） */
export const ALL_LETTERS: LetterSound[] = PHONICS_3A.flatMap((u) => u.letters ?? []);
