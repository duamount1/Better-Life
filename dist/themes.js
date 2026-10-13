// Every chapter has its own palette and emblem, grouped into six collectible series.
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const emblems = {
  shield: svg('<path d="M24 5 38 11v12c0 9-6 15-14 20-8-5-14-11-14-20V11Z"/><path d="m17 24 5 5 10-12"/><path d="M24 9v5M14 13l4 2M34 13l-4 2"/>'),
  pulse: svg('<path d="M24 39 9 25C-3 12 17 1 24 14 31 1 51 12 39 25Z"/><path d="M8 24h10l4-9 5 17 4-8h10"/>'),
  energy: svg('<path d="M29 4 13 26h11l-5 18 17-24H25Z"/><path d="M8 11 4 8M40 37l4 3M7 37l-3 3M41 11l3-3"/>'),
  hourglass: svg('<path d="M12 6h24M12 42h24M15 6v7c0 5 4 8 9 11-5 3-9 6-9 11v7M33 6v7c0 5-4 8-9 11 5 3 9 6 9 11v7"/><path d="m18 12 6 6 6-6M19 37l5-7 5 7"/>'),
  coin: svg('<circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="12"/><path d="M27 16h-4a4 4 0 0 0 0 8h2a4 4 0 0 1 0 8h-5M24 13v22M24 3v2M24 43v2M3 24h2M43 24h2"/>'),
  boundary: svg('<path d="m24 5 19 19-19 19L5 24Z"/><circle cx="24" cy="24" r="10"/><path d="m17 31 14-14M15 6l-9 9M33 42l9-9"/>'),
  wallet: svg('<path d="M11 14 34 8v7M8 15h30v25H8Z"/><path d="M28 22h13v11H28Z"/><circle cx="33" cy="27.5" r="1"/><path d="M12 19h12M12 36h9"/>'),
  gate: svg('<path d="M7 41h34M12 41V15l12-8 12 8v26M18 41V25a6 6 0 0 1 12 0v16M8 15h32M24 3v4"/><path d="M15 18h3M30 18h3M24 28v6"/>'),
  balance: svg('<path d="M24 8v32M15 40h18M9 15h30M24 5l3 3-3 3-3-3Z"/><path d="m10 15-7 13h14ZM38 15l-7 13h14ZM3 28c0 6 14 6 14 0M31 28c0 6 14 6 14 0"/>'),
  rings: svg('<circle cx="17" cy="27" r="11"/><circle cx="31" cy="27" r="11"/><path d="m24 4 4 6-4 5-4-5ZM11 7l-3-3M37 7l3-3"/>'),
  circuit: svg('<rect x="13" y="13" width="22" height="22" rx="3"/><path d="M20 13V6M28 13V6M20 35v7M28 35v7M13 20H6M13 28H6M35 20h7M35 28h7M18 18h12v12H18Z"/><path d="m21 24 2 2 4-5"/>'),
  shop: svg('<path d="M8 21h32v21H8ZM5 13l4-7h30l4 7v4c0 5-7 5-7 0 0 5-8 5-8 0 0 5-8 5-8 0 0 5-7 5-7 0 0 5-8 5-8 0Z"/><path d="M16 42V29h10v13M31 28h5v6"/>'),
  emergency: svg('<path d="M18 6h12v12h12v12H30v12H18V30H6V18h12Z"/><path d="M24 2v1M24 45v1M2 24h1M45 24h1"/>'),
  lock: svg('<rect x="11" y="20" width="26" height="22" rx="4"/><path d="M16 20v-8a8 8 0 0 1 16 0v8"/><circle cx="24" cy="29" r="3"/><path d="M24 32v5M7 11l-3-2M41 11l3-2"/>'),
  house: svg('<path d="M4 22 24 6l20 16M9 18v24h30V18M19 42V29h10v13M14 22h5M29 22h5M33 13V6h6v12"/>'),
  rhythm: svg('<circle cx="24" cy="24" r="17"/><path d="M6 25h9l5-10 6 18 6-10h10M16 9l-2-4M32 39l2 4"/>'),
  hands: svg('<path d="M5 33 17 42h14l12-9-4-5-11 6M19 34l-9-5-5 4M24 26c-9-6-12-9-10-14 2-4 8-4 10 1 2-5 8-5 10-1 2 5-1 8-10 14Z"/><path d="M17 42V32M31 42V32"/>'),
  sprout: svg('<path d="M24 42V20M24 26C10 25 6 17 8 8c12 1 17 8 16 18ZM24 32c14-1 18-9 16-18-12 1-17 8-16 18Z"/><path d="m14 15 10 11M34 21 24 32M12 42h24"/>'),
  badge: svg('<rect x="8" y="10" width="32" height="31" rx="3"/><path d="M18 10V6h12v4M17 23h14M17 29h10M17 35h5"/><circle cx="24" cy="16" r="1"/>'),
  cradle: svg('<path d="M8 26h32M11 26c0-11 5-17 13-17v17M11 26c0 10 26 10 26 0M15 32l-4 9M33 32l4 9M8 41c9 5 23 5 32 0"/><path d="M31 5v6M28 8h6"/>'),
  compass: svg('<circle cx="24" cy="24" r="17"/><path d="m31 17-4 10-10 4 4-10ZM24 2v3M24 43v3M2 24h3M43 24h3"/><circle cx="24" cy="24" r="1"/>'),
  moon: svg('<path d="M34 9a17 17 0 1 0 5 29A20 20 0 0 1 34 9Z"/><path d="M39 9v8M35 13h8M27 3v4M25 5h4M41 24v4M39 26h4"/>'),
  ladder: svg('<path d="M13 42V11M35 42V11M13 35h22M13 27h22M13 19h22M13 11h22M24 3v5M20 6l4-3 4 3"/>'),
  medicine: svg('<rect x="6" y="13" width="36" height="29" rx="4"/><path d="M17 13V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v5M20 21h8v5h5v8h-5v5h-8v-5h-5v-8h5Z"/>'),
  candle: svg('<path d="M18 22h12v20H18ZM15 42h18M24 22v-5M24 4c7 7 8 12 0 13-8-1-7-6 0-13Z"/><path d="M9 10l4 3M39 10l-4 3M7 24h5M41 24h-5"/>'),
  network: svg('<rect x="15" y="5" width="18" height="11" rx="2"/><rect x="3" y="32" width="16" height="11" rx="2"/><rect x="29" y="32" width="16" height="11" rx="2"/><path d="M24 16v8H11v8M24 24h13v8M20 10h8M8 37h6M34 37h6"/>'),
  bloom: svg('<path d="M24 41V28M24 34l-10-6M24 37l10-6M24 9c-8-10-16 5-6 9-11 0-11 15 0 15 3 5 9 5 12 0 11 0 11-15 0-15 10-4 2-19-6-9Z"/><circle cx="24" cy="22" r="4"/>'),
  mirror: svg('<ellipse cx="24" cy="19" rx="12" ry="15"/><path d="M24 34v9M17 44h14M18 13l8-4M17 20l12-6M35 35l5 5M40 33v5M38 35h4"/>'),
  repair: svg('<path d="M33 7a18 18 0 1 0 9 17"/><path d="m29 5 6 7-8 3M25 10l-7 11 9 6-8 13"/><path d="M36 20v9M32 24h8"/>'),
  book: svg('<path d="M24 12c-7-6-14-6-20-4v30c6-2 13-2 20 4 7-6 14-6 20-4V8c-6-2-13-2-20 4ZM24 12v30M9 15c3-1 6 0 10 2M9 22c3-1 6 0 10 2M29 17c4-2 7-3 10-2M29 24c4-2 7-3 10-2"/>'),
  paths: svg('<path d="M24 44V23M24 23 10 9M24 23 38 9M6 15V5h10M32 5h10v10M24 23V4M19 9l5-5 5 5"/><path d="M17 36h14M17 42h14"/>'),
  globe: svg('<circle cx="24" cy="24" r="18"/><ellipse cx="24" cy="24" rx="8" ry="18"/><path d="M6 24h36M10 13h28M10 35h28M1 5l6-3M41 46l6-3"/>'),
  bridge: svg('<path d="M4 31h40M9 31V14M39 31V14M9 15c10 16 20 16 30 0M17 25v6M24 28v3M31 25v6M9 36v7M39 36v7M4 43h10M34 43h10"/>'),
  capsule: svg('<path d="M12 36a9 9 0 0 1 0-13l11-11a9 9 0 0 1 13 13L25 36a9 9 0 0 1-13 0ZM17 18l13 13"/><path d="m27 13 7 7M9 8V3M6 6h6M39 40v5M36 43h6"/>'),
  collection: svg('<rect x="9" y="10" width="25" height="32" rx="3"/><path d="M15 10V6h25v32h-6M16 17h11M16 23h11M16 29h7"/><path d="m28 34 2 3 3-5"/>'),
};

// id, name, color, light paper, dark ink, series, motif
const definitions = [
  [1, '不要早死', '#3e7156', '#e9efdb', '#234639', '守护之章', 'shield'],
  [2, '不要慢慢死', '#638873', '#edf1df', '#324f40', '守护之章', 'pulse'],
  [3, '不要浪费精力', '#b29249', '#f4efd7', '#665426', '秩序之章', 'energy'],
  [4, '不要浪费时间', '#a18455', '#f0eadb', '#615135', '秩序之章', 'hourglass'],
  [5, '不要浪费钱', '#a0873f', '#f3edd1', '#62552d', '秩序之章', 'coin'],
  [6, '反面清单', '#997c66', '#efe7dc', '#584534', '秩序之章', 'boundary'],
  [7, '没钱的时候怎么活', '#aa8652', '#f3ead8', '#6a4e2d', '秩序之章', 'wallet'],
  [8, '别把自己搭进去：法律与财产安全', '#607888', '#e7edef', '#354d5d', '契约之章', 'gate'],
  [9, '普通人容易踩的法律红线', '#78798f', '#e9e9f1', '#44455a', '契约之章', 'balance'],
  [10, '恋爱和结婚划不划算', '#aa7371', '#f2e5df', '#6f4244', '同行之章', 'rings'],
  [11, '程序员和技术人容易踩的红线', '#617d82', '#e1edea', '#354d53', '契约之章', 'circuit'],
  [12, '创业与做生意：别把家底赔进去', '#9c7952', '#f0e6d7', '#654a2f', '经营之章', 'shop'],
  [13, '紧急情况：先做什么', '#a65f49', '#f5e5d5', '#6d382d', '守护之章', 'emergency'],
  [14, '账号与信息安全', '#4f7b7a', '#e2eeea', '#2c5053', '契约之章', 'lock'],
  [15, '租房与买房', '#899467', '#ecedda', '#4c5b3a', '秩序之章', 'house'],
  [16, '得了慢性病之后怎么活', '#8a869c', '#eeeaf1', '#514b64', '守护之章', 'rhythm'],
  [17, '家里有老人', '#ad8669', '#f3e9db', '#6b4f35', '同行之章', 'hands'],
  [18, '养孩子划不划算', '#7e956d', '#ecf0dd', '#4b603d', '同行之章', 'sprout'],
  [19, '在职、离职和工伤', '#778475', '#e6ebdf', '#435342', '经营之章', 'badge'],
  [20, '刚出生的孩子怎么带', '#a99673', '#f5edde', '#695934', '同行之章', 'cradle'],
  [21, '出国、旅行与境外安全', '#4e8291', '#e3eef0', '#2d5264', '远行之章', 'compass'],
  [22, '怎么放松：娱乐场所和减压', '#81917b', '#e9efdf', '#4e6145', '远行之章', 'moon'],
  [23, '学什么技能划算', '#90865b', '#f1ecd9', '#58502e', '经营之章', 'ladder'],
  [24, '看病：怎么少花钱少走弯路', '#658d80', '#e5efe5', '#355a4c', '守护之章', 'medicine'],
  [25, '人走了以后要办什么', '#93917b', '#eeecdf', '#595747', '同行之章', 'candle'],
  [26, '做一个网站或平台：资质、备案和服务器', '#668297', '#e6edf2', '#3a506a', '契约之章', 'network'],
  [27, '怀孕和生产：从发现怀孕到出院办证', '#aa8289', '#f4e6e9', '#6d4c57', '同行之章', 'bloom'],
  [28, '别为了外形把身体搞坏', '#8d8491', '#efe7ed', '#56475a', '守护之章', 'mirror'],
  [29, '遭遇重大打击之后', '#8c9266', '#efefda', '#525b35', '远行之章', 'repair'],
  [30, '上学以后的孩子', '#71948b', '#e7efe4', '#405e52', '同行之章', 'book'],
  [31, '十八岁之后有哪几条路', '#a68a5d', '#f1e9d3', '#655532', '经营之章', 'paths'],
  [32, '出国留学：身份、打工、保险和回国认证', '#6e86a0', '#e8edf4', '#405674', '远行之章', 'globe'],
  [33, '残疾之后怎么活', '#8a8260', '#eee9d8', '#554f32', '守护之章', 'bridge'],
  [34, '家里的常备药别吃出事', '#7b9670', '#eaf0dc', '#48643f', '守护之章', 'capsule'],
];

export const THEMES = Object.freeze(definitions.map(([section, name, color, light, dark, series, motif]) => Object.freeze({
  id: `section-${String(section).padStart(2, '0')}`, section, name, color, light, dark,
  symbol: emblems[motif], series, motif,
})));

const allTheme = Object.freeze({ id: 'all', section: 0, name: '全部主题', color: '#557654', light: '#e9eedc', dark: '#2c4535', symbol: emblems.collection, series: '生活全图鉴', motif: 'collection' });
const themeMap = new Map(THEMES.map(theme => [theme.id, theme]));

export function themeFor(idOrSection) {
  const value = typeof idOrSection === 'object' && idOrSection !== null
    ? idOrSection.categoryId ?? idOrSection.section ?? idOrSection.id
    : idOrSection;
  if (value === 'all' || value == null) return allTheme;
  const chapter = String(value).replace(/^section-/, '');
  const id = /^\d+$/.test(chapter) ? `section-${chapter.padStart(2, '0')}` : String(value);
  return themeMap.get(id) ?? allTheme;
}

export function applyTheme(element, theme) {
  if (!element) return;
  const resolved = typeof theme === 'object' && theme?.color ? theme : themeFor(theme);
  element.style.setProperty('--theme-color', resolved.color);
  element.style.setProperty('--theme-light', resolved.light);
  element.style.setProperty('--theme-dark', resolved.dark);
  element.dataset.theme = resolved.id;
  element.dataset.series = resolved.series;
  element.dataset.motif = resolved.motif;
}
