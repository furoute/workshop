/**
 * 单词猫 — 音节切分器
 *
 * 给「自然拼读」功能用。目标不是学术上严谨的音节划分，
 * 而是「切出来的块读起来自然、对孩子有帮助」。
 *
 * 优先使用人工音节表（覆盖小学高频词），命中不了再走规则切分。
 *
 * 规则切分的核心原则：
 *   1. 绝不把不发音的尾字母 e 单独切成一块（nice → 不是 ni-ce）
 *   2. 辅音连缀不拆开（grand-ma 而不是 gra-ndma）
 *   3. 优先切在「元音后、单个辅音前」（V-CV 模式）
 */

/** 人工音节表：小学阶段高频多音节词。key 为小写单词 */
const MANUAL = {
  // ── 三上 ──
  goodbye: ['good', 'bye'],
  grandma: ['grand', 'ma'],
  grandpa: ['grand', 'pa'],
  grandfather: ['grand', 'fa', 'ther'],
  grandmother: ['grand', 'mo', 'ther'],
  mother: ['mo', 'ther'],
  father: ['fa', 'ther'],
  sister: ['sis', 'ter'],
  brother: ['bro', 'ther'],
  family: ['fa', 'mi', 'ly'],
  cousin: ['cou', 'sin'],
  uncle: ['un', 'cle'],
  aunt: ['aunt'],
  baby: ['ba', 'by'],
  rabbit: ['rab', 'bit'],
  panda: ['pan', 'da'],
  monkey: ['mon', 'key'],
  tiger: ['ti', 'ger'],
  elephant: ['e', 'le', 'phant'],
  giraffe: ['gi', 'raffe'],
  lion: ['li', 'on'],
  animal: ['a', 'ni', 'mal'],
  garden: ['gar', 'den'],
  flower: ['flo', 'wer'],
  water: ['wa', 'ter'],
  orange: ['or', 'ange'],
  purple: ['pur', 'ple'],
  yellow: ['yel', 'low'],
  colour: ['co', 'lour'],
  pencil: ['pen', 'cil'],
  eraser: ['e', 'ra', 'ser'],
  ruler: ['ru', 'ler'],
  paper: ['pa', 'per'],
  little: ['lit', 'tle'],
  apple: ['ap', 'ple'],
  banana: ['ba', 'na', 'na'],
  birthday: ['birth', 'day'],
  oclock: ['o', 'clock'],
  // 不发音尾 e 的词：整体作一块（切出来反而干扰拼读）
  nice: ['nice'],
  share: ['share'],
  smile: ['smile'],
  face: ['face'],
  name: ['name'],
  make: ['make'],
  take: ['take'],
  lake: ['lake'],
  cake: ['cake'],
  game: ['game'],
  home: ['home'],
  nose: ['nose'],
  note: ['note'],
  rose: ['rose'],
  hope: ['hope'],
  cute: ['cute'],
  use: ['use'],
  tube: ['tube'],
  mule: ['mule'],
  bike: ['bike'],
  like: ['like'],
  kite: ['kite'],
  nine: ['nine'],
  five: ['five'],
  write: ['write'],
  size: ['size'],
  plate: ['plate'],
  grape: ['grape'],
  space: ['space'],
  these: ['these'],
  those: ['those'],
  white: ['white'],
  drive: ['drive'],
  happy: ['hap', 'py'],
  funny: ['fun', 'ny'],
  sunny: ['sun', 'ny'],
  cloudy: ['clou', 'dy'],
  windy: ['win', 'dy'],
  rainy: ['rai', 'ny'],
  snowy: ['snow', 'y'],
  healthy: ['heal', 'thy'],
  yummy: ['yum', 'my'],
  easy: ['ea', 'sy'],
  ready: ['rea', 'dy'],
  very: ['ve', 'ry'],
  many: ['ma', 'ny'],
  any: ['a', 'ny'],
  body: ['bo', 'dy'],
  baby: ['ba', 'by'],
  city: ['ci', 'ty'],
  party: ['par', 'ty'],
  story: ['sto', 'ry'],
  study: ['stu', 'dy'],
  // ── 三下 ──
  teacher: ['tea', 'cher'],
  student: ['stu', 'dent'],
  neighbour: ['neigh', 'bour'],
  classmate: ['class', 'mate'],
  English: ['Eng', 'lish'],
  Canada: ['Ca', 'na', 'da'],
  China: ['Chi', 'na'],
  computer: ['com', 'pu', 'ter'],
  breakfast: ['break', 'fast'],
  vegetable: ['ve', 'ge', 'ta', 'ble'],
  colourful: ['co', 'lour', 'ful'],
  candy: ['can', 'dy'],
  yummy: ['yum', 'my'],
  noodle: ['noo', 'dle'],
  listen: ['lis', 'ten'],
  today: ['to', 'day'],
  about: ['a', 'bout'],
  after: ['af', 'ter'],
  woman: ['wo', 'man'],
  body: ['bo', 'dy'],
  picture: ['pic', 'ture'],
  eraser2: ['e', 'ra', 'ser'],
  under: ['un', 'der'],
  sister2: ['sis', 'ter'],
};

/** 常见辅音连缀（不可拆开） */
const CLUSTERS = [
  'bl', 'br', 'ch', 'ck', 'cl', 'cr', 'dr', 'fl', 'fr', 'gh', 'gl', 'gr',
  'ng', 'nk', 'ph', 'pl', 'pr', 'qu', 'sc', 'sh', 'sk', 'sl', 'sm', 'sn',
  'sp', 'st', 'sw', 'th', 'tr', 'tw', 'wh', 'wr', 'sch', 'scr', 'shr',
  'spl', 'spr', 'squ', 'str', 'thr',
];

/**
 * 用规则切分单词
 * @param {string} word
 * @returns {string[]}
 */
function ruleSplit(word) {
  const w = word.toLowerCase();

  // 极短词不切
  if (w.length <= 4) return [word];

  // 找出所有元音组的位置
  const vowelGroups = [];
  const isVowel = (c) => 'aeiouy'.includes(c);
  let i = 0;
  while (i < w.length) {
    if (isVowel(w[i])) {
      const start = i;
      while (i < w.length && isVowel(w[i])) i++;
      vowelGroups.push({ start, end: i - 1 });
    } else {
      i++;
    }
  }

  // 只有一组元音 → 单音节
  if (vowelGroups.length <= 1) return [word];

  // 判断词尾是否为「辅音 + 不发音的 e」
  const endsWithSilentE =
    w.endsWith('e') &&
    w.length >= 3 &&
    !isVowel(w[w.length - 2]) &&
    vowelGroups.length >= 2 &&
    // 前一个元音组不是紧挨着词尾（避免把 he / me 当成有尾 e）
    vowelGroups[vowelGroups.length - 1].end < w.length - 2;

  const cuts = [];

  for (let g = 0; g < vowelGroups.length - 1; g++) {
    const curEnd = vowelGroups[g].end;
    const nextStart = vowelGroups[g + 1].start;
    const between = w.slice(curEnd + 1, nextStart); // 两个元音组之间的辅音串

    if (between.length === 0) {
      // 元音相邻，直接在中间切
      cuts.push(nextStart);
    } else if (between.length === 1) {
      // V-CV：辅音归后面
      cuts.push(curEnd + 1);
    } else {
      // 多个辅音：若开头是合法连缀，连缀归后面
      const pair = between.slice(0, 2);
      const triple = between.slice(0, 3);
      if (CLUSTERS.includes(triple)) {
        cuts.push(curEnd + 1 + 1); // 第一个辅音留前面
      } else if (CLUSTERS.includes(pair)) {
        cuts.push(curEnd + 1);
      } else {
        // 不是连缀：从中间偏前处切
        cuts.push(curEnd + 1 + Math.floor(between.length / 2));
      }
    }
  }

  // 最后一个切点：若词尾是不发音的 e，不要把它切出来
  if (endsWithSilentE && cuts.length) {
    const lastCut = cuts[cuts.length - 1];
    // 如果尾 e 会被单独切开，就把切点前移
    if (w.length - lastCut <= 2) {
      cuts.pop();
    }
  }

  // 按切点组装
  const parts = [];
  let prev = 0;
  for (const c of cuts.sort((a, b) => a - b)) {
    if (c > prev && c < w.length) {
      parts.push(w.slice(prev, c));
      prev = c;
    }
  }
  parts.push(w.slice(prev));

  // 过滤空块；只有一块时返回原词
  const cleaned = parts.filter(Boolean);
  if (cleaned.length <= 1) return [word];

  // 检查每块是否至少含一个元音（否则说明切坏了）
  const hasVowel = (s) => /[aeiouy]/.test(s);
  if (cleaned.slice(0, -1).some((s) => !hasVowel(s))) {
    return [word];
  }

  return cleaned;
}

/**
 * 对外接口：返回音节的原始大小写形式（尽量保持与原词一致的可读性）
 * @param {string} word 单词（可含空格/连字符的词组）
 * @returns {string[]}
 */
export function syllables(word) {
  if (!word) return [];

  // 词组：按空格或连字符拆，每部分各自处理
  if (/[\s-]/.test(word.trim())) {
    return word
      .split(/[\s-]+/)
      .filter(Boolean)
      .flatMap((part) => {
        const one = syllables(part);
        return one.length ? one : [part];
      });
  }

  const key = word.toLowerCase().replace(/[^a-z]/g, '');
  if (MANUAL[key]) return MANUAL[key];

  return ruleSplit(word);
}

export default syllables;
