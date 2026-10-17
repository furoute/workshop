/**
 * 单词猫 — 音节与音标对齐
 *
 * 把一个单词的音标按音节边界切开，得到每一块的音：
 *    colourful  /ˈkʌləfl/    + co-lour-ful   → kʌ / lə / fl
 *    teacher    /ˈtiːtʃə(r)/ + tea-cher      → tiː / tʃə(r)
 *
 * 难点：音标的元音核数量常与音节数对不上，最常见的原因是
 * 「成音节辅音」—— colour 的 -fl、apple 的 -pl 自成一个音节，
 * 音标里却不写元音。
 *
 * 策略：能可靠切就切；切不准就返回 null，让界面不显示音标。
 * **宁可某块不显示音标，也不显示错误的音标。**
 */

/** 元音核：双元音/长元音必须整体匹配，故长的写在前面 */
const VOWEL_RE = /(ɪə|eə|ʊə|eɪ|aɪ|ɔɪ|əʊ|aʊ|iː|ɑː|ɔː|uː|ɜː|[ɪeæɒʌʊə])/g;

const isVowelChar = (c: string) => 'ɪeæɒʌʊəiɑɔuɜː'.includes(c);

/**
 * 人工音标切分表：规则切不准的高频词。
 * key = 单词小写，value = 按音节顺序的音标片段。
 */
const MANUAL_ALIGN: Record<string, string[]> = {
  teacher: ['tiː', 'tʃə(r)'],
  computer: ['kəm', 'pjuː', 'tə(r)'],
  // vegetable 的音标 /ˈvedʒtəbl/ 只有 2 个元音核（e、ə），
  // 但教材按 ve-ge-ta-ble 拆成 4 块（-t- 和 -bl 是成音节部分），
  // 故人工给定 4 段：
  vegetable: ['vedʒ', 'tə', 'b', 'l'],  family: ['fæ', 'mə', 'li'],
  monkey: ['mʌŋ', 'ki'],
  strawberry: ['strɔː', 'bə', 'ri'],
  library: ['laɪ', 'brə', 'ri'],
  elephant: ['e', 'lɪ', 'fənt'],
  beautiful: ['bjuː', 'tɪ', 'fl'],
  important: ['ɪm', 'pɔː', 'tnt'],
  grandma: ['ɡræn', 'mɑː'],
  grandpa: ['ɡræn', 'pɑː'],
  grandfather: ['ɡræn', 'fɑː', 'ðə(r)'],
  grandmother: ['ɡræn', 'mʌ', 'ðə(r)'],
  mother: ['mʌ', 'ðə(r)'],
  father: ['fɑː', 'ðə(r)'],
  sister: ['sɪ', 'stə(r)'],
  brother: ['brʌ', 'ðə(r)'],
  birthday: ['bɜːθ', 'deɪ'],
  breakfast: ['brek', 'fəst'],
  banana: ['bə', 'nɑː', 'nə'],
  afternoon: ['ɑːf', 'tə', 'nuːn'],
  watermelon: ['wɔː', 'tə', 'me', 'lən'],
  colourful: ['kʌ', 'lə', 'fl'],
  colour: ['kʌ', 'lə(r)'],
  window: ['wɪn', 'dəʊ'],
  yesterday: ['jes', 'tə', 'deɪ'],
  rabbit: ['ræ', 'bɪt'],
  panda: ['pæn', 'də'],
  tiger: ['taɪ', 'ɡə(r)'],
  giraffe: ['dʒə', 'rɑːf'],
  orange: ['ɒ', 'rɪndʒ'],
  purple: ['pɜː', 'pl'],
  yellow: ['je', 'ləʊ'],
  garden: ['ɡɑː', 'dn'],
  pencil: ['pen', 'sl'],
  eraser: ['ɪ', 'reɪ', 'zə(r)'],
  ruler: ['ruː', 'lə(r)'],
  paper: ['peɪ', 'pə(r)'],
  little: ['lɪ', 'tl'],
  apple: ['æ', 'pl'],
  noodle: ['nuː', 'dl'],
  candy: ['kæn', 'di'],
  yummy: ['jʌ', 'mi'],
  classmate: ['klɑːs', 'meɪt'],
  neighbour: ['neɪ', 'bə(r)'],
  english: ['ɪŋ', 'ɡlɪʃ'],
  china: ['tʃaɪ', 'nə'],
  canada: ['kæ', 'nə', 'də'],
  cousin: ['kʌ', 'zn'],
  uncle: ['ʌŋ', 'kl'],
  baby: ['beɪ', 'bi'],
  animal: ['æ', 'nɪ', 'ml'],
  hospital: ['hɒ', 'spɪ', 'tl'],
  // 补充：规则漏掉的常见词（-y 结尾、成音节 -n/-l 等）
  very: ['ve', 'ri'],
  body: ['bɒ', 'di'],
  healthy: ['hel', 'θi'],
  twenty: ['twen', 'ti'],
  happy: ['hæ', 'pi'],
  funny: ['fʌ', 'ni'],
  sunny: ['sʌ', 'ni'],
  windy: ['wɪn', 'di'],
  cloudy: ['klaʊ', 'di'],
  rainy: ['reɪ', 'ni'],
  snowy: ['snəʊ', 'i'],
  easy: ['iː', 'zi'],
  ready: ['re', 'di'],
  many: ['me', 'ni'],
  any: ['e', 'ni'],
  city: ['sɪ', 'ti'],
  party: ['pɑː', 'ti'],
  story: ['stɔː', 'ri'],
  study: ['stʌ', 'di'],
  holiday: ['hɒ', 'lə', 'deɪ'],
  difficult: ['dɪ', 'fɪ', 'kəlt'],
  favourite: ['feɪ', 'və', 'rɪt'],
  remember: ['rɪ', 'mem', 'bə(r)'],
  together: ['tə', 'ɡe', 'ðə(r)'],
  another: ['ə', 'nʌ', 'ðə(r)'],
  exercise: ['ek', 'sə', 'saɪz'],
  usually: ['juː', 'ʒu', 'ə', 'li'],
  sometimes: ['sʌm', 'taɪmz'],
  always: ['ɔːl', 'weɪz'],
  never: ['ne', 'və(r)'],
  often: ['ɒ', 'fn'],
  dinner: ['dɪ', 'nə(r)'],
  summer: ['sʌ', 'mə(r)'],
  winter: ['wɪn', 'tə(r)'],
  autumn: ['ɔː', 'təm'],
  season: ['siː', 'zn'],
  lesson: ['le', 'sn'],
  open: ['əʊ', 'pən'],
  over: ['əʊ', 'və(r)'],
  number: ['nʌm', 'bə(r)'],
  letter: ['le', 'tə(r)'],
  doctor: ['dɒ', 'ktə(r)'],
  farmer: ['fɑː', 'mə(r)'],
  driver: ['draɪ', 'və(r)'],
  worker: ['wɜː', 'kə(r)'],
  singer: ['sɪ', 'ŋə(r)'],
  dancer: ['dɑːn', 'sə(r)'],
};

/**
 * 把音标按音节数切分
 * @param ph   音标（可含 / 与重音符号）
 * @param n    音节数
 * @param word 单词（用于查人工表）
 * @returns 每段音标；无法可靠切分时返回 null
 */
export function alignPhonetic(ph: string, n: number, word = ''): string[] | null {
  const clean = String(ph ?? '').replace(/[/[\]]/g, '').replace(/[ˈˌ.]/g, '').trim();
  if (!clean) return null;

  // 人工表优先
  const manual = MANUAL_ALIGN[String(word).toLowerCase()];
  if (manual && manual.length === n) return manual.slice();

  if (n <= 1) return [clean];

  // ── 1. 找出所有元音核 ──
  const nuclei: { start: number; end: number }[] = [];
  VOWEL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = VOWEL_RE.exec(clean))) {
    nuclei.push({ start: m.index, end: m.index + m[0].length });
  }
  if (!nuclei.length) return null;

  // ── 2. 核太多：合并间隔最近的相邻核 ──
  let cores = nuclei.slice();
  while (cores.length > n) {
    let mi = 0;
    let best = Infinity;
    for (let i = 0; i < cores.length - 1; i++) {
      const gap = cores[i + 1].start - cores[i].end;
      if (gap < best) { best = gap; mi = i; }
    }
    cores = [
      ...cores.slice(0, mi),
      { start: cores[mi].start, end: cores[mi + 1].end },
      ...cores.slice(mi + 2),
    ];
  }

  // ── 3. 计算切点（辅音归后一音节；多辅音时最后一个留给后面）──
  const starts: number[] = [0];
  for (let i = 1; i < cores.length; i++) {
    starts.push(splitPoint(clean, cores[i - 1], cores[i]));
  }

  // ── 4. 核不足：尾部成音节辅音单独成段 ──
  if (cores.length < n) {
    const lastEnd = cores[cores.length - 1].end;
    const tail = clean.slice(lastEnd);
    const need = n - cores.length;
    if (tail.length < need || [...tail].some(isVowelChar)) return null;
    for (let i = 0; i < need; i++) {
      starts.push(lastEnd + Math.round((tail.length / need) * i));
    }
  }

  // ── 5. 组装并校验 ──
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const s = starts[i];
    const e = i === n - 1 ? clean.length : starts[i + 1];
    if (s === undefined || e === undefined || e <= s) return null;
    out.push(clean.slice(s, e));
  }
  if (out.join('') !== clean) return null;
  if (out.some((s) => !s.length)) return null;
  return out;
}

/** 两个元音核之间的切点 */
function splitPoint(clean: string, prev: { end: number }, cur: { start: number }): number {
  const between = clean.slice(prev.end, cur.start);
  if (between.length <= 1) return prev.end;
  return cur.start - 1;
}

export default alignPhonetic;
