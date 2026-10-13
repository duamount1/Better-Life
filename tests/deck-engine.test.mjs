import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// The browser module has no package.json requirement; load it as ESM in Node.
const source = await readFile(new URL('../dist/deck-engine.js', import.meta.url), 'utf8');
const { DeckEngine } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function memoryStorage() {
  const items = new Map();
  return {
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
  };
}

function seededRandom(seed = 12345) {
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

test('each round covers every card once, then next starts a fresh round', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  const deck = new DeckEngine(ids, { storage: null, rng: seededRandom() });
  assert.equal(deck.current(), null);
  assert.deepEqual(deck.stats(), {
    round: 1, position: 0, total: 5, scopeTotal: 5, seen: 0, complete: false,
    canPrevious: false, canNextInHistory: false,
  });
  let previousLast = null;
  for (let round = 1; round <= 30; round += 1) {
    const drawn = [];
    for (let position = 1; position <= ids.length; position += 1) {
      const result = deck.next();
      drawn.push(result.id);
      assert.equal(result.round, round);
      assert.equal(result.position, position);
      assert.equal(result.seen, position);
      assert.equal(result.newRound, round > 1 && position === 1);
      assert.equal(result.complete, position === ids.length);
    }
    assert.deepEqual([...drawn].sort(), ids);
    if (previousLast !== null) assert.notEqual(drawn[0], previousLast);
    previousLast = drawn.at(-1);
    assert.equal(deck.stats().seen, ids.length);
  }
});

test('Fisher-Yates order responds to the supplied random source', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const low = new DeckEngine(ids, { storage: null, rng: () => 0 });
  const high = new DeckEngine(ids, { storage: null, rng: () => 0.999 });
  assert.deepEqual(ids.map(() => low.next().id), ['b', 'c', 'd', 'a']);
  assert.deepEqual(ids.map(() => high.next().id), ids);
});

test('cross-round guard works even when shuffle would repeat the last card', () => {
  const values = [0.999, 0, 0];
  const deck = new DeckEngine(['a', 'b'], { storage: null, rng: () => values.shift() ?? 0.999 });
  assert.equal(deck.next().id, 'a');
  assert.equal(deck.next().id, 'b');
  assert.equal(deck.next().id, 'a');
  assert.equal(deck.next().id, 'b');
  assert.equal(deck.next().id, 'a');
});

test('history navigation preserves coverage and advances history before drawing', () => {
  const deck = new DeckEngine(['a', 'b', 'c', 'd'], { storage: null, rng: () => 0.999 });
  assert.equal(deck.previous().id, null);
  ['a', 'b', 'c'].forEach(id => assert.equal(deck.next().id, id));
  assert.equal(deck.previous().id, 'b');
  assert.equal(deck.previous().id, 'a');
  assert.equal(deck.previous().id, 'a');
  assert.equal(deck.stats().seen, 3);
  assert.equal(deck.stats().position, 1);
  assert.equal(deck.stats().canNextInHistory, true);
  assert.equal(deck.next().id, 'b');
  assert.equal(deck.next().id, 'c');
  assert.equal(deck.stats().seen, 3);
  assert.equal(deck.next().id, 'd');
  assert.equal(deck.stats().complete, true);
  deck.previous();
  assert.equal(deck.stats().complete, true);
  assert.equal(deck.next().id, 'd');
  assert.equal(deck.next().newRound, true);
  assert.equal(deck.previous().position, 1);
});

test('reload restores order, coverage, review position, and round boundary', () => {
  const storage = memoryStorage();
  const deck = new DeckEngine(['a', 'b', 'c'], { storage, key: 'all', rng: () => 0.999 });
  deck.next(); deck.next(); deck.previous();
  const restored = new DeckEngine(['c', 'a', 'b'], { storage, key: 'all', rng: () => 0 });
  assert.equal(restored.current(), 'a');
  assert.equal(restored.stats().position, 1);
  assert.equal(restored.stats().seen, 2);
  assert.equal(restored.next().id, 'b');
  assert.equal(restored.next().id, 'c');
  const completed = new DeckEngine(['a', 'b', 'c'], { storage, key: 'all', rng: () => 0.999 });
  assert.equal(completed.stats().seen, 3);
  assert.equal(completed.stats().complete, true);
  const nextRound = completed.next();
  assert.equal(nextRound.round, 2);
  assert.equal(nextRound.newRound, true);
  assert.notEqual(nextRound.id, 'c');
});

test('different scope keys retain independent progress', () => {
  const storage = memoryStorage();
  const all = new DeckEngine(['a', 'b'], { storage, key: 'all', rng: () => 0.999 });
  all.next();
  const topic = new DeckEngine(['a'], { storage, key: 'topic' });
  topic.next(); topic.next();
  const restored = new DeckEngine(['a', 'b'], { storage, key: 'all' });
  assert.equal(restored.current(), 'a');
  assert.equal(restored.stats().round, 1);
  assert.equal(restored.stats().seen, 1);
});

test('a changed card set resets safely and never draws removed IDs', () => {
  const storage = memoryStorage();
  const original = new DeckEngine(['a', 'b', 'c'], { storage });
  original.next(); original.next();
  const changed = new DeckEngine(['a', 'b', 'd'], { storage, rng: () => 0.999 });
  assert.equal(changed.current(), null);
  assert.equal(changed.stats().seen, 0);
  assert.deepEqual([changed.next().id, changed.next().id, changed.next().id], ['a', 'b', 'd']);
});

test('malformed and internally inconsistent saved states recover to a fresh deck', () => {
  const storage = memoryStorage();
  const valid = {
    version: 1, ids: ['a', 'b'], round: 1,
    order: ['a', 'b'], seen: 1, cursor: 0,
  };
  const corruptions = [
    '{broken JSON', 'null', '[]',
    { ...valid, version: 99 },
    { ...valid, order: ['a', 'a'] },
    { ...valid, order: ['a', 'missing'] },
    { ...valid, order: ['a'] },
    { ...valid, seen: 3 },
    { ...valid, seen: 0, cursor: 0 },
    { ...valid, cursor: -1 },
    { ...valid, cursor: 1 },
    { ...valid, round: 0 },
    { ...valid, round: 1.5 },
  ];
  for (const corrupted of corruptions) {
    storage.setItem('test', typeof corrupted === 'string' ? corrupted : JSON.stringify(corrupted));
    const deck = new DeckEngine(['a', 'b'], { storage, key: 'test', rng: () => 0.999 });
    assert.equal(deck.current(), null);
    assert.equal(deck.stats().seen, 0);
    assert.equal(deck.next().id, 'a');
    assert.equal(deck.next().id, 'b');
  }
});

test('storage failures do not prevent navigation', () => {
  const storage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('full'); },
  };
  const deck = new DeckEngine(['a', 'b'], { storage, rng: () => 0.999 });
  assert.equal(deck.next().id, 'a');
  assert.equal(deck.next().id, 'b');
  assert.equal(deck.previous().id, 'a');
});

test('single-card deck completes each round and permits the necessary repeat', () => {
  const deck = new DeckEngine(['only'], { storage: null });
  assert.equal(deck.next().newRound, false);
  assert.equal(deck.stats().complete, true);
  for (let round = 2; round <= 5; round += 1) {
    const result = deck.next();
    assert.equal(result.id, 'only');
    assert.equal(result.round, round);
    assert.equal(result.newRound, true);
    assert.equal(result.seen, 1);
    assert.equal(result.complete, true);
  }
});

test('empty deck is stable, including after refresh', () => {
  const storage = memoryStorage();
  const deck = new DeckEngine([], { storage });
  for (const result of [deck.next(), deck.previous(), deck.next()]) {
    assert.equal(result.id, null);
    assert.equal(result.round, 0);
    assert.equal(result.position, 0);
    assert.equal(result.total, 0);
    assert.equal(result.seen, 0);
    assert.equal(result.complete, false);
    assert.equal(result.newRound, false);
  }
  const restored = new DeckEngine([], { storage });
  assert.deepEqual(restored.stats(), deck.stats());
});

test('duplicate input IDs become a unique deck and invalid IDs are rejected', () => {
  const deck = new DeckEngine(['a', 'a', 'b'], { storage: null, rng: () => 0.999 });
  assert.equal(deck.stats().total, 2);
  assert.equal(deck.next().id, 'a');
  assert.equal(deck.next().id, 'b');
  assert.throws(() => new DeckEngine(['a', null]), TypeError);
});

test('decisions preserve the current round and disappear from the next round', () => {
  const statuses = new Map();
  const deck = new DeckEngine(['a', 'b', 'c', 'd'], {
    storage: null, rng: () => 0.999, isEligible: id => !statuses.has(id),
  });
  assert.equal(deck.next().id, 'a');
  statuses.set('a', 'done');
  statuses.set('b', 'declined');
  assert.deepEqual([deck.next().id, deck.next().id, deck.next().id], ['b', 'c', 'd']);
  assert.equal(deck.stats().total, 4);
  const nextRound = deck.next();
  assert.equal(nextRound.newRound, true);
  assert.equal(nextRound.scopeTotal, 4);
  assert.equal(nextRound.total, 2);
  const drawn = [nextRound.id, deck.next().id];
  assert.deepEqual(drawn.sort(), ['c', 'd']);
});

test('restored subset rounds keep their history while decisions change', () => {
  const storage = memoryStorage();
  const eligible = new Set(['a', 'c']);
  const options = { storage, key: 'subset', rng: () => 0.999, isEligible: id => eligible.has(id) };
  const deck = new DeckEngine(['a', 'b', 'c'], options);
  deck.next(); deck.next(); deck.previous();
  eligible.clear();
  const restored = new DeckEngine(['a', 'b', 'c'], options);
  assert.equal(restored.current(), 'a');
  assert.equal(restored.stats().total, 2);
  assert.equal(restored.stats().seen, 2);
  assert.equal(restored.next().id, 'c');
  assert.equal(restored.next().id, null);
  assert.equal(restored.stats().round, 2);
  assert.equal(restored.stats().total, 0);
  assert.equal(restored.stats().scopeTotal, 3);
  assert.equal(restored.next().newRound, false);
  assert.equal(restored.stats().round, 2);
  eligible.add('b');
  assert.equal(restored.next().id, 'b');
  assert.equal(restored.stats().round, 2);
  assert.equal(restored.stats().complete, true);
});

test('clearing a decision restores eligibility at the next round boundary', () => {
  const eligible = new Set(['b', 'c']);
  const deck = new DeckEngine(['a', 'b', 'c'], {
    storage: null, rng: () => 0.999, isEligible: id => eligible.has(id),
  });
  assert.equal(deck.stats().round, 1);
  assert.equal(deck.stats().total, 2);
  deck.next();
  eligible.add('a');
  assert.equal(deck.next().id, 'c');
  assert.equal(deck.stats().total, 2);
  const next = deck.next();
  assert.equal(next.total, 3);
  assert.deepEqual([next.id, deck.next().id, deck.next().id].sort(), ['a', 'b', 'c']);
});

test('an initially exhausted scope can resume after a decision is cleared', () => {
  let available = false;
  const deck = new DeckEngine(['a'], { storage: null, isEligible: () => available });
  assert.equal(deck.stats().round, 1);
  assert.equal(deck.next().id, null);
  assert.equal(deck.stats().scopeTotal, 1);
  assert.equal(deck.stats().total, 0);
  available = true;
  assert.equal(deck.next().id, 'a');
  assert.equal(deck.stats().round, 1);
});

test('snapshot exposes the filtered pool without allowing callers to edit the deck', () => {
  const deck = new DeckEngine(['a', 'b'], { storage: null, isEligible: id => id === 'a' });
  const snapshot = deck.snapshot();
  assert.deepEqual(snapshot.order, ['a']);
  assert.equal(snapshot.scopeTotal, 2);
  assert.equal(snapshot.total, 1);
  snapshot.order.push('b');
  assert.deepEqual(deck.snapshot().order, ['a']);
});
