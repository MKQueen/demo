// 京城来信 · 中文剧情 / 投递任务数据
// ---------------------------------------------------------------------------
// 所有对话都写成「短短一句、有手写信的味道」：不解释、不煽情，留一点空白。
// NPC 一律使用原站模型名（chef / oldwoman / musician / office-worker /
// young-lady / scout / mountainman / diver / fox ...），地点沿用原站区域
// （海边码头 / 村子 / 森林 / 工厂 / 山寺 / 瀑布）。
//
// 交给 Lead 的接口：
//   LETTERS             5 份投递任务（数组，顺序即清单顺序）
//   NPC_INFO            NPC 显示名 / 气泡标签颜色 / 配音
//   REGIONS             区域信息（中文名、环境音 key）
//   INTRO_LINES         开场三句话（对应原站 introTexts）
//   ENDING_LINES        五封信全部送完后的收尾
//   COURIER             主角标签
//   getLetter(id)       按 id 取任务
//   lettersForNpc(model) 某个 NPC 模型身上挂着的任务（giver 或 target）
//   checklistItems(states) 生成清单 overlay 需要的数据
//   regionOf(spotId)    锚点 → 区域 key（给环境音用）
// ---------------------------------------------------------------------------

/** 主角（玩家的邮差身份）。name 显示在对话气泡的蓝色名牌上。 */
export const COURIER = {
  name: '京城邮差',
  latin: 'MESSENGER',
  color: '#66BDE6',
  voice: 'female2',
};

/** NPC 显示信息。color 是名牌底色（原站每个 NPC 有专属颜色）。 */
export const NPC_INFO = {
  chef: { name: '周师傅', short: '码头厨子', color: '#E7A54B', voice: 'male3' },
  oldwoman: { name: '槐树下的奶奶', short: '老奶奶', color: '#8CC48C', voice: 'female1' },
  musician: { name: '老戴', short: '吹口琴的人', color: '#DE794E', voice: 'male2' },
  'office-worker': { name: '小唐', short: '加班的职员', color: '#C25959', voice: 'male1' },
  'young-lady': { name: '阿棠', short: '卖花的姑娘', color: '#F3C258', voice: 'female3' },
  scout: { name: '小陆', short: '守林人', color: '#66BDE6', voice: 'male2' },
  mountainman: { name: '守庙人', short: '山上的人', color: '#8CC48C', voice: 'male3' },
  diver: { name: '阿海', short: '潜水员', color: '#66BDE6', voice: 'male1' },
  fox: { name: '小狐狸', short: '仓库管理员', color: '#E7A54B', voice: 'female2' },
};

/**
 * 区域。name 用于区域标题和清单里的「地点」；
 * ambience 是程序化环境音的 key（见 src/game/audio.js 的 setRegion）。
 */
export const REGIONS = {
  beach: { name: '海边码头', latin: 'HARBOUR', ambience: 'beach' },
  village: { name: '村子', latin: 'VILLAGE', ambience: 'village' },
  forest: { name: '森林', latin: 'FOREST', ambience: 'forest' },
  factory: { name: '工厂', latin: 'FACTORY', ambience: 'factory' },
  temple: { name: '山寺', latin: 'TEMPLE', ambience: 'temple' },
  waterfalls: { name: '瀑布边', latin: 'SMELLY FALLS', ambience: 'waterfalls' },
};

/** 开场三句话：睡过头、清单上有五封、出发。 */
export const INTRO_LINES = [
  { name: COURIER.name, color: COURIER.color, text: '好像睡过头了……今天的信，得赶紧送出去。' },
  { name: COURIER.name, color: COURIER.color, text: '清单上有五封。希望都不难找。' },
  { name: COURIER.name, color: COURIER.color, text: '好，出发吧。' },
];

/** 五封信全部送完后的收尾（可让 Lead 在最后一封信后自动播放）。 */
export const ENDING_LINES = [
  { name: COURIER.name, color: COURIER.color, text: '五封信，都送到了。' },
  { name: COURIER.name, color: COURIER.color, text: '风把最后一张信纸吹得哗啦响。' },
  { name: COURIER.name, color: COURIER.color, text: '明天……希望可以多睡一会儿。' },
];

/** 五份投递。顺序即清单顺序（1..5）。 */
export const LETTERS = [
  {
    id: 'harbour-recipe',
    order: 1,
    title: '海底捞上来的信',
    checklistTitle: '海底捞上来的信',
    item: '泡过海水的信',
    itemModel: 'deliveries/letterwet.drc',
    giver: 'diver',
    giverModel: 'diver',
    giverSpot: 'spot_diver',
    giverRegion: 'beach',
    target: 'chef',
    targetModel: 'chef',
    targetSpot: 'spot_chef',
    targetRegion: 'beach',
    pickupSpot: 'pickup_letter',
    objective: '把泡过海水的信送到码头饭馆的周师傅手里',
    // 委托人（潜水员阿海）
    ask: [
      { name: '阿海', color: '#66BDE6', text: '你来得正好。我今早潜下去捡牡蛎，摸到一只锈铁盒。' },
      { name: '阿海', color: '#66BDE6', text: '盒子里有封信。泡得发软，可抬头还认得出——「周」字。' },
      { name: '阿海', color: '#66BDE6', text: '码头饭馆的周师傅？他爸当年就是出海没回来的。' },
      { name: '阿海', color: '#66BDE6', text: '帮我送一下吧。别说是海底捞的，就说……是在岸上捡的。' },
    ],
    // 收件人（周师傅）
    reply: [
      { name: '周师傅', color: '#E7A54B', text: '给我的信？……这字，是我爸写的。' },
      { name: '周师傅', color: '#E7A54B', text: '他写字总把最后一笔拖得很长。' },
      { name: '周师傅', color: '#E7A54B', text: '……纸上写着，他在那边也天天吃面。' },
      { name: '周师傅', color: '#E7A54B', text: '好，好啊。今晚我给自己多加一个蛋。' },
    ],
    doneText: '那封信被压在了饭馆的菜单底下。周师傅说，不收钱的那种。',
    doneToast: '送达 · 海底捞上来的信',
  },
  {
    id: 'village-postcard',
    order: 2,
    title: '卖花姑娘的明信片',
    checklistTitle: '卖花姑娘的明信片',
    item: '一张干花明信片',
    itemModel: 'deliveries/postcard.drc',
    giver: 'young-lady',
    giverModel: 'young-lady',
    giverSpot: 'spot_flowerlady',
    giverRegion: 'village',
    target: 'scout',
    targetModel: 'scout',
    targetSpot: 'spot_scout',
    targetRegion: 'forest',
    pickupSpot: 'pickup_postcard',
    objective: '把干花明信片送给林子边的守林人小陆',
    ask: [
      { name: '阿棠', color: '#F3C258', text: '这朵小雏菊是我摊上最倔的一朵，压了三个月都没褪色。' },
      { name: '阿棠', color: '#F3C258', text: '你帮我寄给小陆吧。林子边那个，总在树下记账的人。' },
      { name: '阿棠', color: '#F3C258', text: '别写寄件人。他一猜就知道是我。' },
    ],
    reply: [
      { name: '小陆', color: '#66BDE6', text: '给我的？……明信片后面没字。' },
      { name: '小陆', color: '#66BDE6', text: '一朵压干的雏菊。我知道了。' },
      { name: '小陆', color: '#66BDE6', text: '麻烦你替我在清单上记一笔：我收到了。就这三个字。' },
    ],
    doneText: '小陆把明信片夹进巡山记录本里。那一页只写了两个字：天气晴。',
    doneToast: '送达 · 卖花姑娘的明信片',
  },
  {
    id: 'factory-samples',
    order: 3,
    title: '寄错的离职信',
    checklistTitle: '寄错的离职信',
    item: '一封没封口的信',
    itemModel: 'deliveries/note.drc',
    giver: 'office-worker',
    giverModel: 'office-worker',
    giverSpot: 'spot_worker',
    giverRegion: 'factory',
    target: 'fox',
    targetModel: 'fox',
    targetSpot: 'spot_fox',
    targetRegion: 'factory',
    pickupSpot: 'pickup_note',
    objective: '把没封口的信送到工厂仓库管理员小狐狸那里',
    ask: [
      { name: '小唐', color: '#C25959', text: '呜……我把信寄错地址了。本来想寄给自己，结果填了公司。' },
      { name: '小唐', color: '#C25959', text: '里面写了好多气话，还画了老板的鼻子。' },
      { name: '小唐', color: '#C25959', text: '仓库的小狐狸会把信分类退回。你帮我要回来，好吗？' },
      { name: '小唐', color: '#C25959', text: '就说是……一份写得太用力的草稿。' },
    ],
    reply: [
      { name: '小狐狸', color: '#E7A54B', text: '唔，这封信我记得。它自己从信封里探出来半个头。' },
      { name: '小狐狸', color: '#E7A54B', text: '我没有拆。嗅了嗅，是青草味和火气的味道。' },
      { name: '小狐狸', color: '#E7A54B', text: '拿去吧。下次写好了再寄，我给它盖个好看的戳。' },
    ],
    doneText: '小唐把信折成很小的一块，塞进了抽屉最里面。第二天，他换了新头像。',
    doneToast: '送达 · 寄错的离职信',
  },
  {
    id: 'temple-offering',
    order: 4,
    title: '一盒桂花糕',
    checklistTitle: '一盒桂花糕',
    item: '一盒还温着的桂花糕',
    itemModel: 'deliveries/offering.drc',
    giver: 'oldwoman',
    giverModel: 'oldwoman',
    giverSpot: 'spot_oldwoman',
    giverRegion: 'village',
    target: 'mountainman',
    targetModel: 'mountainman',
    targetSpot: 'spot_mountainman',
    targetRegion: 'temple',
    pickupSpot: 'pickup_offering',
    objective: '把桂花糕送上山，交给守着山寺的人',
    ask: [
      { name: '槐树下的奶奶', color: '#8CC48C', text: '孩子，帮我跑一趟山寺。' },
      { name: '槐树下的奶奶', color: '#8CC48C', text: '这盒桂花糕蒸好了，得趁热。坡太陡，我这膝盖不争气。' },
      { name: '槐树下的奶奶', color: '#8CC48C', text: '给守着庙的人。别问他为什么不下山。' },
    ],
    reply: [
      { name: '守庙人', color: '#8CC48C', text: '桂花糕？……还热的。' },
      { name: '守庙人', color: '#8CC48C', text: '她从山脚一直记着我。' },
      { name: '守庙人', color: '#8CC48C', text: '你替我带句话回去：庙后的桂树，今年开得比去年好。' },
    ],
    doneText: '下山时，风里有桂花味。奶奶听完那句话，笑着把窗打开了。',
    doneToast: '送达 · 一盒桂花糕',
  },
  {
    id: 'waterfall-recording',
    order: 5,
    title: '瀑布边的旧唱片',
    checklistTitle: '瀑布边的旧唱片',
    item: '一张旧唱片和一包桂花糕',
    itemModel: 'deliveries/samplebox.drc',
    giver: 'chef',
    giverModel: 'chef',
    giverSpot: 'spot_chef',
    giverRegion: 'beach',
    target: 'musician',
    targetModel: 'musician',
    targetSpot: 'spot_musician',
    targetRegion: 'waterfalls',
    pickupSpot: 'pickup_record',
    objective: '把旧唱片和桂花糕送到瀑布边的老戴手里',
    ask: [
      { name: '周师傅', color: '#E7A54B', text: '你还要往林子那边去吧？顺路帮我捎点东西。' },
      { name: '周师傅', color: '#E7A54B', text: '一张旧唱片，我年轻时录的。还有一包桂花糕，他爱吃。' },
      { name: '周师傅', color: '#E7A54B', text: '他叫老戴，在瀑布边吹口琴。你跟他说，面馆还留着靠窗的位置。' },
    ],
    reply: [
      { name: '老戴', color: '#DE794E', text: '唱片？……这是小周的声音啊。' },
      { name: '老戴', color: '#DE794E', text: '那时候他唱歌老跑调，我们还说，等老了就不跑了。' },
      { name: '老戴', color: '#DE794E', text: '（口琴响了两声，又停下。）' },
      { name: '老戴', color: '#DE794E', text: '告诉他，我明天去海边吃面。要靠窗的位置。' },
    ],
    doneText: '那天傍晚，瀑布边有人吹了很久的口琴。海边饭馆的窗开了一整夜。',
    doneToast: '送达 · 瀑布边的旧唱片',
  },
];

/** 按 id 找信。 */
export function getLetter(id) {
  return LETTERS.find((letter) => letter.id === id) || null;
}

/** 某个 NPC 模型身上关联的信（作为委托人或者收件人）。 */
export function lettersForNpc(model) {
  return LETTERS.filter((letter) => letter.giverModel === model || letter.targetModel === model);
}

/** 生成清单 overlay 数据：{ id, order, title, item, place, target, status } */
export function checklistItems(states = {}) {
  return LETTERS.map((letter) => {
    const status = states[letter.id] || 'pending';
    return {
      id: letter.id,
      order: letter.order,
      title: letter.checklistTitle,
      item: letter.item,
      place: REGIONS[letter.targetRegion].name,
      target: NPC_INFO[letter.target].name,
      status, // 'pending' | 'carrying' | 'done'
      done: status === 'done',
    };
  });
}

/**
 * 生成一段对话脚本，交给 createDialogue().start()。
 * kind: 'ask'（委托人交信） | 'reply'（收件人收信） | 'done'（完成后旁白）
 * 返回 [{ name, color, text }...]
 */
export function scriptFor(letterId, kind = 'ask') {
  const letter = getLetter(letterId);
  if (!letter) return [];
  if (kind === 'ask') return letter.ask.slice();
  if (kind === 'reply') return letter.reply.slice();
  if (kind === 'done') {
    return [{ name: COURIER.name, color: COURIER.color, text: letter.doneText }];
  }
  return [];
}

/** 锚点 id → 区域 key；给 Lead 切换环境音/区域标题用。 */
export const SPOT_REGION = (() => {
  const map = {};
  for (const letter of LETTERS) {
    map[letter.giverSpot] = letter.giverRegion;
    map[letter.targetSpot] = letter.targetRegion;
    map[letter.pickupSpot] = letter.targetRegion;
  }
  return map;
})();

export function regionOf(spotId) {
  return SPOT_REGION[spotId] || null;
}
