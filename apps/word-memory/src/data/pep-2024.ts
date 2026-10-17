/**
 * 单词猫 — 人教 PEP 2024 新版词库
 *
 * ⚠️ 本文件由 tools/import-new-edition.mjs 自动生成，请勿手工编辑。
 * 源文件：_new-edition-grade3.tsv
 * 生成时间：2026/9/11 20:14:37
 *
 * 对应教材：2024 年秋季起启用的新版（三上 Unit 1 = Making friends）
 */

import type { Book, Word, BookId, Edition } from '../core/types';

/** 本文件所有词条所属的教材版本 */
export const LIB_EDITION: Edition = 'pep-2024';

function w(
  book: BookId,
  unit: number,
  en: string,
  ph: string,
  cn: string,
  syl: string[],
  ex?: string,
  exCn?: string,
): Word {
  return {
    id: `${book}-u${unit}-${en.replace(/[^a-z0-9]/gi, '').toLowerCase()}`,
    en, ph, cn, syl, ex, exCn, book, unit,
    edition: LIB_EDITION,
  };
}


// ─────────────────────────────────────────────
// 三年级上册（2024 新版）
// ─────────────────────────────────────────────
const pep3a: Book = {
  id: 'pep3a', name: '三年级上册', grade: 3, term: '上', edition: LIB_EDITION,
  units: [
    {
      no: 1, title: 'Making friends', cn: '交朋友',
      phonics: '字母 Aa-Dd 的发音',
      words: [
        w('pep3a', 1, 'nice', 'naɪs', '令人愉快的；友好的', ['nice'], 'Nice to meet you!', '很高兴见到你！'),
        w('pep3a', 1, 'ear', 'ɪə(r)', '耳朵', ['ear'], 'Touch your ear.', '摸摸你的耳朵。'),
        w('pep3a', 1, 'hand', 'hænd', '手', ['hand'], 'Put up your hand.', '举起你的手。'),
        w('pep3a', 1, 'eye', 'aɪ', '眼睛', ['eye'], 'I have two eyes.', '我有两只眼睛。'),
        w('pep3a', 1, 'mouth', 'maʊθ', '嘴', ['mouth'], 'Open your mouth wide.', '把嘴张大。'),
        w('pep3a', 1, 'arm', 'ɑːm', '胳膊', ['arm'], 'Wave your arm.', '挥挥你的胳膊。'),
        w('pep3a', 1, 'can', 'kæn', '可以', ['can'], 'I can share my toys.', '我能分享我的玩具。'),
        w('pep3a', 1, 'share', 'ʃeə(r)', '分享', ['share'], 'Let us share the cake.', '我们一起分享蛋糕吧。'),
        w('pep3a', 1, 'smile', 'smaɪl', '微笑', ['smile'], 'She has a big smile.', '她笑得很开心。'),
        w('pep3a', 1, 'listen', 'ˈlɪsn', '听；倾听', ['lis','ten'], 'Listen to me, please.', '请听我说。'),
        w('pep3a', 1, 'help', 'help', '帮助', ['help'], 'Can you help me?', '你能帮帮我吗？'),
        w('pep3a', 1, 'say', 'seɪ', '说；讲', ['say'], 'Say hello to your friend.', '跟你的朋友问好。'),
        w('pep3a', 1, 'and', 'ænd', '和；与', ['and'], 'I like cats and dogs.', '我喜欢猫和狗。'),
        w('pep3a', 1, 'goodbye', 'ˌɡʊdˈbaɪ', '再见', ['good','bye'], 'Goodbye! See you tomorrow.', '再见！明天见。'),
        w('pep3a', 1, 'toy', 'tɔɪ', '玩具', ['toy'], 'This is my new toy.', '这是我的新玩具。'),
        w('pep3a', 1, 'friend', 'frend', '朋友', ['friend'], 'She is my good friend.', '她是我的好朋友。'),
        w('pep3a', 1, 'good', 'ɡʊd', '好的', ['good'], 'You are a good friend.', '你是个好朋友。'),
      ],
    },
    {
      no: 2, title: 'Different families', cn: '不同的家庭',
      phonics: '字母 Ee-Hh 的发音',
      words: [
        w('pep3a', 2, 'mum', 'mʌm', '（口语）妈妈', ['mum'], 'My mum is a teacher.', '我妈妈是老师。'),
        w('pep3a', 2, 'dad', 'dæd', '（口语）爸爸；爹爹', ['dad'], 'My dad likes football.', '我爸爸喜欢足球。'),
        w('pep3a', 2, 'grandma', 'ˈɡrænmɑː', '（口语）（外）祖母；奶奶；姥姥；外婆', ['grand','ma'], 'My grandma tells me stories.', '我奶奶给我讲故事。'),
        w('pep3a', 2, 'grandpa', 'ˈɡrænpɑː', '（口语）（外）祖父；爷爷；姥爷；外公', ['grand','pa'], 'My grandpa is very kind.', '我爷爷很和蔼。'),
        w('pep3a', 2, 'grandfather', 'ˈɡrænfɑːðə(r)', '（外）祖父；爷爷；姥爷；外公', ['grand','fa','ther'], 'My grandfather is sixty.', '我爷爷六十岁了。'),
        w('pep3a', 2, 'grandmother', 'ˈɡrænmʌðə(r)', '（外）祖母；奶奶；姥姥；外婆', ['grand','mo','ther'], 'My grandmother makes good soup.', '我奶奶做的汤很好喝。'),
        w('pep3a', 2, 'mother', 'ˈmʌðə(r)', '母亲；妈妈', ['mo','ther'], 'My mother loves flowers.', '我妈妈喜欢花。'),
        w('pep3a', 2, 'father', 'ˈfɑːðə(r)', '父亲；爸爸', ['fa','ther'], 'My father is tall.', '我爸爸很高。'),
        w('pep3a', 2, 'me', 'miː', '我', ['me'], 'This is a photo of me.', '这是我的一张照片。'),
        w('pep3a', 2, 'sister', 'ˈsɪstə(r)', '姐；妹', ['sis','ter'], 'My sister is six.', '我妹妹六岁。'),
        w('pep3a', 2, 'family', 'ˈfæməli', '家；家庭', ['fa','mi','ly'], 'I love my family.', '我爱我的家。'),
        w('pep3a', 2, 'have', 'hæv', '有', ['have'], 'I have a big family.', '我有一个大家庭。'),
        w('pep3a', 2, 'big', 'bɪɡ', '大的', ['big'], 'My family is big.', '我的家庭很大。'),
        w('pep3a', 2, 'cousin', 'ˈkʌzn', '堂（表）兄弟；堂（表）姐妹', ['cou','sin'], 'My cousin lives in Beijing.', '我表哥住在北京。'),
        w('pep3a', 2, 'brother', 'ˈbrʌðə(r)', '哥；弟', ['bro','ther'], 'My brother is a student.', '我哥哥是学生。'),
        w('pep3a', 2, 'baby', 'ˈbeɪbi', '婴儿', ['ba','by'], 'The baby is sleeping.', '宝宝在睡觉。'),
        w('pep3a', 2, 'uncle', 'ˈʌŋkl', '舅父；叔父；伯父；姑父；姨父', ['un','cle'], 'My uncle has a car.', '我叔叔有一辆车。'),
        w('pep3a', 2, 'aunt', 'ɑːnt', '姑母；姨母；伯母；婶母；舅母', ['aunt'], 'My aunt is a nurse.', '我姑姑是护士。'),
        w('pep3a', 2, 'some', 'sʌm', '一些', ['some'], 'Some families are small.', '有些家庭很小。'),
        w('pep3a', 2, 'small', 'smɔːl', '小的', ['small'], 'My family is small.', '我的家庭很小。'),
      ],
    },
    {
      no: 3, title: 'Amazing animals', cn: '奇妙的动物',
      phonics: '字母 Ii-Ll 的发音',
      words: [
        w('pep3a', 3, 'like', 'laɪk', '喜欢', ['like'], 'I like animals.', '我喜欢动物。'),
        w('pep3a', 3, 'dog', 'dɒɡ', '狗', ['dog'], 'The dog can run fast.', '这只狗跑得很快。'),
        w('pep3a', 3, 'pet', 'pet', '宠物', ['pet'], 'Do you have a pet?', '你有宠物吗？'),
        w('pep3a', 3, 'cat', 'kæt', '猫', ['cat'], 'My cat is white.', '我的猫是白色的。'),
        w('pep3a', 3, 'fish', 'fɪʃ', '鱼；鱼肉', ['fish'], 'The fish can swim.', '鱼会游泳。'),
        w('pep3a', 3, 'bird', 'bɜːd', '鸟', ['bird'], 'The bird can fly.', '鸟会飞。'),
        w('pep3a', 3, 'rabbit', 'ˈræbɪt', '兔', ['rab','bit'], 'The rabbit has long ears.', '兔子有长耳朵。'),
        w('pep3a', 3, 'go', 'ɡəʊ', '去；走', ['go'], 'Let us go to the zoo.', '我们去动物园吧。'),
        w('pep3a', 3, 'zoo', 'zuː', '动物园', ['zoo'], 'There are many animals at the zoo.', '动物园里有很多动物。'),
        w('pep3a', 3, 'fox', 'fɒks', '狐狸', ['fox'], 'The fox has a long tail.', '狐狸有一条长尾巴。'),
        w('pep3a', 3, 'Miss', 'mɪs', '（学生对女教师的称呼）女士', ['Miss'], 'Good morning, Miss Li.', '早上好，李老师。'),
        w('pep3a', 3, 'panda', 'ˈpændə', '大熊猫', ['pan','da'], 'The panda is black and white.', '熊猫是黑白色的。'),
        w('pep3a', 3, 'cute', 'kjuːt', '可爱的', ['cute'], 'The baby cat is cute.', '小猫很可爱。'),
        w('pep3a', 3, 'monkey', 'ˈmʌŋki', '猴子', ['mon','key'], 'The monkey likes bananas.', '猴子喜欢香蕉。'),
        w('pep3a', 3, 'tiger', 'ˈtaɪɡə(r)', '老虎', ['ti','ger'], 'The tiger is strong.', '老虎很强壮。'),
        w('pep3a', 3, 'elephant', 'ˈelɪfənt', '大象', ['e','le','phant'], 'The elephant has a long nose.', '大象有长长的鼻子。'),
        w('pep3a', 3, 'lion', 'ˈlaɪən', '狮；狮子', ['li','on'], 'The lion is the king.', '狮子是王者。'),
        w('pep3a', 3, 'giraffe', 'dʒəˈrɑːf', '长颈鹿', ['gi','raffe'], 'The giraffe is very tall.', '长颈鹿非常高。'),
        w('pep3a', 3, 'tall', 'tɔːl', '高的', ['tall'], 'The giraffe is tall.', '长颈鹿很高。'),
        w('pep3a', 3, 'fast', 'fɑːst', '快的', ['fast'], 'The tiger runs fast.', '老虎跑得快。'),
      ],
    },
    {
      no: 4, title: 'Plants around us', cn: '我们身边的植物',
      phonics: '字母 Mm-Pp 的发音',
      words: [
        w('pep3a', 4, 'apple', 'ˈæpl', '苹果', ['ap','ple'], 'I eat an apple every day.', '我每天吃一个苹果。'),
        w('pep3a', 4, 'banana', 'bəˈnɑːnə', '香蕉', ['ba','na','na'], 'The banana is yellow.', '香蕉是黄色的。'),
        w('pep3a', 4, 'farm', 'fɑːm', '农场', ['farm'], 'We visit a farm today.', '我们今天参观农场。'),
        w('pep3a', 4, 'air', 'eə(r)', '空气', ['air'], 'Plants give us clean air.', '植物给我们清新的空气。'),
        w('pep3a', 4, 'orange', 'ˈɒrɪndʒ', '橙子；柑橘', ['or','ange'], 'This orange is sweet.', '这个橙子很甜。'),
        w('pep3a', 4, 'grape', 'ɡreɪp', '葡萄', ['grape'], 'I like grapes.', '我喜欢葡萄。'),
        w('pep3a', 4, 'school', 'skuːl', '学校', ['school'], 'There are trees at my school.', '我学校里有树。'),
        w('pep3a', 4, 'garden', 'ˈɡɑːdn', '花园', ['gar','den'], 'We have a small garden.', '我们有一个小花园。'),
        w('pep3a', 4, 'need', 'niːd', '需要', ['need'], 'Plants need water and sun.', '植物需要水和阳光。'),
        w('pep3a', 4, 'water', 'ˈwɔːtə(r)', '给……浇水；水', ['wa','ter'], 'I water the flowers.', '我给花浇水。'),
        w('pep3a', 4, 'flower', 'ˈflaʊə(r)', '花；花朵', ['flo','wer'], 'The flower is red.', '这朵花是红色的。'),
        w('pep3a', 4, 'grass', 'ɡrɑːs', '草；草地', ['grass'], 'The grass is green.', '草是绿色的。'),
        w('pep3a', 4, 'plant', 'plɑːnt', '种植；植物', ['plant'], 'I plant a tree.', '我种了一棵树。'),
        w('pep3a', 4, 'new', 'njuː', '新的', ['new'], 'The plant is new.', '这株植物是新的。'),
        w('pep3a', 4, 'tree', 'triː', '树', ['tree'], 'The tree is very tall.', '这棵树很高。'),
        w('pep3a', 4, 'sun', 'sʌn', '太阳；阳光', ['sun'], 'The sun helps plants grow.', '太阳帮助植物生长。'),
        w('pep3a', 4, 'give', 'ɡɪv', '给', ['give'], 'Trees give us fruit.', '树给我们果实。'),
        w('pep3a', 4, 'us', 'ʌs', '我们', ['us'], 'Plants help us a lot.', '植物对我们帮助很大。'),
      ],
    },
    {
      no: 5, title: 'The colourful world', cn: '多彩的世界',
      phonics: '字母 Qq-Uu 的发音',
      words: [
        w('pep3a', 5, 'colour', 'ˈkʌlə(r)', '颜色', ['co','lour'], 'What colour is it?', '它是什么颜色？'),
        w('pep3a', 5, 'orange', 'ˈɒrɪndʒ', '橙红色；橙红色的', ['or','ange'], 'This orange is sweet.', '这个橙子很甜。'),
        w('pep3a', 5, 'green', 'ɡriːn', '绿色；绿色的', ['green'], 'The leaves are green.', '叶子是绿色的。'),
        w('pep3a', 5, 'red', 'red', '红色；红色的', ['red'], 'I have a red bag.', '我有一个红色的书包。'),
        w('pep3a', 5, 'blue', 'bluː', '蓝色；蓝色的', ['blue'], 'The sky is blue.', '天空是蓝色的。'),
        w('pep3a', 5, 'make', 'meɪk', '使出现；做', ['make'], 'Blue and yellow make green.', '蓝色和黄色调出绿色。'),
        w('pep3a', 5, 'purple', 'ˈpɜːpl', '紫色；紫色的', ['pur','ple'], 'I like purple flowers.', '我喜欢紫色的花。'),
        w('pep3a', 5, 'brown', 'braʊn', '棕色；棕色的', ['brown'], 'The bear is brown.', '熊是棕色的。'),
        w('pep3a', 5, 'bear', 'beə(r)', '熊', ['bear'], 'The bear is big and brown.', '这只熊又大又棕。'),
        w('pep3a', 5, 'yellow', 'ˈjeləʊ', '黄色；黄色的', ['yel','low'], 'The sun is yellow.', '太阳是黄色的。'),
        w('pep3a', 5, 'duck', 'dʌk', '鸭', ['duck'], 'The duck is yellow.', '鸭子是黄色的。'),
        w('pep3a', 5, 'sea', 'siː', '海；海洋', ['sea'], 'The sea is blue.', '大海是蓝色的。'),
        w('pep3a', 5, 'pink', 'pɪŋk', '粉色；粉色的', ['pink'], 'Her dress is pink.', '她的裙子是粉色的。'),
        w('pep3a', 5, 'draw', 'drɔː', '画', ['draw'], 'I draw a rainbow.', '我画了一道彩虹。'),
        w('pep3a', 5, 'white', 'waɪt', '白色；白色的', ['white'], 'The cloud is white.', '云是白色的。'),
        w('pep3a', 5, 'black', 'blæk', '黑色；黑色的', ['black'], 'The cat is black.', '这只猫是黑色的。'),
        w('pep3a', 5, 'see', 'siː', '看见', ['see'], 'I see a rainbow.', '我看见一道彩虹。'),
      ],
    },
    {
      no: 6, title: 'Useful numbers', cn: '有用的数字',
      phonics: '字母 Vv-Zz 的发音',
      words: [
        w('pep3a', 6, 'old', 'əʊld', '旧的；（多少）岁', ['old'], 'My sister is five years old.', '我妹妹五岁了。'),
        w('pep3a', 6, 'five', 'faɪv', '五', ['five'], 'I have five books.', '我有五本书。'),
        w('pep3a', 6, 'year', 'jɪə(r)', '年纪；年', ['year'], 'Happy New Year!', '新年快乐！'),
        w('pep3a', 6, 'one', 'wʌn', '一', ['one'], 'I have one nose.', '我有一个鼻子。'),
        w('pep3a', 6, 'two', 'tuː', '二', ['two'], 'I have two hands.', '我有两只手。'),
        w('pep3a', 6, 'three', 'θriː', '三', ['three'], 'There are three cats.', '有三只猫。'),
        w('pep3a', 6, 'four', 'fɔː(r)', '四', ['four'], 'A table has four legs.', '桌子有四条腿。'),
        w('pep3a', 6, 'ten', 'ten', '十', ['ten'], 'I can count to ten.', '我能数到十。'),
        w('pep3a', 6, 'six', 'sɪks', '六', ['six'], 'There are six eggs.', '有六个鸡蛋。'),
        w('pep3a', 6, 'seven', 'ˈsevn', '七', ['se','ven'], 'A week has seven days.', '一周有七天。'),
        w('pep3a', 6, 'eight', 'eɪt', '八', ['eight'], 'I get up at eight.', '我八点起床。'),
        w('pep3a', 6, 'nine', 'naɪn', '九', ['nine'], 'Nine and one is ten.', '九加一等于十。'),
        w('pep3a', 6, 'o\'clock', 'əˈklɒk', '（表示整点）……点钟', ['o','clock'], 'It is nine o clock.', '现在九点钟。'),
        w('pep3a', 6, 'cut', 'kʌt', '切块', ['cut'], 'Cut the cake into six pieces.', '把蛋糕切成六块。'),
        w('pep3a', 6, 'piece', 'piːs', '块；片', ['pie','ce'], 'I eat one piece of cake.', '我吃了一块蛋糕。'),
      ],
    },
  ],
};

// ─────────────────────────────────────────────
// 三年级下册（2024 新版）
// ─────────────────────────────────────────────
const pep3b: Book = {
  id: 'pep3b', name: '三年级下册', grade: 3, term: '下', edition: LIB_EDITION,
  units: [
    {
      no: 1, title: 'Meeting new people', cn: '认识新朋友',
      phonics: 'a 与 a-e 的发音（cat / face）',
      words: [
        w('pep3b', 1, 'where', 'weə(r)', '在哪里；到哪里', ['whe','re'], 'Where are you from?', '你来自哪里？'),
        w('pep3b', 1, 'from', 'frɒm', '来自', ['from'], 'I am from China.', '我来自中国。'),
        w('pep3b', 1, 'about', 'əˈbaʊt', '大约', ['a','bout'], 'Tell me about your school.', '跟我说说你的学校。'),
        w('pep3b', 1, 'today', 'təˈdeɪ', '今天', ['to','day'], 'Today is a happy day.', '今天是开心的一天。'),
        w('pep3b', 1, 'teacher', 'tiːtʃə(r)', '教师', ['tea','cher'], 'Our teacher is kind.', '我们的老师很和蔼。'),
        w('pep3b', 1, 'student', 'stjuːdnt', '学生', ['stu','dent'], 'I am a new student.', '我是一名新学生。'),
        w('pep3b', 1, 'after', 'ɑːftə(r)', '在……后面', ['af','ter'], 'We play after class.', '我们课后一起玩。'),
        w('pep3b', 1, 'who', 'huː', '谁；什么人', ['who'], 'Who is that girl?', '那个女孩是谁？'),
        w('pep3b', 1, 'girl', 'ɡɜːl', '女孩', ['girl'], 'The girl is my classmate.', '那个女孩是我的同学。'),
        w('pep3b', 1, 'neighbour', 'neɪbə(r)', '邻居', ['neigh','bour'], 'Our neighbour is friendly.', '我们的邻居很友好。'),
        w('pep3b', 1, 'boy', 'bɔɪ', '男孩', ['boy'], 'The boy is my friend.', '那个男孩是我的朋友。'),
        w('pep3b', 1, 'woman', 'wʊmən', '成年女子；妇女', ['wo','man'], 'That woman is my aunt.', '那位女士是我姑姑。'),
        w('pep3b', 1, 'man', 'mæn', '成年男子；男人', ['man'], 'The man is my teacher.', '那位男士是我的老师。'),
        w('pep3b', 1, 'Mr', 'mɪstə(r)', '（用于男子的姓氏或姓名前）先生', ['Mr'], 'Good morning, Mr Wang.', '早上好，王先生。'),
        w('pep3b', 1, 'classmate', 'klɑːsmeɪt', '同班同学', ['class','mate'], 'She is my classmate.', '她是我的同学。'),
        w('pep3b', 1, 'he', 'hiː', '他', ['he'], 'He is my new friend.', '他是我的新朋友。'),
        w('pep3b', 1, 'English', 'ɪŋɡlɪʃ', '英语的；英语', ['e','nglish'], 'I like my English class.', '我喜欢英语课。'),
        w('pep3b', 1, 'she', 'ʃiː', '她', ['she'], 'She is from Canada.', '她来自加拿大。'),
        w('pep3b', 1, 'very', 'ˈveri', '很；非常；十分', ['ve','ry'], 'He is very friendly.', '他非常友好。'),
        w('pep3b', 1, 'UK', 'juːkeɪ', '英国', ['UK'], 'My pen pal is from the UK.', '我的笔友来自英国。'),
        w('pep3b', 1, 'China', 'ˈtʃaɪnə', '中国', ['chi','na'], 'I live in China.', '我住在中国。'),
        w('pep3b', 1, 'Canada', 'ˈkænədə', '加拿大', ['ca','na','da'], 'She comes from Canada.', '她来自加拿大。'),
        w('pep3b', 1, 'USA', 'juː es eɪ', '美国', ['USA'], 'He is from the USA.', '他来自美国。'),
      ],
    },
    {
      no: 2, title: 'Expressing yourself', cn: '表达自己',
      phonics: 'e 的长音 /iː/（he, she, we）',
      words: [
        w('pep3b', 2, 'has', 'hæz', '有（have 的第三人称单数）', ['has'], 'She has long hair.', '她有长头发。'),
        w('pep3b', 2, 'long', 'lɒŋ', '长的', ['long'], 'The rope is very long.', '绳子很长。'),
        w('pep3b', 2, 'body', 'ˈbɒdi', '身体', ['bo','dy'], 'Shake your body.', '摇摇你的身体。'),
        w('pep3b', 2, 'short', 'ʃɔːt', '短的；矮的', ['short'], 'My hair is short.', '我的头发很短。'),
        w('pep3b', 2, 'leg', 'leɡ', '腿', ['leg'], 'The dog has four legs.', '狗有四条腿。'),
        w('pep3b', 2, 'right', 'raɪt', '对的；准确的', ['right'], 'Your answer is right.', '你的答案是对的。'),
        w('pep3b', 2, 'fat', 'fæt', '肥的；肥胖的', ['fat'], 'The cat is a little fat.', '这只猫有点胖。'),
        w('pep3b', 2, 'thin', 'θɪn', '瘦的', ['thin'], 'The monkey is thin.', '这只猴子很瘦。'),
        w('pep3b', 2, 'slow', 'sləʊ', '缓慢的；慢的', ['slow'], 'The turtle is slow.', '乌龟很慢。'),
        w('pep3b', 2, 'love', 'lʌv', '喜爱；爱', ['love'], 'I love my family.', '我爱我的家人。'),
        w('pep3b', 2, 'tail', 'teɪl', '尾；尾巴', ['tail'], 'The dog wags its tail.', '狗摇着尾巴。'),
        w('pep3b', 2, 'her', 'hɜː(r)', '她；她的', ['her'], 'Her hair is long.', '她的头发很长。'),
        w('pep3b', 2, 'gift', 'ɡɪft', '礼物', ['gift'], 'This gift is for you.', '这个礼物是给你的。'),
        w('pep3b', 2, 'picture', 'ˈpɪktʃə(r)', '图画；绘画', ['pic','ture'], 'I draw a picture of my family.', '我画了一张全家福。'),
        w('pep3b', 2, 'card', 'kɑːd', '贺卡；慰问卡；卡片', ['card'], 'I make a card for mum.', '我给妈妈做了一张贺卡。'),
        w('pep3b', 2, 'sing', 'sɪŋ', '唱（歌）；演唱', ['sing'], 'Let us sing a song.', '我们唱首歌吧。'),
        w('pep3b', 2, 'dance', 'dɑːns', '跳舞', ['dan','ce'], 'She can dance well.', '她跳舞跳得好。'),
        w('pep3b', 2, 'face', 'feɪs', '脸；面孔', ['face'], 'She has a happy face.', '她脸上带着笑容。'),
        w('pep3b', 2, 'all', 'ɔːl', '全部；所有', ['all'], 'We all love music.', '我们都喜欢音乐。'),
        w('pep3b', 2, 'so', 'səʊ', '这么；那么', ['so'], 'The cat is so cute.', '这只猫太可爱了。'),
        w('pep3b', 2, 'talk', 'tɔːk', '说；讲', ['talk'], 'Let us talk about our family.', '我们聊聊各自的家庭吧。'),
        w('pep3b', 2, 'song', 'sɒŋ', '歌；歌曲', ['song'], 'This song is nice.', '这首歌很好听。'),
        w('pep3b', 2, 'or', 'ɔː(r)', '或者', ['or'], 'Do you like red or blue?', '你喜欢红色还是蓝色？'),
        w('pep3b', 2, 'much', 'mʌtʃ', '许多', ['much'], 'Thank you very much.', '非常感谢。'),
      ],
    },
    {
      no: 3, title: 'Learning better', cn: '更好地学习',
      phonics: 'i 与 i-e 的发音（big / bike）',
      words: [
        w('pep3b', 3, 'eraser', 'ɪˈreɪzə(r)', '橡皮', ['e','ra','ser'], 'May I use your eraser?', '我能用一下你的橡皮吗？'),
        w('pep3b', 3, 'find', 'faɪnd', '找到；找出', ['find'], 'I cannot find my pen.', '我找不到我的钢笔了。'),
        w('pep3b', 3, 'ruler', 'ˈruːlə(r)', '直尺', ['ru','ler'], 'My ruler is twenty centimetres.', '我的尺子二十厘米。'),
        w('pep3b', 3, 'pen', 'pen', '钢笔', ['pen'], 'This is my new pen.', '这是我的新钢笔。'),
        w('pep3b', 3, 'pencil', 'ˈpensl', '铅笔', ['pen','cil'], 'I have a red pencil.', '我有一支红铅笔。'),
        w('pep3b', 3, 'book', 'bʊk', '书；书籍', ['book'], 'This book is interesting.', '这本书很有趣。'),
        w('pep3b', 3, 'bag', 'bæɡ', '包；袋', ['bag'], 'My bag is heavy.', '我的书包很重。'),
        w('pep3b', 3, 'paper', 'ˈpeɪpə(r)', '纸', ['pa','per'], 'I write on the paper.', '我在纸上写字。'),
        w('pep3b', 3, 'these', 'ðiːz', '这些', ['these'], 'These are my books.', '这些是我的书。'),
        w('pep3b', 3, 'see', 'siː', '看见', ['see'], 'I see a rainbow.', '我看见一道彩虹。'),
        w('pep3b', 3, 'smell', 'smel', '闻（气味）', ['smell'], 'I smell the flowers.', '我闻花香。'),
        w('pep3b', 3, 'taste', 'teɪst', '尝（味道）', ['tas','te'], 'Taste the apple, please.', '请尝尝这个苹果。'),
        w('pep3b', 3, 'hear', 'hɪə(r)', '听见；听到', ['hear'], 'I hear a bird singing.', '我听见鸟在唱歌。'),
        w('pep3b', 3, 'touch', 'tʌtʃ', '触摸；碰', ['touch'], 'Touch the soft cat.', '摸摸这只柔软的猫。'),
        w('pep3b', 3, 'learn', 'lɜːn', '学；学习', ['learn'], 'We learn with our senses.', '我们用感官学习。'),
        w('pep3b', 3, 'nose', 'nəʊz', '鼻；鼻子', ['nose'], 'My nose can smell.', '我的鼻子能闻气味。'),
        w('pep3b', 3, 'tongue', 'tʌŋ', '舌；舌头', ['ton','gue'], 'My tongue can taste.', '我的舌头能尝味道。'),
        w('pep3b', 3, 'class', 'klɑːs', '课；班级', ['class'], 'We have English class today.', '我们今天有英语课。'),
        w('pep3b', 3, 'in class', '', '在课堂上', ['in','class'], 'Listen carefully in class.', '上课时要认真听讲。'),
        w('pep3b', 3, 'computer', 'kəmˈpjuːtə(r)', '计算机；电脑', ['com','pu','ter'], 'I use a computer to learn.', '我用电脑学习。'),
      ],
    },
    {
      no: 4, title: 'Healthy food', cn: '健康食物',
      phonics: 'o 与 o-e 的发音（hot / nose）',
      words: [
        w('pep3b', 4, 'breakfast', 'ˈbrekfəst', '早餐；早饭', ['break','fast'], 'I have breakfast at seven.', '我七点吃早饭。'),
        w('pep3b', 4, 'time', 'taɪm', '时间', ['time'], 'It is time for lunch.', '该吃午饭了。'),
        w('pep3b', 4, 'bread', 'bred', '面包', ['bread'], 'I eat bread for breakfast.', '我早饭吃面包。'),
        w('pep3b', 4, 'egg', 'eɡ', '（作食物用的）蛋；鸡蛋', ['egg'], 'I have an egg every morning.', '我每天早上吃一个鸡蛋。'),
        w('pep3b', 4, 'milk', 'mɪlk', '（牛或羊等的）奶；牛奶', ['milk'], 'Drink a glass of milk.', '喝一杯牛奶。'),
        w('pep3b', 4, 'noodle', 'ˈnuːdl', '（常用复数）面条', ['noo','dle'], 'I like noodles very much.', '我非常喜欢面条。'),
        w('pep3b', 4, 'juice', 'dʒuːs', '果汁', ['jui','ce'], 'Orange juice is sweet.', '橙汁很甜。'),
        w('pep3b', 4, 'rice', 'raɪs', '大米', ['rice'], 'We eat rice for lunch.', '我们午饭吃米饭。'),
        w('pep3b', 4, 'meat', 'miːt', '肉', ['meat'], 'I eat some meat.', '我吃了一些肉。'),
        w('pep3b', 4, 'vegetable', 'ˈvedʒtəbl', '蔬菜', ['ve','ge','ta','ble'], 'Vegetables are good for us.', '蔬菜对我们有好处。'),
        w('pep3b', 4, 'healthy', 'ˈhelθi', '健康的', ['heal','thy'], 'Fruit is healthy food.', '水果是健康食物。'),
        w('pep3b', 4, 'plate', 'pleɪt', '盘子', ['plate'], 'The plate is on the table.', '盘子放在桌上。'),
        w('pep3b', 4, 'soup', 'suːp', '汤', ['soup'], 'The soup is hot.', '汤很烫。'),
        w('pep3b', 4, 'fruit', 'fruːt', '水果', ['fruit'], 'I eat fruit every day.', '我每天都吃水果。'),
        w('pep3b', 4, 'colourful', 'ˈkʌləfl', '五彩缤纷的', ['co','lour','ful'], 'My plate is colourful.', '我的盘子色彩丰富。'),
        w('pep3b', 4, 'candy', 'ˈkændi', '糖果', ['can','dy'], 'Too much candy is not good.', '吃太多糖不好。'),
        w('pep3b', 4, 'yummy', 'ˈjʌmi', '很好吃的', ['yum','my'], 'The noodles are yummy.', '面条很好吃。'),
      ],
    },
    {
      no: 5, title: 'Old toys', cn: '旧玩具',
      phonics: 'u 与 u-e 的发音（but / use）',
      words: [
        w('pep3b', 5, 'at', 'æt', '在（某处）', ['at'], 'Look at my old toys.', '看看我的旧玩具。'),
        w('pep3b', 5, 'boat', 'bəʊt', '小船；舟', ['boat'], 'My boat is made of paper.', '我的小船是纸做的。'),
        w('pep3b', 5, 'cool', 'kuːl', '酷的；绝妙的', ['cool'], 'Your toy car is cool!', '你的玩具车真酷！'),
        w('pep3b', 5, 'keep', 'kiːp', '保有；留着', ['keep'], 'I keep my old toys.', '我留着我的旧玩具。'),
        w('pep3b', 5, 'home', 'həʊm', '家；住所', ['home'], 'The toys are at home.', '玩具在家里。'),
        w('pep3b', 5, 'ball', 'bɔːl', '球', ['ball'], 'The ball is under the bed.', '球在床底下。'),
        w('pep3b', 5, 'doll', 'dɒl', '玩偶；玩具娃娃', ['doll'], 'She has an old doll.', '她有一个旧娃娃。'),
        w('pep3b', 5, 'car', 'kɑː(r)', '小汽车；轿车', ['car'], 'This is my toy car.', '这是我的玩具小汽车。'),
        w('pep3b', 5, 'on', 'ɒn', '在……上面', ['on'], 'The book is on the desk.', '书在桌上。'),
        w('pep3b', 5, 'shelf', 'ʃelf', '架子（复数 shelves）', ['shelf'], 'The toys are on the shelf.', '玩具在架子上。'),
        w('pep3b', 5, 'in', 'ɪn', '在……里面', ['in'], 'The ball is in the box.', '球在盒子里。'),
        w('pep3b', 5, 'box', 'bɒks', '箱子', ['box'], 'Put the toys in the box.', '把玩具放进盒子里。'),
        w('pep3b', 5, 'cap', 'kæp', '帽子', ['cap'], 'I have an old cap.', '我有一顶旧帽子。'),
        w('pep3b', 5, 'map', 'mæp', '地图', ['map'], 'There is a map on the wall.', '墙上有一幅地图。'),
        w('pep3b', 5, 'under', 'ˈʌndə(r)', '在（或到、通过）……下面', ['un','der'], 'The cat is under the chair.', '猫在椅子下面。'),
        w('pep3b', 5, 'still', 'stɪl', '还是；仍然', ['still'], 'My old bear is still here.', '我的旧熊还在这儿。'),
        w('pep3b', 5, 'put', 'pʊt', '放；安置', ['put'], 'Put the doll on the shelf.', '把娃娃放到架子上。'),
      ],
    },
    {
      no: 6, title: 'Numbers in life', cn: '生活中的数字',
      phonics: 'c, g, l, y 的双音规律',
      words: [
        w('pep3b', 6, 'eleven', 'ɪˈlevn', '十一', ['e','le','ven'], 'There are eleven boys.', '有十一个男孩。'),
        w('pep3b', 6, 'twelve', 'twelv', '十二', ['twel','ve'], 'A year has twelve months.', '一年有十二个月。'),
        w('pep3b', 6, 'thirteen', 'ˌθɜːˈtiːn', '十三', ['thir','teen'], 'My brother is thirteen.', '我哥哥十三岁。'),
        w('pep3b', 6, 'fourteen', 'ˌfɔːˈtiːn', '十四', ['four','teen'], 'I have fourteen pencils.', '我有十四支铅笔。'),
        w('pep3b', 6, 'fifteen', 'ˌfɪfˈtiːn', '十五', ['fif','teen'], 'There are fifteen students.', '有十五名学生。'),
        w('pep3b', 6, 'sixteen', 'ˌsɪksˈtiːn', '十六', ['six','teen'], 'She is sixteen years old.', '她十六岁。'),
        w('pep3b', 6, 'seventeen', 'ˌsevnˈtiːn', '十七', ['se','ven','teen'], 'Seventeen and three is twenty.', '十七加三等于二十。'),
        w('pep3b', 6, 'eighteen', 'ˌeɪˈtiːn', '十八', ['ei','ghteen'], 'My cousin is eighteen.', '我表哥十八岁。'),
        w('pep3b', 6, 'nineteen', 'ˌnaɪnˈtiːn', '十九', ['ni','ne','teen'], 'There are nineteen books.', '有十九本书。'),
        w('pep3b', 6, 'twenty', 'ˈtwenti', '二十', ['twen','ty'], 'I can count to twenty.', '我能数到二十。'),
        w('pep3b', 6, 'piggy bank', 'ˈpɪɡi bæŋk', '猪形储钱罐', ['pig','gy','bank'], 'I put money in my piggy bank.', '我把钱放进存钱罐。'),
        w('pep3b', 6, 'pay', 'peɪ', '付费', ['pay'], 'I pay for the toy.', '我付钱买这个玩具。'),
        w('pep3b', 6, 'back', 'bæk', '回到原处', ['back'], 'Give the book back, please.', '请把书还回来。'),
      ],
    },
  ],
};

export const BOOKS: Book[] = [pep3a, pep3b];

/** 全部单词的扁平索引 */
export const ALL_WORDS: Word[] = BOOKS.flatMap((b) => b.units.flatMap((u) => u.words));

/** 按 id 快速查找 */
export const WORD_BY_ID: Map<string, Word> = new Map(ALL_WORDS.map((x) => [x.id, x]));

/** 统计信息 */
export const STATS = {
  books: BOOKS.length,
  units: BOOKS.reduce((n, b) => n + b.units.length, 0),
  words: ALL_WORDS.length,
  edition: LIB_EDITION,
};
