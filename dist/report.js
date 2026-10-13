const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_NAME = '生活探索者';

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function count(value) {
  return Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
}

function normalizeSnapshot(value = {}) {
  const total = count(value.total);
  return {
    ...value,
    total,
    viewed: Math.min(total, count(value.viewed)),
    done: Math.min(total, count(value.done)),
    declined: Math.min(total, count(value.declined)),
    pending: Math.min(total, count(value.pending)),
    index: Math.min(100, count(value.index)),
    goldCount: count(value.goldCount),
    name: typeof value.name === 'string' ? value.name.slice(0, 24) : '',
    topics: Array.isArray(value.topics) ? value.topics.map(topic => ({
      ...topic,
      total: count(topic.total),
      viewed: count(topic.viewed),
      done: count(topic.done),
      declined: count(topic.declined),
      pending: count(topic.pending),
      gold: !!topic.gold,
    })) : [],
  };
}

function orderedTopics(topics) {
  return [...topics].sort((a, b) => {
    const aProgress = a.total ? (a.done + a.declined) / a.total : 0;
    const bProgress = b.total ? (b.done + b.declined) / b.total : 0;
    return bProgress - aProgress || b.done - a.done;
  });
}

function percentage(part, total) {
  return total ? Math.min(100, Math.max(0, part / total * 100)) : 0;
}

function getTheme(themeFor, id) {
  const value = typeof themeFor === 'function' ? themeFor(id) : null;
  return { color: '#3c6450', light: '#e6eee5', symbol: '✦', ...(value || {}) };
}

// SVG emblems come only from the caller's locally authored themes.js constants.
// Card content and saved user input never enter this markup path.
function isThemeSVG(symbol) {
  return typeof symbol === 'string' && symbol.trim().startsWith('<svg ') && symbol.trim().endsWith('</svg>');
}

function xml(value) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]));
}

function color(value, fallback) {
  return /^#[\da-f]{3,8}$/i.test(String(value)) ? value : fallback;
}

function wrap(value, length) {
  const characters = Array.from(String(value));
  const lines = [];
  for (let start = 0; start < characters.length; start += length) lines.push(characters.slice(start, start + length).join(''));
  return lines.length ? lines : [''];
}

function dateLabel() {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function exportSVG(snapshot, name, context, themeFor) {
  const topics = orderedTopics(snapshot.topics);
  const rowHeight = 122;
  const rows = Math.ceil(topics.length / 2);
  const height = 628 + rows * rowHeight;
  const parts = [
    `<svg xmlns="${SVG_NS}" width="1200" height="${height}" viewBox="0 0 1200 ${height}" role="img" aria-labelledby="title desc">`,
    `<title id="title">${xml(name)}的好好生活报告</title>`,
    `<desc id="desc">好好生活指数 ${snapshot.index}，已看 ${snapshot.viewed} 张，做到 ${snapshot.done} 张，共 ${snapshot.total} 张。各主题进展见下方。</desc>`,
    `<rect width="1200" height="${height}" fill="#f7f3e8"/>`,
    `<rect x="28" y="28" width="1144" height="${height - 56}" rx="22" fill="none" stroke="#c9c1a6"/>`,
    '<style>text{font-family:"PingFang SC","Microsoft YaHei",sans-serif;fill:#223e32}.muted{fill:#6d796d}.small{font-size:18px}.gold{fill:#9b762a}</style>',
    '<text x="70" y="104" font-size="42" font-weight="700">好好生活报告</text>',
    `<text x="70" y="146" font-size="22" class="gold">${xml(name)}的生活探索记录</text>`,
    `<text x="70" y="179" class="muted small">${xml(context.reason)} · ${xml(context.scopeName)} · ${xml(dateLabel())}</text>`,
    '<circle cx="221" cy="311" r="109" fill="#fffdf6" stroke="#e5dfcb" stroke-width="16"/>',
    `<circle cx="221" cy="311" r="109" fill="none" stroke="#a68540" stroke-width="16" stroke-linecap="round" stroke-dasharray="${2 * Math.PI * 109 * snapshot.index / 100} ${2 * Math.PI * 109}" transform="rotate(-90 221 311)"/>`,
    `<text x="221" y="324" text-anchor="middle" font-size="78" font-weight="700">${snapshot.index}</text>`,
    '<text x="221" y="366" text-anchor="middle" font-size="21" class="gold">好好生活指数</text>',
    `<text x="392" y="273" font-size="28" font-weight="600">一共看了 ${snapshot.viewed} 张好好生活卡片</text>`,
    `<text x="392" y="319" font-size="22" class="muted">其中已经做到了 ${snapshot.done} 张。</text>`,
    `<text x="392" y="361" font-size="22" class="muted">${snapshot.declined} 张暂不采用 · ${snapshot.goldCount} 枚主题金标</text>`,
    '<line x1="70" y1="470" x2="1130" y2="470" stroke="#d8d0b7"/>',
    '<text x="70" y="527" font-size="29" font-weight="600">各主题探索进展</text>',
    '<text x="70" y="564" class="muted small">绿色 = 做到了 · 灰色 = 暂不采用</text>',
  ];
  topics.forEach((topic, position) => {
    const x = 70 + position % 2 * 550;
    const y = 600 + Math.floor(position / 2) * rowHeight;
    const theme = getTheme(themeFor, topic.id);
    const titleLines = wrap(topic.name || theme.name || '未命名主题', 20);
    const doneWidth = percentage(topic.done, topic.total) * 4.55;
    const declinedWidth = Math.min(455 - doneWidth, percentage(topic.declined, topic.total) * 4.55);
    parts.push(`<rect x="${x}" y="${y}" width="510" height="110" rx="12" fill="#fffdf6" stroke="${topic.gold ? '#bf9b4c' : '#e1dbc9'}"/>`);
    if (isThemeSVG(theme.symbol)) {
      parts.push(theme.symbol.trim().replace('<svg ', `<svg x="${x + 16}" y="${y + 12}" width="26" height="26" color="${color(theme.color, '#3c6450')}" `));
    } else {
      parts.push(`<path d="m${x + 29} ${y + 13} 11 11-11 11-11-11Z" fill="none" stroke="${color(theme.color, '#3c6450')}" stroke-width="1.5"/>`);
    }
    parts.push(`<text x="${x + 51}" y="${y + 33}" font-size="20" font-weight="600">${xml(titleLines[0])}</text>`);
    if (titleLines.length > 1) parts.push(`<text x="${x + 51}" y="${y + 57}" font-size="18" font-weight="600">${xml(titleLines.slice(1).join(''))}</text>`);
    if (topic.gold) parts.push(`<text x="${x + 477}" y="${y + 33}" text-anchor="middle" font-size="22" class="gold">★</text>`);
    const captionY = y + (titleLines.length > 1 ? 79 : 63);
    parts.push(`<text x="${x + 18}" y="${captionY}" font-size="16" class="muted">已看 ${topic.viewed}/${topic.total} · 做到 ${topic.done} · 暂不采用 ${topic.declined}</text>`);
    parts.push(`<rect x="${x + 18}" y="${y + 91}" width="455" height="5" rx="2.5" fill="#e7e2d2"/>`);
    if (doneWidth > 0) parts.push(`<rect x="${x + 18}" y="${y + 91}" width="${doneWidth}" height="5" rx="2.5" fill="${color(theme.color, '#3c6450')}"/>`);
    if (declinedWidth > 0) parts.push(`<rect x="${x + 18 + doneWidth}" y="${y + 91}" width="${declinedWidth}" height="5" fill="#b7b5a7"/>`);
  });
  parts.push('</svg>');
  return parts.join('\n');
}

/** Creates a self-contained report dialog; progress stays owned by the caller. */
export function createReportView({ dialog, getSnapshot, setName = () => {}, themeFor, onClose = () => {} }) {
  if (!dialog || typeof getSnapshot !== 'function') throw new TypeError('报告需要 dialog 和 getSnapshot。');
  let context = { reason: '当前进展', scopeName: '全部主题' };
  let opened = false;
  let previousActiveElement = null;

  dialog.classList.add('report-dialog');
  dialog.setAttribute('aria-labelledby', 'report-title');
  dialog.setAttribute('aria-describedby', 'report-context');
  dialog.replaceChildren();

  const sheet = node('div', 'report-sheet');
  const header = node('header', 'report-header');
  const masthead = node('div', '');
  const title = node('h2', 'report-title', '你的好好生活报告');
  title.id = 'report-title';
  masthead.append(title);
  const closeButton = node('button', 'report-close', '×');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', '关闭报告');
  header.append(masthead, closeButton);
  sheet.append(header);

  const reportContext = node('p', 'report-context');
  reportContext.id = 'report-context';
  sheet.append(reportContext);

  const identity = node('div', 'report-identity');
  const nameLabel = node('label', 'report-name-label', '给这份报告留个名字');
  const nameInput = node('input', 'report-name-input');
  nameInput.id = 'report-name';
  nameInput.type = 'text';
  nameInput.maxLength = 24;
  nameInput.placeholder = DEFAULT_NAME;
  nameInput.autocomplete = 'nickname';
  nameLabel.htmlFor = nameInput.id;
  identity.append(nameLabel, nameInput);
  sheet.append(identity);

  const overview = node('section', 'report-overview');
  overview.setAttribute('aria-label', '好好生活指数与总体进展');
  const ring = node('div', 'report-index-ring');
  const ringCenter = node('div', 'report-index-center');
  const indexValue = node('strong', 'report-index-value', '0');
  ringCenter.append(indexValue, node('span', 'report-index-label', '好好生活指数'), node('span', 'report-index-outof', '/ 100'));
  ring.append(ringCenter);
  const introduction = node('div', 'report-introduction');
  const playerName = node('p', 'report-player-name');
  const headline = node('h3', 'report-headline');
  const description = node('p', 'report-description');
  introduction.append(playerName, headline, description);
  overview.append(ring, introduction);
  sheet.append(overview);

  const statGrid = node('div', 'report-stats');
  const statValues = {};
  for (const [key, label] of [
    ['viewed', '已经看过'],
    ['done', '已经做到'],
    ['declined', '暂不采用'],
    ['goldCount', '主题金标'],
  ]) {
    const stat = node('div', `report-stat report-stat-${key}`);
    statValues[key] = node('strong', 'report-stat-value', '0');
    stat.append(node('span', 'report-stat-label', label), statValues[key]);
    statGrid.append(stat);
  }
  sheet.append(statGrid);

  const topicsSection = node('section', 'report-topics');
  const topicsHeader = node('div', 'report-topics-heading');
  topicsHeader.append(node('h3', '', '各主题探索进展'));
  const goldSummary = node('span', 'report-gold-summary');
  topicsHeader.append(goldSummary);
  const legend = node('div', 'report-legend');
  legend.append(node('span', 'report-legend-done', '做到了'), node('span', 'report-legend-declined', '暂不采用'), node('span', 'report-legend-pending', '待处理'));
  const topicList = node('ol', 'report-topic-list');
  topicList.setAttribute('aria-label', '各主题进展，按已标记比例排序');
  topicsSection.append(topicsHeader, legend, topicList);
  sheet.append(topicsSection);

  const footer = node('footer', 'report-footer');
  const actions = node('div', 'report-actions');
  const downloadButton = node('button', 'report-download', '↓ 下载报告');
  downloadButton.type = 'button';
  const continueButton = node('button', 'report-continue', '继续探索 →');
  continueButton.type = 'button';
  const downloadStatus = node('span', 'report-download-status');
  downloadStatus.setAttribute('role', 'status');
  actions.append(downloadButton, continueButton);
  footer.append(actions, downloadStatus);
  sheet.append(footer);
  dialog.append(sheet);

  function updateName() {
    playerName.textContent = `${nameInput.value.trim() || DEFAULT_NAME}的生活探索记录`;
  }

  function refresh() {
    const snapshot = normalizeSnapshot(getSnapshot());
    if (document.activeElement !== nameInput) nameInput.value = snapshot.name;
    updateName();
    reportContext.textContent = `${context.reason} · ${context.scopeName} · ${dateLabel()}`;
    indexValue.textContent = snapshot.index;
    ring.style.setProperty('--report-angle', `${snapshot.index * 3.6}deg`);
    ring.setAttribute('aria-label', `好好生活指数 ${snapshot.index}，满分 100`);
    headline.textContent = `一共看了 ${snapshot.viewed} 张好好生活卡片`;
    description.textContent = `其中已经做到了 ${snapshot.done} 张。`;
    for (const [key, value] of Object.entries(statValues)) value.textContent = snapshot[key];
    goldSummary.textContent = `✦ ${snapshot.goldCount} / ${snapshot.topics.length} 枚金标`;
    const fragment = document.createDocumentFragment();
    for (const topic of orderedTopics(snapshot.topics)) {
      const theme = getTheme(themeFor, topic.id);
      const item = node('li', `report-topic${topic.gold ? ' is-gold' : ''}`);
      item.style.setProperty('--report-topic-color', theme.color);
      item.style.setProperty('--report-topic-light', theme.light);
      const symbol = node('span', 'report-topic-symbol');
      if (isThemeSVG(theme.symbol)) symbol.innerHTML = theme.symbol;
      else symbol.textContent = theme.symbol || '✦';
      symbol.setAttribute('aria-hidden', 'true');
      const content = node('div', 'report-topic-content');
      const itemHeading = node('div', 'report-topic-heading');
      const topicName = node('h4', 'report-topic-name', topic.name || theme.name || '未命名主题');
      const badge = node('span', `report-topic-badge${topic.gold ? ' earned' : ''}`, topic.gold ? '★ 金标' : `${topic.done + topic.declined} / ${topic.total}`);
      badge.setAttribute('aria-label', topic.gold ? '金标，主题全部卡片已标记' : `已标记 ${topic.done + topic.declined} 张，共 ${topic.total} 张`);
      itemHeading.append(topicName, badge);
      const caption = node('p', 'report-topic-caption', `已看 ${topic.viewed}/${topic.total} · 做到 ${topic.done} · 暂不采用 ${topic.declined}`);
      const track = node('div', 'report-topic-track');
      track.setAttribute('aria-hidden', 'true');
      const done = node('span', 'report-topic-done');
      done.style.width = `${percentage(topic.done, topic.total)}%`;
      const declined = node('span', 'report-topic-declined');
      declined.style.width = `${Math.min(100 - percentage(topic.done, topic.total), percentage(topic.declined, topic.total))}%`;
      track.append(done, declined);
      content.append(itemHeading, caption, track);
      item.append(symbol, content);
      fragment.append(item);
    }
    topicList.replaceChildren(fragment);
    return snapshot;
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  function open(options = {}) {
    context = { reason: options.reason || '当前进展', scopeName: options.scopeName || '全部主题' };
    downloadStatus.textContent = '';
    refresh();
    if (!dialog.open) {
      previousActiveElement = document.activeElement;
      opened = true;
      dialog.showModal();
      dialog.scrollTop = 0;
      nameInput.focus({ preventScroll: true });
    }
  }

  nameInput.addEventListener('input', () => {
    setName(nameInput.value.trim());
    updateName();
  });
  closeButton.addEventListener('click', close);
  continueButton.addEventListener('click', close);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
  });
  dialog.addEventListener('close', () => {
    if (!opened) return;
    opened = false;
    if (previousActiveElement?.isConnected && typeof previousActiveElement.focus === 'function') previousActiveElement.focus({ preventScroll: true });
    onClose();
  });
  downloadButton.addEventListener('click', () => {
    const snapshot = normalizeSnapshot(getSnapshot());
    const name = nameInput.value.trim() || DEFAULT_NAME;
    const svg = exportSVG(snapshot, name, context, themeFor);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const link = node('a');
    link.href = url;
    link.download = `好好生活报告-${name.replace(/[\\/:*?"<>|\u0000-\u001F]/g, '') || DEFAULT_NAME}.svg`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    downloadStatus.textContent = '报告已下载';
  });

  return { open, refresh, close };
}
