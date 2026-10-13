import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(ROOT, 'content/source-manifest.json'), 'utf8'));
const sourceRoot = resolve(ROOT, 'content/source');
const read = file => readFileSync(resolve(sourceRoot, file), 'utf8').replace(/\r\n/g, '\n');
const FIELD_NAMES = { 成本: 'cost', 说人话: 'answer', 收益: 'benefit', 证据等级: 'evidence', 来源: 'sourceReferences', 备注: 'note' };
const pad = (value, digits = 2) => String(value).padStart(digits, '0');
const plain = value => String(value ?? '').replace(/\*\*/g, '').replace(/\\([*_])/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
const githubUrl = (file, start, end) => `${manifest.repository}/blob/${manifest.upstreamCommit}/${file.split('/').map(encodeURIComponent).join('/')}${start ? `#L${start}${end && end !== start ? `-L${end}` : ''}` : ''}`;

// Bibliographic statements are kept intact in sourceReferences. The links below
// additionally make the primary sources accessible from the card details.
function sourceLinks(references) {
  const result = [];
  const parts = [];
  let chunk = '', depth = 0;
  for (const character of references) {
    if ('「『（'.includes(character)) depth += 1;
    else if ('」』）'.includes(character)) depth = Math.max(0, depth - 1);
    if ((character === '；' || character === ';') && depth === 0) {
      parts.push(chunk);
      chunk = '';
    } else chunk += character;
  }
  parts.push(chunk);
  for (const part of parts) {
    const urls = [...part.matchAll(/<(https?:\/\/[^<>\s]+)>/g)].map(match => match[1]);
    const markdownUrls = [...part.matchAll(/\[[^\]]*\]\((https?:\/\/[^\s]+?)\)(?=\s|[；;。]|$)/g)].map(match => match[1]);
    for (const url of [...new Set([...urls, ...markdownUrls])]) {
      const title = plain(part.replace(/<https?:\/\/[^<>\s]+>/g, '')).replace(/^[\s;；]+|[\s;；]+$/g, '') || url;
      result.push({ title, url });
    }
  }
  return result;
}

function chapterCards(file) {
  const lines = read(file).split('\n');
  const heading = lines.find(line => /^# \d+\. /.test(line))?.match(/^# (\d+)\. (.+)$/);
  if (!heading) throw new Error(`Cannot parse chapter heading: ${file}`);
  const section = Number(heading[1]);
  const category = plain(heading[2].trim());
  const cards = [];
  let current;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const entry = line.match(/^### (\d+)\. (.+)$/);
    if (entry) {
      if (current) current.sourceLineEnd = lineIndex;
      const item = Number(entry[1]);
      current = {
        id: `book-${pad(section)}-${pad(item, 3)}`,
        category,
        categoryId: `section-${pad(section)}`,
        title: plain(entry[2].trim()),
        question: plain(entry[2].trim()),
        answer: '',
        note: '',
        cost: '',
        benefit: '',
        evidence: '',
        sourceReferences: '',
        sources: [],
        sourceUrl: '',
        readableUrl: `https://eternity4719.github.io/HowToLiveBetter/#e-${section}-${item}`,
        sourceLabel: `第 ${section} 节 · 第 ${item} 条`,
        sourceFile: file,
        sourceLineStart: lineIndex + 1,
        sourceLineEnd: lines.length,
        section,
        item,
        tags: [],
        labels: {},
        disputed: false,
        pendingVerification: false,
      };
      cards.push(current);
      continue;
    }
    if (!current) continue;
    const label = line.match(/^<!--\s*成本标签:\s*(.*?)\s*-->/);
    if (label) {
      for (const token of label[1].split(/\s+/)) {
        const [key, ...values] = token.split('=');
        current.labels[key] = values.join('=');
      }
      current.tags = current.labels.人群?.split(',').map(tag => tag.trim()).filter(Boolean) ?? [];
      continue;
    }
    const field = line.match(/^- (成本|说人话|收益|证据等级|来源|备注)：(.*)$/);
    if (field) {
      const target = FIELD_NAMES[field[1]];
      if (current[target]) throw new Error(`Duplicate field ${field[1]} at ${file}:${lineIndex + 1}`);
      current[target] = target === 'sourceReferences' ? field[2].trim() : plain(field[2].trim());
    }
  }
  for (const card of cards) {
    for (const key of ['title', 'answer', 'cost', 'benefit', 'evidence', 'sourceReferences']) {
      if (!card[key]) throw new Error(`Missing ${key}: ${card.id}`);
    }
    card.sourceUrl = githubUrl(file, card.sourceLineStart, card.sourceLineEnd);
    card.sources = sourceLinks(card.sourceReferences);
    card.disputed = /^争议/.test(card.note) || /（争议）/.test(card.evidence);
    card.pendingVerification = /TODO|待核实/.test(`${card.note} ${card.benefit} ${card.sourceReferences}`);
    card.evidence = card.evidence.match(/^[ABC]/)?.[0] ?? card.evidence;
  }
  return cards;
}

const cards = manifest.bookFiles.flatMap(chapterCards).sort((a, b) => a.section - b.section || a.item - b.item);
const ids = new Set(cards.map(card => card.id));
if (ids.size !== cards.length) throw new Error('Duplicate card identifiers.');
const readme = read('README.md');
const expected = Number(readme.match(/(\d+) 条建议/)?.[1]);
if (expected && cards.length !== expected) throw new Error(`Expected ${expected} cards from the upstream README; parsed ${cards.length}.`);
for (const card of cards) {
  if (!['A', 'B', 'C'].includes(card.evidence)) throw new Error(`Unexpected evidence grade: ${card.id}`);
  for (const source of card.sources) {
    const url = new URL(source.url);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Invalid primary-source URL: ${card.id}`);
  }
}

const categories = [...new Set(cards.map(card => card.categoryId))].map(id => {
  const chapter = cards.filter(card => card.categoryId === id);
  return { id, name: chapter[0].category, section: chapter[0].section, count: chapter.length, sourceUrl: githubUrl(chapter[0].sourceFile) };
});
const guides = manifest.guideFiles.map(file => {
  const text = read(file);
  const relatedCardIds = [...new Set([...text.matchAll(/第\s*(\d+)\s*节第\s*(\d+)\s*条/g)].map(match => `book-${pad(match[1])}-${pad(match[2], 3)}`))].filter(id => ids.has(id));
  return {
    title: plain(text.match(/^# (.+)$/m)?.[1] ?? file),
    file,
    sourceUrl: githubUrl(file),
    relatedCardIds,
    coverage: '补充解释或按情境重排正文条目；作为延伸阅读，避免把同一条建议重复抽入牌组。',
  };
});
const meta = {
  schemaVersion: 1,
  datasetVersion: manifest.upstreamCommit,
  title: manifest.title,
  count: cards.length,
  totalCards: cards.length,
  categoryCount: categories.length,
  categories,
  primarySourceLinkCount: cards.reduce((count, card) => count + card.sources.length, 0),
  upstreamSourceLinkMentionCount: cards.reduce((count, card) => count + (card.sourceReferences.match(/https?:\/\//g) ?? []).length, 0),
  evidenceCounts: Object.fromEntries(['A', 'B', 'C'].map(grade => [grade, cards.filter(card => card.evidence === grade).length])),
  disputedCount: cards.filter(card => card.disputed).length,
  pendingVerificationCount: cards.filter(card => card.pendingVerification).length,
  repository: manifest.repository,
  sourceUrl: manifest.repository,
  upstreamCommit: manifest.upstreamCommit,
  upstreamCommittedAt: manifest.upstreamCommittedAt,
  synchronizedOn: manifest.synchronizedOn,
  sourceDate: manifest.synchronizedOn,
  attribution: '卡片内容来自 eternity4719 的《高性价比人生指南》（HowToLiveBetter），依据 CC BY 4.0 许可使用。',
  modifications: '将原书每条建议转换为一张卡片；正面保留建议标题，背面使用「说人话」原文，保留成本、收益、证据等级、备注和来源；清除 Markdown 格式标记。未另行补写医学、法律或理财结论。',
  license: { name: 'CC BY 4.0', url: manifest.licenseUrl, author: manifest.author, sourceName: manifest.title, sourceUrl: manifest.repository, textFile: 'LICENSE-CC-BY-4.0' },
  sourceNotice: '书里的内容可能过时，也可能有错。不少政策各地执行不一样。真去办事、看病、打官司时，以当地部门、医生和律师的说法为准。',
  evidenceNotice: '证据等级沿用原书。A 级表示数字或法规出处可查，不代表一定存在因果；百分比的适用人群和条件请结合收益、备注阅读。',
  coverage: '完整覆盖源版本 book/ 中的全部独立建议。README 中的导航、示例与 docs/ 长文不重复生成卡片；docs/核实记录属于原作者的核验记录，可由原文来源继续查看。',
  guides,
};
mkdirSync(resolve(ROOT, 'dist'), { recursive: true });
writeFileSync(resolve(ROOT, 'dist/cards.json'), JSON.stringify(cards, null, 2) + '\n');
writeFileSync(resolve(ROOT, 'dist/source-meta.json'), JSON.stringify(meta, null, 2) + '\n');
writeFileSync(resolve(ROOT, 'dist/LICENSE-CC-BY-4.0'), readFileSync(resolve(ROOT, 'content/LICENSE-CC-BY-4.0')));
writeFileSync(resolve(ROOT, 'dist/CONTENT-LICENSE.txt'), readFileSync(resolve(ROOT, 'content/LICENSE-CC-BY-4.0')));
console.log(`Generated ${cards.length} cards in ${categories.length} categories; ${meta.primarySourceLinkCount} primary-source links.`);
