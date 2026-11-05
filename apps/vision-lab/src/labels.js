/**
 * labels.js —— COCO 80 类标签（中英）与配色。
 *
 * MediaPipe ObjectDetector 的 tflite 模型自带 label map，通常会直接返回
 * categoryName；但不同版本的模型也可能只给 index，所以这里保留一份
 * 标准 COCO 标签作为兜底，同时提供中文名称给界面用。
 */

export const COCO_LABELS = [
  ['person', '人'],
  ['bicycle', '自行车'],
  ['car', '汽车'],
  ['motorcycle', '摩托车'],
  ['airplane', '飞机'],
  ['bus', '公交车'],
  ['train', '火车'],
  ['truck', '卡车'],
  ['boat', '船'],
  ['traffic light', '交通灯'],
  ['fire hydrant', '消防栓'],
  ['stop sign', '停车标志'],
  ['parking meter', '停车计时器'],
  ['bench', '长椅'],
  ['bird', '鸟'],
  ['cat', '猫'],
  ['dog', '狗'],
  ['horse', '马'],
  ['sheep', '羊'],
  ['cow', '牛'],
  ['elephant', '大象'],
  ['bear', '熊'],
  ['zebra', '斑马'],
  ['giraffe', '长颈鹿'],
  ['backpack', '背包'],
  ['umbrella', '雨伞'],
  ['handbag', '手提包'],
  ['tie', '领带'],
  ['suitcase', '行李箱'],
  ['frisbee', '飞盘'],
  ['skis', '滑雪板'],
  ['snowboard', '单板滑雪板'],
  ['sports ball', '球'],
  ['kite', '风筝'],
  ['baseball bat', '棒球棒'],
  ['baseball glove', '棒球手套'],
  ['skateboard', '滑板'],
  ['surfboard', '冲浪板'],
  ['tennis racket', '网球拍'],
  ['bottle', '瓶子'],
  ['wine glass', '酒杯'],
  ['cup', '杯子'],
  ['fork', '叉子'],
  ['knife', '刀'],
  ['spoon', '勺子'],
  ['bowl', '碗'],
  ['banana', '香蕉'],
  ['apple', '苹果'],
  ['sandwich', '三明治'],
  ['orange', '橙子'],
  ['broccoli', '西兰花'],
  ['carrot', '胡萝卜'],
  ['hot dog', '热狗'],
  ['pizza', '披萨'],
  ['donut', '甜甜圈'],
  ['cake', '蛋糕'],
  ['chair', '椅子'],
  ['couch', '沙发'],
  ['potted plant', '盆栽'],
  ['bed', '床'],
  ['dining table', '桌子'],
  ['toilet', '马桶'],
  ['tv', '电视'],
  ['laptop', '笔记本电脑'],
  ['mouse', '鼠标'],
  ['remote', '遥控器'],
  ['keyboard', '键盘'],
  ['cell phone', '手机'],
  ['microwave', '微波炉'],
  ['oven', '烤箱'],
  ['toaster', '烤面包机'],
  ['sink', '水槽'],
  ['refrigerator', '冰箱'],
  ['book', '书'],
  ['clock', '时钟'],
  ['vase', '花瓶'],
  ['scissors', '剪刀'],
  ['teddy bear', '泰迪熊'],
  ['hair drier', '吹风机'],
  ['toothbrush', '牙刷'],
];

const ZH_BY_EN = new Map(COCO_LABELS);
const EN_BY_INDEX = COCO_LABELS.map(([en]) => en);

/** 类别 → 中文名；未知类别返回英文或「物体」 */
export function zhLabel(en) {
  if (!en) return '物体';
  return ZH_BY_EN.get(en) || en;
}

/** 根据模型返回的 categoryName / index 得到稳定的英文类别名 */
export function resolveCategoryName(categoryName, index) {
  if (categoryName) return categoryName;
  if (Number.isInteger(index) && index >= 0 && index < EN_BY_INDEX.length) return EN_BY_INDEX[index];
  return '';
}

/** 检测框配色：按类别名稳定散列到一组高对比度颜色 */
const PALETTE = [
  '#8ef0a8',
  '#6ce5ff',
  '#ffc46b',
  '#c4a7ff',
  '#ff9db5',
  '#7ef0d0',
  '#ffe066',
  '#9ad0ff',
  '#ff8f6b',
  '#b8f26b',
  '#f0a8ff',
  '#6bffe1',
];

export function colorFor(name) {
  let hash = 0;
  const text = String(name || '');
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

/** 粗粒度位置描述，用于 AI 场景解读的 prompt */
export function positionHint(box) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const horizontal = cx < 0.33 ? '左侧' : cx > 0.67 ? '右侧' : '中间';
  const vertical = cy < 0.33 ? '上部' : cy > 0.67 ? '下部' : '中部';
  return `${horizontal}${vertical}`;
}
