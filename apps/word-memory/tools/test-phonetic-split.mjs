/**
 * 音节-音标对齐自测
 */
import { alignPhonetic } from './phonetic-align.mjs';

const cases = [
  ['colourful', 'ˈkʌləfl', ['co', 'lour', 'ful'], ['kʌ', 'lə', 'fl']],
  ['vegetable', 'ˈvedʒtəbl', ['ve', 'ge', 'ta', 'ble'], ['ve', 'dʒtə', 'bl', '']],
  ['breakfast', 'ˈbrekfəst', ['break', 'fast'], ['brek', 'fəst']],
  ['computer', 'kəmˈpjuːtə(r)', ['com', 'pu', 'ter'], ['kəm', 'pjuː', 'tə(r)']],
  ['elephant', 'ˈelɪfənt', ['e', 'le', 'phant'], ['e', 'lɪ', 'fənt']],
  ['family', 'ˈfæməli', ['fa', 'mi', 'ly'], ['fæ', 'mə', 'li']],
  ['grandmother', 'ˈɡrænmʌðə(r)', ['grand', 'mo', 'ther'], ['ɡræn', 'mʌ', 'ðə(r)']],
  ['banana', 'bəˈnɑːnə', ['ba', 'na', 'na'], ['bə', 'nɑː', 'nə']],
  ['birthday', 'ˈbɜːθdeɪ', ['birth', 'day'], ['bɜːθ', 'deɪ']],
  ['teacher', 'ˈtiːtʃə(r)', ['tea', 'cher'], ['tiː', 'tʃə(r)']],
  ['window', 'ˈwɪndəʊ', ['win', 'dow'], ['wɪn', 'dəʊ']],
  ['rabbit', 'ˈræbɪt', ['rab', 'bit'], ['ræ', 'bɪt']],
  ['monkey', 'ˈmʌŋki', ['mon', 'key'], ['mʌŋ', 'ki']],
  ['yesterday', 'ˈjestədeɪ', ['yes', 'ter', 'day'], ['jes', 'tə', 'deɪ']],
  ['watermelon', 'ˈwɔːtəmelən', ['wa', 'ter', 'me', 'lon'], ['wɔː', 'tə', 'me', 'lən']],
  ['strawberry', 'ˈstrɔːbəri', ['straw', 'ber', 'ry'], ['strɔː', 'bə', 'ri']],
  ['afternoon', 'ˌɑːftəˈnuːn', ['af', 'ter', 'noon'], ['ɑːf', 'tə', 'nuːn']],
  ['beautiful', 'ˈbjuːtɪfl', ['beau', 'ti', 'ful'], ['bjuː', 'tɪ', 'fl']],
  ['important', 'ɪmˈpɔːtnt', ['im', 'por', 'tant'], ['ɪm', 'pɔː', 'tnt']],
  ['library', 'ˈlaɪbrəri', ['li', 'bra', 'ry'], ['laɪ', 'brə', 'ri']],
];

let complete = 0, countOk = 0, ideal = 0, refused = 0;

for (const [word, ph, syl, want] of cases) {
  const out = alignPhonetic(ph, syl.length, word);
  const clean = ph.replace(/[/ˈˌ.]/g, '');

  if (out === null) {
    refused++;
    console.log(`∅ ${word.padEnd(12)} ${syl.join('-').padEnd(16)} → 音标不对齐，界面将不显示`);
    continue;
  }

  const okCount = out.length === syl.length;
  const okComplete = out.join('') === clean;
  const okIdeal = want && out.join('|') === want.join('|');
  if (okCount) countOk++;
  if (okComplete) complete++;
  if (okIdeal) ideal++;

  const mark = okIdeal ? '✓' : (okComplete && okCount ? '△' : '✗');
  console.log(
    `${mark} ${word.padEnd(12)} ${syl.join('-').padEnd(16)} → ${out.map((s) => '/' + s + '/').join(' ')}`,
  );
  if (!okIdeal && want) console.log(`    期望：${want.map((s) => '/' + s + '/').join(' ')}`);
}

const valid = cases.length - refused;
console.log(`\n段数正确 ${countOk}/${valid}`);
console.log(`音标无丢失 ${complete}/${valid}`);
console.log(`切分理想 ${ideal}/${valid}`);
console.log(`拒绝对齐 ${refused}（界面不显示音标，避免误导）`);
