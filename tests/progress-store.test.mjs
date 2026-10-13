import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ProgressStore } from '../dist/progress-store.js';
import { DeckEngine } from '../dist/deck-engine.js';

const cards = [
  { id: 'a', categoryId: 'health', category: '健康' },
  { id: 'b', categoryId: 'health', category: '健康' },
  { id: 'c', categoryId: 'home', category: '居家' },
];

function memoryStorage() {
  const items = new Map();
  return {
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
  };
}

test('a card has one reversible decision, separate from viewed progress', () => {
  const store = new ProgressStore(cards, { storage: null });
  assert.equal(store.status('a'), 'pending');
  store.setStatus('a', 'done');
  assert.equal(store.summary().done, 1);
  assert.equal(store.summary().viewed, 0);
  store.setStatus('a', 'declined');
  assert.equal(store.status('a'), 'declined');
  assert.equal(store.summary().done, 0);
  assert.equal(store.summary().declined, 1);
  store.setStatus('a', 'pending');
  assert.equal(store.summary().pending, 3);
  assert.equal(store.status('missing'), 'pending');
  assert.deepEqual(store.setStatus('missing', 'done'), { newlyGoldenTopics: [] });
  assert.throws(() => store.setStatus('a', 'other'), TypeError);
});

test('todo, done, and declined are mutually exclusive and reversibly selected', () => {
  const store = new ProgressStore(cards, { storage: null });
  assert.equal(store.isTodo('a'), false);
  store.setStatus('a', 'done');
  assert.deepEqual(store.setTodo('a', true), { todo: true });
  assert.equal(store.status('a'), 'pending');
  assert.equal(store.summary().done, 0);
  store.setStatus('a', 'pending');
  assert.equal(store.isTodo('a'), true);
  store.setStatus('a', 'declined');
  assert.equal(store.isTodo('a'), false);
  assert.equal(store.status('a'), 'declined');
  store.setTodo('a', true);
  assert.equal(store.summary().declined, 0);
  store.setStatus('a', 'done');
  assert.equal(store.isTodo('a'), false);
  assert.equal(store.status('a'), 'done');
  store.setTodo('a', true);
  assert.deepEqual(store.setTodo('a', false), { todo: false });
  assert.equal(store.status('a'), 'pending');
  assert.equal(store.summary().pending, 3);
  assert.deepEqual(store.setTodo('missing', true), { todo: false });
  assert.equal(store.isTodo('missing'), false);
  assert.throws(() => store.setTodo('a', 'true'), TypeError);
});

test('todo counts as pending without increasing the index or earning a gold topic', () => {
  const store = new ProgressStore(cards, { storage: null });
  store.markViewed('a');
  store.markViewed('b');
  const baseline = store.summary().index;
  store.setTodo('a', true);
  store.setTodo('b', true);
  const todoSummary = store.summary();
  assert.equal(todoSummary.todo, 2);
  assert.equal(todoSummary.topics[0].todo, 2);
  assert.equal(todoSummary.topics[1].todo, 0);
  assert.equal(todoSummary.topics[0].pending, 2);
  assert.equal(todoSummary.pending, 3);
  assert.equal(todoSummary.index, baseline);
  assert.equal(todoSummary.goldCount, 0);
  store.setStatus('a', 'done');
  assert.deepEqual(store.setStatus('b', 'declined'), { newlyGoldenTopics: ['health'] });
  assert.equal(store.summary().goldCount, 1);
  store.setTodo('a', true);
  assert.equal(store.summary().goldCount, 0);
  assert.equal(store.summary().topics[0].gold, false);
  assert.equal(store.summary().done, 0);
});

test('todo saves independently while existing progress and unrelated storage survive reload', () => {
  const storage = memoryStorage();
  storage.setItem('life-cards:bookmarks:v1', JSON.stringify(['a', 'c']));
  const store = new ProgressStore(cards, { storage });
  store.markViewed('b');
  store.setStatus('c', 'declined');
  store.setTodo('a', true);
  store.setName('阿树');
  store.claimReport('first-round');
  assert.deepEqual(JSON.parse(storage.getItem('life-cards:todo:v1')), { version: 1, ids: ['a'] });
  assert.equal(JSON.parse(storage.getItem('life-cards:progress:v2')).version, 2);
  assert.equal(Object.hasOwn(JSON.parse(storage.getItem('life-cards:progress:v2')), 'todo'), false);
  const restored = new ProgressStore(cards, { storage });
  assert.deepEqual(restored.summary(), store.summary());
  assert.equal(restored.isTodo('a'), true);
  assert.equal(restored.status('a'), 'pending');
  assert.equal(restored.claimReport('first-round'), false);
  assert.deepEqual(JSON.parse(storage.getItem('life-cards:bookmarks:v1')), ['a', 'c']);
  restored.setTodo('a', false);
  assert.equal(new ProgressStore(cards, { storage }).isTodo('a'), false);
});

test('invalid todo storage is ignored and separately restored todos override stale terminal decisions', () => {
  const storage = memoryStorage();
  for (const value of ['{broken', 'null', '[]', JSON.stringify({ version: 99, ids: ['a'] }), JSON.stringify({ version: 1, ids: {} })]) {
    storage.setItem('life-cards:todo:v1', value);
    assert.equal(new ProgressStore(cards, { storage }).summary().todo, 0);
  }
  storage.setItem('life-cards:todo:v1', JSON.stringify({ version: 1, ids: ['a', 'a', 'removed', 5, null] }));
  storage.setItem('life-cards:progress:v2', JSON.stringify({
    version: 2, statuses: { a: 'done', c: 'declined' }, viewed: ['b'], reportEvents: [], name: '',
  }));
  const restored = new ProgressStore(cards, { storage });
  assert.equal(restored.summary().todo, 1);
  assert.equal(restored.isTodo('a'), true);
  assert.equal(restored.isTodo('removed'), false);
  assert.equal(restored.status('a'), 'pending');
  assert.equal(restored.status('c'), 'declined');
  assert.equal(restored.summary().viewed, 1);
  assert.deepEqual(JSON.parse(storage.getItem('life-cards:todo:v1')).ids, ['a']);
});

test('unavailable storage leaves todos usable and failure of either save does not block the other', () => {
  const unavailable = new ProgressStore(cards, {
    storage: { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } },
  });
  unavailable.setTodo('a', true);
  assert.equal(unavailable.summary().todo, 1);
  unavailable.setStatus('a', 'done');
  assert.equal(unavailable.isTodo('a'), false);
  assert.equal(unavailable.summary().done, 1);
  for (const failedKey of ['life-cards:todo:v1', 'life-cards:progress:v2']) {
    const writes = [];
    const storage = memoryStorage();
    const store = new ProgressStore(cards, {
      storage: {
        getItem: storage.getItem,
        setItem(key, value) {
          writes.push(key);
          if (key === failedKey) throw new Error('full');
          storage.setItem(key, value);
        },
      },
    });
    writes.length = 0;
    store.setTodo('a', true);
    assert.deepEqual(writes, ['life-cards:todo:v1', 'life-cards:progress:v2']);
    assert.equal(store.isTodo('a'), true);
    const successfulKey = failedKey === 'life-cards:todo:v1' ? 'life-cards:progress:v2' : 'life-cards:todo:v1';
    assert.ok(storage.getItem(successfulKey));
  }
});

test('gold topics require a decision on every card and update when cleared', () => {
  const store = new ProgressStore(cards, { storage: null });
  assert.deepEqual(store.setStatus('a', 'done'), { newlyGoldenTopics: [] });
  assert.deepEqual(store.setStatus('b', 'declined'), { newlyGoldenTopics: ['health'] });
  assert.equal(store.summary().goldCount, 1);
  assert.equal(store.summary().topics[0].gold, true);
  assert.deepEqual(store.setStatus('b', 'done'), { newlyGoldenTopics: [] });
  store.setStatus('a', 'pending');
  assert.equal(store.summary().topics[0].gold, false);
  assert.equal(store.summary().goldCount, 0);
});

test('viewed totals count unique cards across repeated rounds and scopes', () => {
  const store = new ProgressStore(cards, { storage: null });
  assert.deepEqual(store.markViewed('a'), { newlyCompletedTopics: [], allViewed: false, newlyAllViewed: false });
  assert.deepEqual(store.markViewed('a'), { newlyCompletedTopics: [], allViewed: false, newlyAllViewed: false });
  assert.deepEqual(store.markViewed('b'), { newlyCompletedTopics: ['health'], allViewed: false, newlyAllViewed: false });
  assert.deepEqual(store.markViewed('c'), { newlyCompletedTopics: ['home'], allViewed: true, newlyAllViewed: true });
  assert.deepEqual(store.markViewed('c'), { newlyCompletedTopics: [], allViewed: true, newlyAllViewed: false });
  assert.deepEqual(store.markViewed('unknown'), { newlyCompletedTopics: [], allViewed: true, newlyAllViewed: false });
  assert.equal(store.summary().viewed, 3);
});

test('summary has exact counts, topic IDs, index, and stored name', () => {
  const store = new ProgressStore(cards, { storage: null });
  store.markViewed('a');
  store.markViewed('b');
  store.setStatus('a', 'done');
  store.setStatus('b', 'declined');
  store.setName('  小林  ');
  assert.deepEqual(store.summary(), {
    total: 3, viewed: 2, done: 1, declined: 1, todo: 0, pending: 1,
    index: 43,
    topics: [
      { id: 'health', name: '健康', total: 2, viewed: 2, done: 1, declined: 1, todo: 0, pending: 0, gold: true },
      { id: 'home', name: '居家', total: 1, viewed: 0, done: 0, declined: 0, todo: 0, pending: 1, gold: false },
    ],
    goldCount: 1, name: '小林',
  });
});

test('decisions, viewed IDs, name, and report claims survive reload', () => {
  const storage = memoryStorage();
  const store = new ProgressStore(cards, { storage });
  store.markViewed('b');
  store.setStatus('a', 'done');
  store.setStatus('c', 'declined');
  store.setName('阿树');
  assert.equal(store.claimReport('scope:all:round:1'), true);
  assert.equal(store.claimReport('scope:all:round:1'), false);
  const restored = new ProgressStore(cards, { storage });
  assert.deepEqual(restored.summary(), store.summary());
  assert.equal(restored.getName(), '阿树');
  assert.equal(restored.claimReport('scope:all:round:1'), false);
  assert.equal(restored.claimReport('scope:health:round:1'), true);
  assert.equal(restored.claimReport(''), false);
});

test('legacy all and topic decks migrate the union of order.slice(0, seen)', () => {
  const storage = memoryStorage();
  storage.setItem('life-cards:deck:v1:all', JSON.stringify({ version: 1, order: ['b', 'a', 'c'], seen: 1, cursor: 0 }));
  storage.setItem('life-cards:deck:v1:健康', JSON.stringify({ version: 1, order: ['a', 'b'], seen: 1, cursor: 0 }));
  storage.setItem('life-cards:deck:v1:居家', '{broken');
  const store = new ProgressStore(cards, { storage });
  assert.equal(store.summary().viewed, 2);
  assert.equal(store.summary().topics[0].viewed, 2);
  assert.equal(store.summary().topics[1].viewed, 0);
  assert.equal(store.summary().done, 0);
  assert.deepEqual(store.markViewed('b').newlyCompletedTopics, []);
  // Migration runs once: future legacy changes cannot overwrite lifetime state.
  storage.setItem('life-cards:deck:v1:all', JSON.stringify({ version: 1, order: ['b', 'a', 'c'], seen: 3 }));
  assert.equal(new ProgressStore(cards, { storage }).summary().viewed, 2);
});

test('corrupt storage recovers and removed or invalid records are ignored', () => {
  const storage = memoryStorage();
  for (const value of ['{broken', 'null', '[]', JSON.stringify({ version: 99 })]) {
    storage.setItem('life-cards:progress:v2', value);
    assert.equal(new ProgressStore(cards, { storage }).summary().pending, 3);
  }
  storage.setItem('life-cards:progress:v2', JSON.stringify({
    version: 2, statuses: { a: 'done', b: 'invalid', removed: 'done' },
    viewed: ['a', 'a', 'removed', 5], reportEvents: ['first', 4], name: '旧名字',
  }));
  const store = new ProgressStore(cards, { storage });
  assert.equal(store.summary().done, 1);
  assert.equal(store.summary().viewed, 1);
  assert.equal(store.summary().pending, 2);
  assert.equal(store.claimReport('first'), false);
  const failing = new ProgressStore(cards, {
    storage: { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } },
  });
  failing.markViewed('a');
  failing.setStatus('a', 'done');
  assert.equal(failing.summary().viewed, 1);
  assert.equal(failing.summary().done, 1);
});

test('the actual 687-card corpus covers once and excludes decisions next round', async () => {
  const actual = JSON.parse(await readFile(new URL('../dist/cards.json', import.meta.url), 'utf8'));
  assert.equal(actual.length, 687);
  const store = new ProgressStore(actual, { storage: null });
  assert.equal(store.summary().topics.length, 34);
  const deck = new DeckEngine(actual.map(card => card.id), {
    storage: null, isEligible: id => store.status(id) === 'pending',
  });
  const firstRound = [];
  for (let i = 0; i < actual.length; i += 1) {
    const result = deck.next();
    firstRound.push(result.id);
    store.markViewed(result.id);
    if (i < 120) store.setStatus(result.id, 'done');
    else if (i < 210) store.setStatus(result.id, 'declined');
    else if (i < 230) store.setTodo(result.id, true);
  }
  assert.equal(new Set(firstRound).size, 687);
  assert.deepEqual([...firstRound].sort(), actual.map(card => card.id).sort());
  assert.equal(store.summary().viewed, 687);
  assert.equal(store.summary().done, 120);
  assert.equal(store.summary().declined, 90);
  assert.equal(store.summary().todo, 20);
  const secondRound = [];
  for (let i = 0; i < 477; i += 1) secondRound.push(deck.next().id);
  assert.equal(new Set(secondRound).size, 477);
  assert.ok(secondRound.every(id => store.status(id) === 'pending'));
  assert.ok(firstRound.slice(210, 230).every(id => secondRound.includes(id)));
  assert.equal(deck.stats().scopeTotal, 687);
  assert.equal(deck.stats().total, 477);
  assert.equal(deck.stats().round, 2);
  assert.equal(deck.stats().complete, true);
  store.setStatus(firstRound[0], 'pending');
  assert.equal(deck.next().total, 478);
});

test('empty corpus remains finite and produces no completion or gold event', () => {
  const store = new ProgressStore([], { storage: null });
  assert.equal(store.summary().index, 0);
  assert.equal(store.summary().goldCount, 0);
  assert.deepEqual(store.markViewed('anything'), { newlyCompletedTopics: [], allViewed: false, newlyAllViewed: false });
});
