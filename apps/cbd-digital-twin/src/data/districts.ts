/** 北京市 16 区行政目录：用于「一次展示一个区」的行政区导航。 */
export interface DistrictInfo {
  name: string;
  en: string;
  areaKm2: number;
  highlights: string[];
  description: string;
}

export const DISTRICTS: DistrictInfo[] = [
  {
    name: '东城区',
    en: 'DONGCHENG',
    areaKm2: 41.87,
    highlights: ['故宫', '天安门', '天坛', '雍和宫'],
    description: '北京旧城东部与中轴线核心，故宫、天坛、天安门与雍和宫集中在这里。',
  },
  {
    name: '西城区',
    en: 'XICHENG',
    areaKm2: 50.2,
    highlights: ['北海公园', '国家大剧院', '什刹海'],
    description: '北京旧城西部，皇家园林、国家大剧院与什刹海胡同构成历史与当代交织的城区。',
  },
  {
    name: '朝阳区',
    en: 'CHAOYANG',
    areaKm2: 465.51,
    highlights: ['国贸 CBD', '央视总部', '鸟巢', '798', '三里屯'],
    description: '北京中央商务区与国际化城区，CBD 天际线、奥运场馆与艺术街区集中。',
  },
  {
    name: '海淀区',
    en: 'HAIDIAN',
    areaKm2: 431.39,
    highlights: ['颐和园', '圆明园', '清华园'],
    description: '北京西北部科教文化区，三山五园、顶尖高校与中关村创新走廊所在。',
  },
  {
    name: '丰台区',
    en: 'FENGTAI',
    areaKm2: 304.66,
    highlights: ['卢沟桥', '北京南站'],
    description: '北京西南部交通门户，卢沟桥、永定河与北京南站构成历史与枢纽双重身份。',
  },
  {
    name: '石景山区',
    en: 'SHIJINGSHAN',
    areaKm2: 84.59,
    highlights: ['首钢园', '滑雪大跳台'],
    description: '北京西部工业更新样本，首钢园与冬奥场馆把重工业遗产转化为城市新地标。',
  },
  {
    name: '门头沟区',
    en: 'MENTOUGOU',
    areaKm2: 1449.84,
    highlights: ['潭柘寺', '戒台寺'],
    description: '北京西部西山生态涵养区，千年古刹、山地村落与永定河峡谷串联。',
  },
  {
    name: '房山区',
    en: 'FANGSHAN',
    areaKm2: 2001.88,
    highlights: ['云居寺', '十渡'],
    description: '北京西南山水与石经文化区，云居寺石经、十渡喀斯特河谷是代表。',
  },
  {
    name: '通州区',
    en: 'TONGZHOU',
    areaKm2: 906.47,
    highlights: ['燃灯塔', '大运河', '环球度假区'],
    description: '北京城市副中心与大运河北端，燃灯塔、运河滨水空间与环球度假区汇聚。',
  },
  {
    name: '顺义区',
    en: 'SHUNYI',
    areaKm2: 1010.5,
    highlights: ['首都机场', '新国展', '水上公园'],
    description: '北京东北部临空经济区，首都机场、会展与潮白河水上运动空间构成门户。',
  },
  {
    name: '昌平区',
    en: 'CHANGPING',
    areaKm2: 1344.35,
    highlights: ['明十三陵', '居庸关'],
    description: '北京西北部历史与科创走廊，明十三陵、居庸关与未来科学城分布在山前平原。',
  },
  {
    name: '大兴区',
    en: 'DAXING',
    areaKm2: 1035.12,
    highlights: ['大兴机场', '南海子公园'],
    description: '北京南部国际航空门户与生态空间，大兴机场、南中轴与南海子公园构成新的城市界面。',
  },
  {
    name: '怀柔区',
    en: 'HUAIROU',
    areaKm2: 2125.0,
    highlights: ['慕田峪长城', '雁栖湖'],
    description: '北京北部山水会都，慕田峪长城、雁栖湖与国际会都构成生态与外交空间。',
  },
  {
    name: '平谷区',
    en: 'PINGGU',
    areaKm2: 949.52,
    highlights: ['金海湖', '京东大峡谷'],
    description: '北京东部生态休闲区，金海湖、峡谷与山地村落构成京东山水画廊。',
  },
  {
    name: '密云区',
    en: 'MIYUN',
    areaKm2: 2229.52,
    highlights: ['密云水库', '古北水镇'],
    description: '北京东北部水源涵养与长城文化区，密云水库、司马台长城与古北水镇构成生态门户。',
  },
  {
    name: '延庆区',
    en: 'YANQING',
    areaKm2: 1997.55,
    highlights: ['八达岭长城', '世园公园', '海坨山'],
    description: '北京西北部生态与冬奥区，八达岭长城、世园公园与海坨山构成山水长城景观。',
  },
];

export const DEFAULT_DISTRICT = '朝阳区';

export function getDistrict(name: string | null): DistrictInfo | null {
  if (!name) return null;
  return DISTRICTS.find((district) => district.name === name) ?? null;
}
