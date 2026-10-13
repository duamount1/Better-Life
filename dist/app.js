import { DeckEngine } from './deck-engine.js';
import { ProgressStore } from './progress-store.js';
import { themeFor, applyTheme } from './themes.js';
import { createReportView } from './report.js';

const $ = id => document.getElementById(id);
const memory = new Map();
let browserStorage = null;
try {
  browserStorage = localStorage;
  browserStorage.setItem('life-cards:probe', '1');
  browserStorage.removeItem('life-cards:probe');
} catch {
  browserStorage = null;
  $('storage-note').textContent = '浏览器无法保存数据；本次探索会保留到关闭页面。';
}
const persistence = {
  getItem(key) {
    if (memory.has(key)) return memory.get(key);
    try { return browserStorage?.getItem(key) ?? null; } catch { return null; }
  },
  setItem(key, value) {
    memory.set(key, value);
    try { browserStorage?.setItem(key, value); }
    catch { $('storage-note').textContent = '浏览器存储已满，新进度暂时保留在当前页面。'; }
  },
};
let cards = [], byId = new Map(), progress, deck, report, scope = 'all';
let flipped = false, ready = false, favorites = new Set(), toastTimer, autoTimer;
let libraryLimit = 40, resumeAfterReport = false;
const pendingReports = new Map();
const libraryOpenIds = new Set();
const FAVORITES_KEY = 'life-cards:favorites:v1';
const primaryControls = ['next', 'previous', 'favorite', 'flip-button', 'done-check', 'declined-check', 'todo-button', 'report-nav', 'atlas-nav', 'atlas-toggle', 'all-scope', 'library-nav', 'mobile-draw-nav', 'mobile-atlas-nav', 'mobile-library-nav', 'mobile-report-nav'];
primaryControls.forEach(id => $(id).disabled = true);

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`); svg.append(use); svg.setAttribute('aria-hidden', 'true');
  return svg;
}
function emblem(container, theme) {
  // Artwork is authored locally in themes.js; source text is never used as HTML.
  container.innerHTML = theme.symbol;
  container.setAttribute('aria-hidden', 'true');
}
function safeLink(title, url) {
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) return null;
    const a = node('a', '', title); a.href = parsed.href; a.target = '_blank'; a.rel = 'noopener noreferrer';
    return a;
  } catch { return null; }
}
function toast(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.add('visible');
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3200);
}
function currentCard() { return byId.get(deck?.current()); }
function scopeCards() { return scope === 'all' ? cards : cards.filter(c => c.categoryId === scope); }
function scopeInfo(summary = progress.summary()) {
  return scope === 'all' ? { ...summary, id: 'all', name: '全部主题' } : summary.topics.find(t => t.id === scope);
}
function resizeCard() {
  // Keep a portrait silhouette within the height left by the fixed controls.
  $('card-inner').style.removeProperty('height');
  const stage = $('card-stage');
  const availableWidth = Math.max(0, stage.parentElement.clientWidth - 16);
  const height = stage.getBoundingClientRect().height;
  if (!height || !availableWidth) return;
  const minimum = Math.min(availableWidth, matchMedia('(max-width: 900px)').matches ? 216 : 250);
  const width = Math.round(Math.min(availableWidth, Math.max(minimum, height * .68)));
  if (Math.abs(stage.getBoundingClientRect().width - width) > 1) stage.style.width = `${width}px`;
}
function setActivePage(page) {
  for (const [key, ids] of Object.entries({cards:['draw-nav','mobile-draw-nav'],atlas:['atlas-nav','mobile-atlas-nav'],library:['library-nav','mobile-library-nav'],report:['report-nav','mobile-report-nav']})) {
    for (const id of ids) {
      $(id).classList.toggle('active', key === page);
      if (key === page) $(id).setAttribute('aria-current', 'page');
      else $(id).removeAttribute('aria-current');
    }
  }
}
function returnToCards() {
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
  setActivePage('cards');
}

function setFlipped(value, focus = false) {
  flipped = value; $('card-stage').classList.toggle('is-flipped', value);
  $('card-front').inert = value; $('card-back').inert = !value;
  $('flip-button').querySelector('span').textContent = value ? '翻回正面' : '翻开卡牌';
  if (focus) $('flip-button').focus({ preventScroll: true });
  resizeCard();
}
function renderFlags(container, card) {
  container.replaceChildren();
  for (const tag of card.tags || []) container.append(node('span', 'audience-flag', tag));
  if (card.disputed) container.append(node('span', 'status-flag', '原文标记：争议'));
  if (card.pendingVerification) container.append(node('span', 'status-flag', '原文标记：待核实'));
}
function renderFacts(container, card) {
  container.replaceChildren();
  for (const [label, key] of [['成本', 'cost'], ['收益', 'benefit']]) {
    if (!card[key]) continue;
    const fact = node('div', 'fact');
    fact.append(node('span', 'fact-label', label), node('span', '', card[key]));
    container.append(fact);
  }
}
function renderSources(container, card) {
  container.replaceChildren();
  const original = safeLink('阅读这条建议的原文 ↗', card.sourceUrl);
  if (original) container.append(original);
  if (!(card.sources || []).length && card.sourceReferences) container.append(node('p', 'source-reference', card.sourceReferences));
  for (const source of card.sources || []) {
    const link = safeLink(source.title || source.url, source.url);
    if (link) container.append(link);
  }
}
function queueSeenEvents(events) {
  for (const id of events.newlyCompletedTopics) {
    const topic = progress.summary().topics.find(t => t.id === id);
    pendingReports.set(`viewed:${id}`, `已探索完「${topic.name}」`);
  }
  if (events.newlyAllViewed) pendingReports.set('viewed:all', '已探索全部生活卡牌');
}
function roundEventKey() {
  const ids = deck.snapshot().order.join(',');
  let hash = 2166136261;
  for (const char of ids) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `round:${scope}:${deck.stats().round}:${hash >>> 0}`;
}
function openAutomaticReport(continueDrawing = false) {
  if (!ready || document.querySelector('dialog[open]')) return false;
  const stats = deck.stats();
  if (stats.complete && !stats.canNextInHistory) pendingReports.set(roundEventKey(), `「${scopeInfo().name}」第 ${stats.round} 轮已扫完`);
  const reasons = [];
  for (const [key, title] of pendingReports) if (progress.claimReport(key)) reasons.push(title);
  pendingReports.clear();
  if (!reasons.length) return false;
  resumeAfterReport = continueDrawing;
  setActivePage('report');
  report.open({ reason: [...new Set(reasons)].join(' · '), scopeName: scopeInfo().name });
  return true;
}
function scheduleCompletionReport() {
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => openAutomaticReport(false), 650);
}
function renderAtlas(summary) {
  const fragment = document.createDocumentFragment();
  for (const topic of summary.topics) {
    const theme = themeFor(topic.id);
    const tile = node('button', `atlas-tile${topic.gold ? ' is-gold' : ''}${scope === topic.id ? ' is-selected' : ''}`);
    tile.type = 'button'; applyTheme(tile, theme);
    tile.setAttribute('aria-pressed', String(scope === topic.id));
    tile.setAttribute('aria-label', `${topic.name}，卡池 ${topic.total} 张，看过 ${topic.viewed} 张，已选择 ${topic.done + topic.declined} 张${topic.gold ? '，金标已点亮' : ''}`);
    const head = node('div', 'atlas-tile-head');
    const mark = node('span', 'atlas-emblem'); emblem(mark, theme);
    const gold = node('span', `atlas-gold${topic.gold ? ' is-lit' : ''}`, '✦');
    gold.setAttribute('aria-label', topic.gold ? '金标已点亮' : '金标待点亮');
    head.append(mark, node('span', 'atlas-chapter', topic.id.replace('section-', 'CH. ')), gold);
    tile.append(head, node('span', 'atlas-series', theme.series), node('h3', '', topic.name));
    tile.append(node('p', 'atlas-counts', `卡池 ${topic.total} · 做到 ${topic.done}`));
    const track = node('div', 'atlas-mini-progress');
    const fill = node('span'); fill.style.width = `${(topic.done + topic.declined) / topic.total * 100}%`; track.append(fill);
    tile.append(track, node('p', 'atlas-viewed', `看过 ${topic.viewed}/${topic.total} · 已选 ${topic.done + topic.declined}/${topic.total}`));
    tile.addEventListener('click', () => { selectScope(topic.id); setAtlasExpanded(false); });
    fragment.append(tile);
  }
  $('atlas-grid').replaceChildren(fragment);
}
function renderOverview() {
  if (!progress) return;
  const summary = progress.summary(), info = scopeInfo(summary), stats = deck.stats();
  $('atlas-gold-count').textContent = `${summary.goldCount} / ${summary.topics.length}`;
  $('atlas-total').textContent = `${summary.total} 张`;
  $('atlas-summary-text').textContent = `看过 ${summary.viewed} 张 · 已选 ${summary.done + summary.declined} 张 · ${summary.goldCount} 枚金标`;
  $('scope-name').textContent = info.name;
  $('scope-counts').textContent = `${info.total} 张 · 看过 ${info.viewed} · 已选 ${info.done + info.declined}`;
  const percent = info.total ? Math.round(info.viewed / info.total * 100) : 0;
  $('scope-progress-text').textContent = `${percent}%`;
  $('scope-progress-bar').style.width = `${percent}%`;
  const isGold = scope === 'all' ? summary.goldCount === summary.topics.length : info.gold;
  $('scope-gold').classList.toggle('is-lit', isGold);
  $('scope-gold').textContent = isGold ? '✦ 已点亮' : scope === 'all' ? `✦ ${summary.goldCount}/${summary.topics.length}` : '✧';
  $('scope-gold').setAttribute('aria-label', isGold ? '金标已点亮' : '金标待点亮');
  applyTheme($('scope-hud'), themeFor(scope));
  if (scope === 'all') $('scope-emblem').replaceChildren(icon('sparkle'));
  else emblem($('scope-emblem'), themeFor(scope));
  $('all-scope').classList.toggle('active', scope === 'all'); $('all-scope').setAttribute('aria-pressed', String(scope === 'all'));
  $('done-filter-option').textContent = `做到了（${summary.done}）`;
  $('declined-filter-option').textContent = `暂不采用（${summary.declined}）`;
  $('pending-filter-option').textContent = `未选择（${summary.pending - summary.todo}）`;
  $('todo-filter-option').textContent = `todo（${summary.todo}）`;
  $('previous').disabled = !stats.canPrevious;
  $('next').disabled = stats.total === 0 && info.pending === 0;
  if (!currentCard()) {
    $('card-question').textContent = info.pending ? '有卡牌回到了卡池，继续探索吧。' : '这一副卡牌，已作出全部选择。';
    $('card-series').textContent = '';
    $('front-number').textContent = info.pending ? `${info.pending} READY` : 'COLLECTED';
  }
  renderAtlas(summary); renderDecisions(); renderFavorite();
}

function renderFavorite() {
  const card = currentCard(), saved = !!card && favorites.has(card.id);
  $('favorite').classList.toggle('is-saved', saved); $('favorite').setAttribute('aria-pressed', String(saved));
  $('favorite').setAttribute('aria-label', saved ? '取消收藏当前卡片' : '收藏当前卡片');
  $('favorite').disabled = !card; $('saved-filter-option').textContent = `我的收藏（${favorites.size}）`;
}
function renderDecisions() {
  const card = currentCard(), status = card ? progress.status(card.id) : 'pending';
  $('done-check').checked = status === 'done'; $('declined-check').checked = status === 'declined';
  $('done-check').disabled = !card; $('declined-check').disabled = !card;
  const todo = !!card && progress.isTodo(card.id);
  $('todo-button').disabled = !card;
  $('todo-button').setAttribute('aria-pressed', String(todo));
  $('todo-button').setAttribute('aria-label', todo ? '已加入todo，点击移除' : '加入todo');
  $('todo-button').replaceChildren(icon(todo ? 'check' : 'plus'), node('span', '', '加入todo'));
}
function renderCard() {
  $('card-front').querySelector('.front-content').scrollTop = 0;
  $('card-back').querySelector('.back-content').scrollTop = 0;
  setFlipped(false);
  const card = currentCard();
  $('card-stage').classList.toggle('is-empty', !card);
  if (!card) {
    const theme = themeFor(scope); applyTheme($('card-stage'), theme); emblem($('card-art'), theme);
    $('front-category').textContent = scopeInfo().name; $('card-series').textContent = '';
    $('front-number').textContent = 'COLLECTED'; $('card-question').textContent = '这一副卡牌，已作出全部选择。';
    $('card-code').textContent = ''; $('card-rarity').textContent = '✦'; $('front-flags').replaceChildren();
    $('card-front').disabled = true; $('flip-button').disabled = true;
    renderOverview(); resizeCard(); return;
  }
  const viewedEvent = progress.markViewed(card.id);
  queueSeenEvents(viewedEvent);
  if (viewedEvent.newlyCompletedTopics.length || viewedEvent.newlyAllViewed || deck.stats().complete) scheduleCompletionReport();
  const theme = themeFor(card.categoryId); applyTheme($('card-stage'), theme); emblem($('card-art'), theme);
  $('card-front').disabled = false; $('flip-button').disabled = false;
  $('front-category').textContent = card.category; $('back-category').textContent = card.category;
  $('front-number').textContent = `${String(deck.stats().position).padStart(3, '0')} / ${deck.stats().total}`;
  $('card-series').textContent = `${theme.series} · ${theme.name}`;
  $('card-code').textContent = `CHAPTER ${String(card.section).padStart(2, '0')} / ${String(card.item).padStart(2, '0')}`;
  $('card-rarity').textContent = `EVIDENCE ${card.evidence || 'C'}`;
  const question = card.question || card.title;
  $('card-question').textContent = question; $('card-front').setAttribute('aria-label', `翻开卡牌：${question}`);
  $('card-question').classList.toggle('long-title', question.length > 32);
  $('card-question').classList.toggle('extra-long-title', question.length > 56);
  renderFlags($('front-flags'), card); renderFlags($('back-flags'), card);
  $('answer-title').textContent = card.title; $('answer-text').textContent = card.answer;
  $('answer-note').replaceChildren();
  if (card.note) $('answer-note').append(node('span', 'note-label', '适用条件与补充'), document.createTextNode(card.note));
  renderFacts($('card-facts'), card); renderSources($('source-links'), card);
  $('evidence-badge').textContent = card.evidence ? `原文证据 ${card.evidence}` : '';
  $('source-links').parentElement.open = false;
  renderOverview(); resizeCard();
  $('card-announcement').textContent = `第 ${deck.stats().position} 张，${card.category}：${question}`;
}
function selectScope(id, announce = true) {
  scope = id;
  const info = progress.summary().topics.find(t => t.id === id);
  const legacyScopeName = id === 'all' ? 'all' : info.name;
  deck = new DeckEngine(scopeCards().map(c => c.id), {
    storage: persistence, key: `life-cards:deck:v1:${legacyScopeName}`, isEligible: id => progress.status(id) === 'pending',
  });
  if (!deck.current()) deck.next();
  persistence.setItem('life-cards:category', id); renderCard();
  if (announce) toast(`已进入「${scopeInfo().name}」卡组`);
}
function drawNext() {
  if (!ready) return;
  const result = deck.next(); renderCard();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) $('card-stage').animate([{ opacity: .35, transform: 'translateY(7px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 260, easing: 'ease-out' });
  if (result.newRound && result.total) toast(`第 ${result.round} 轮 · 未勾选的 ${result.total} 张卡牌已重新洗牌`);
}
function handleNext() {
  if (!ready) return;
  if (!openAutomaticReport(true)) drawNext();
}
function changeStatus(id, status, checked) {
  const event = progress.setStatus(id, checked ? status : 'pending');
  for (const topicId of event.newlyGoldenTopics) {
    const topic = progress.summary().topics.find(t => t.id === topicId);
    pendingReports.set(`gold:${topicId}`, `「${topic.name}」金标已点亮`);
    toast(`✦ 「${topic.name}」全部选择完成，金标已点亮`);
  }
  const topic = progress.summary().topics.find(t => t.id === byId.get(id).categoryId);
  if (topic && !topic.gold) pendingReports.delete(`gold:${topic.id}`);
  renderOverview(); if ($('library-dialog').open) renderLibrary();
  if (event.newlyGoldenTopics.length) scheduleCompletionReport();
}
function toggleTodo(id = currentCard()?.id) {
  if (!id) return;
  progress.setTodo(id, !progress.isTodo(id));
  const topic = progress.summary().topics.find(t => t.id === byId.get(id).categoryId);
  if (topic && !topic.gold) pendingReports.delete(`gold:${topic.id}`);
  renderOverview();
  if ($('library-dialog').open) renderLibrary();
}
function libraryTodo(card) {
  const button = node('button', 'library-todo', progress.isTodo(card.id) ? '移出todo' : '加入todo');
  button.type = 'button';
  button.setAttribute('aria-pressed', String(progress.isTodo(card.id)));
  button.addEventListener('click', () => toggleTodo(card.id));
  return button;
}
function toggleFavorite(id = currentCard()?.id) {
  if (!id) return;
  const adding = !favorites.has(id); adding ? favorites.add(id) : favorites.delete(id);
  persistence.setItem(FAVORITES_KEY, JSON.stringify([...favorites])); renderFavorite();
  toast(adding ? '已收藏这张卡牌' : '已取消收藏');
  if ($('library-dialog').open) renderLibrary();
}
function setAtlasExpanded(value) {
  if (value) {
    if (!ready) return;
    setActivePage('atlas');
    if (!$('atlas-dialog').open) $('atlas-dialog').showModal();
  } else $('atlas-dialog').close();
}

function libraryDecision(card, status, text) {
  const label = node('label', 'library-decision');
  const input = document.createElement('input'); input.type = 'checkbox'; input.checked = progress.status(card.id) === status;
  input.addEventListener('change', () => changeStatus(card.id, status, input.checked));
  label.append(input, document.createTextNode(text)); return label;
}
function createLibraryItem(card) {
  const status = progress.status(card.id), todo = progress.isTodo(card.id), item = node('details', `library-item status-${todo ? 'todo' : status}`);
  applyTheme(item, themeFor(card.categoryId));
  const summary = node('summary'), top = node('div', 'library-item-top');
  top.append(node('span', 'library-category', card.category), node('span', 'library-status', todo ? '☐ todo' : status === 'done' ? '✓ 做到了' : status === 'declined' ? '— 暂不采用' : '未选择'));
  summary.append(top); const flags = node('div', 'card-flags library-flags'); renderFlags(flags, card); summary.append(flags);
  const title = node('h3', '', card.title); title.append(icon('chevron')); summary.append(title); item.append(summary);
  function addDetail() {
    if (item.dataset.loaded) return;
    item.dataset.loaded = 'true';
    const content = node('div', 'library-detail'); content.append(node('p', '', card.answer));
    if (card.note) { const note = node('div', 'answer-note'); note.append(node('span', 'note-label', '适用条件与补充'), document.createTextNode(card.note)); content.append(note); }
    const facts = node('div', 'facts'); renderFacts(facts, card); content.append(facts);
    if (card.evidence) content.append(node('p', 'library-category', `原文证据等级 ${card.evidence}`));
    const links = node('div', 'library-source-links'); renderSources(links, card); content.append(links);
    const choices = node('div', 'library-decisions');
    choices.append(libraryDecision(card, 'declined', '不同意 / 不想做 / 用不到'), libraryDecision(card, 'done', '做到了'), libraryTodo(card)); content.append(choices);
    const star = node('button', 'library-star', favorites.has(card.id) ? '取消收藏' : '收藏这张卡牌'); star.addEventListener('click', () => toggleFavorite(card.id)); content.append(star); item.append(content);
  }
  item.addEventListener('toggle', () => {
    if (!item.isConnected) return;
    if (item.open) {
      libraryOpenIds.add(card.id); addDetail(); queueSeenEvents(progress.markViewed(card.id)); renderOverview();
    } else libraryOpenIds.delete(card.id);
  });
  if (libraryOpenIds.has(card.id)) { addDetail(); item.open = true; }
  return item;
}
function renderLibrary() {
  const query = $('library-search').value.trim().toLocaleLowerCase(), filter = $('library-filter').value;
  const filtered = cards.filter(c => (filter === 'all' ? true : filter === 'saved' ? favorites.has(c.id) : filter === 'todo' ? progress.isTodo(c.id) : filter === 'pending' ? progress.status(c.id) === 'pending' && !progress.isTodo(c.id) : progress.status(c.id) === filter) && (!query || [c.title, c.answer, c.category, c.note, ...(c.tags || [])].join(' ').toLocaleLowerCase().includes(query)));
  $('library-count').textContent = `${filtered.length} 张卡牌${query ? ' · 搜索结果' : ''}`;
  const fragment = document.createDocumentFragment();
  if (!filtered.length) fragment.append(node('p', 'library-empty', '这里还没有卡牌。试试其他状态或关键词。'));
  for (const card of filtered.slice(0, libraryLimit)) fragment.append(createLibraryItem(card));
  if (filtered.length > libraryLimit) { const more = node('button', 'load-more', `继续展开 ${Math.min(40, filtered.length - libraryLimit)} 张（还有 ${filtered.length - libraryLimit} 张）`); more.addEventListener('click', () => { libraryLimit += 40; renderLibrary(); }); fragment.append(more); }
  $('library-list').replaceChildren(fragment);
}
function openLibrary(filter = 'all') {
  if (!ready) return;
  libraryLimit = 40; libraryOpenIds.clear(); $('library-search').value = ''; $('library-filter').value = filter;
  $('library-title').textContent = filter === 'done' ? '做到了的卡牌' : filter === 'declined' ? '暂不采用的卡牌' : filter === 'saved' ? '我收藏的卡牌' : filter === 'todo' ? '我的todo' : '我的生活卡册';
  setActivePage('library'); renderLibrary(); $('library-dialog').showModal();
}
function openCurrentReport() {
  if (!ready) return;
  clearTimeout(autoTimer); resumeAfterReport = false;
  const stats = deck.stats();
  if (stats.complete && !stats.canNextInHistory) progress.claimReport(roundEventKey());
  for (const key of pendingReports.keys()) progress.claimReport(key);
  pendingReports.clear();
  setActivePage('report');
  report.open({ reason: '当前探索进展', scopeName: scopeInfo().name });
}

$('card-front').addEventListener('click', () => { if (currentCard()) setFlipped(true, true); });
$('back-flip').addEventListener('click', () => setFlipped(false, true));
$('flip-button').addEventListener('click', () => { if (currentCard()) setFlipped(!flipped); });
$('next').addEventListener('click', handleNext);
$('previous').addEventListener('click', () => { if (ready) { deck.previous(); renderCard(); } });
$('favorite').addEventListener('click', () => toggleFavorite());
$('todo-button').addEventListener('click', () => toggleTodo());
$('done-check').addEventListener('change', () => { if (currentCard()) changeStatus(currentCard().id, 'done', $('done-check').checked); });
$('declined-check').addEventListener('change', () => { if (currentCard()) changeStatus(currentCard().id, 'declined', $('declined-check').checked); });
$('all-scope').addEventListener('click', () => { if (ready) { selectScope('all'); setAtlasExpanded(false); } });
$('atlas-toggle').addEventListener('click', () => setAtlasExpanded(true));
$('atlas-nav').addEventListener('click', () => setAtlasExpanded(true));
$('mobile-atlas-nav').addEventListener('click', () => setAtlasExpanded(true));
$('close-atlas').addEventListener('click', () => $('atlas-dialog').close());
$('library-nav').addEventListener('click', () => openLibrary());
$('mobile-library-nav').addEventListener('click', () => openLibrary());
$('draw-nav').addEventListener('click', returnToCards);
$('mobile-draw-nav').addEventListener('click', returnToCards);
$('close-library').addEventListener('click', () => $('library-dialog').close());
$('library-search').addEventListener('input', () => { libraryLimit = 40; renderLibrary(); });
$('library-filter').addEventListener('change', () => { libraryLimit = 40; libraryOpenIds.clear(); renderLibrary(); });
$('report-nav').addEventListener('click', openCurrentReport);
$('mobile-report-nav').addEventListener('click', openCurrentReport);
$('about-button').addEventListener('click', () => $('about-dialog').showModal());
$('close-about').addEventListener('click', () => $('about-dialog').close());
for (const dialog of [$('atlas-dialog'), $('library-dialog'), $('about-dialog')]) {
  dialog.addEventListener('close', () => {
    if (!document.querySelector('dialog[open]')) { setActivePage('cards'); openAutomaticReport(false); }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
}
$('source-links').parentElement.addEventListener('toggle', resizeCard); addEventListener('resize', resizeCard);
new ResizeObserver(resizeCard).observe($('card-stage').parentElement);
document.addEventListener('keydown', event => {
  if (!ready || document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
  if (event.code === 'Space') { if (event.target.closest('button,a,summary')) return; event.preventDefault(); if (currentCard()) setFlipped(!flipped); }
  else if (event.key === 'ArrowRight') { event.preventDefault(); handleNext(); }
  else if (event.key === 'ArrowLeft') { event.preventDefault(); if (deck.stats().canPrevious) { deck.previous(); renderCard(); } }
  else if (event.key.toLowerCase() === 's') { event.preventDefault(); toggleFavorite(); }
});

async function init() {
  try {
    const response = await fetch('cards.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    cards = await response.json();
    if (!Array.isArray(cards) || !cards.length) throw new Error('卡牌数据为空');
    byId = new Map(cards.map(c => [c.id, c]));
    progress = new ProgressStore(cards, { storage: persistence });
    try { const saved = JSON.parse(persistence.getItem(FAVORITES_KEY) || '[]'); favorites = new Set(Array.isArray(saved) ? saved.filter(id => byId.has(id)) : []); } catch { favorites = new Set(); }
    report = createReportView({ dialog: $('report-dialog'), getSnapshot: () => progress.summary(), setName: name => progress.setName(name), themeFor, onClose: () => { setActivePage('cards'); const resume = resumeAfterReport; resumeAfterReport = false; if (resume) drawNext(); } });
    primaryControls.forEach(id => $(id).disabled = false); ready = true; $('nav-count').textContent = cards.length;
    const savedScope = persistence.getItem('life-cards:category');
    const topics = progress.summary().topics;
    const topic = topics.find(t => t.id === savedScope || t.name === savedScope);
    selectScope(topic?.id || 'all', false);
    $('source-description').textContent = `收录正文 ${topics.length} 个主题、${cards.length} 条建议。`;
    try {
      const metaResponse = await fetch('source-meta.json');
      if (metaResponse.ok) { const meta = await metaResponse.json(); $('source-description').textContent += `源版本 ${meta.upstreamCommit.slice(0, 7)}，整理于 ${meta.synchronizedOn || meta.sourceDate}。`; }
    } catch { /* The optional provenance summary never blocks a working deck. */ }
  } catch (error) {
    console.error('卡牌加载失败', error); $('card-question').textContent = '卡册暂时没有打开，请刷新重试。';
    primaryControls.forEach(id => $(id).disabled = true); ready = false; toast('加载失败，请刷新后再试。');
  }
}
init();
