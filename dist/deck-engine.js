/**
 * A persistent, shuffled deck of unique string IDs.
 *
 * `seen` counts distinct cards drawn in the current round. `position` is the
 * one-based position being viewed, so reviewing history does not reduce `seen`.
 * A completed round remains complete until next() starts another round.
 * Use a separate storage key for each filter scope.
 */
export class DeckEngine {
  constructor(ids, {
    storage,
    key = 'life-flashcards:deck:v1',
    rng = Math.random,
    isEligible = () => true,
  } = {}) {
    if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || id.length === 0)) {
      throw new TypeError('DeckEngine IDs must be an array of non-empty strings.');
    }
    this.ids = [...new Set(ids)];
    this.key = key;
    this.rng = typeof rng === 'function' ? rng : Math.random;
    this.isEligible = typeof isEligible === 'function' ? isEligible : () => true;
    this.storage = storage === undefined ? defaultStorage() : storage;
    this.fingerprint = [...this.ids].sort();
    this.idSet = new Set(this.ids);
    this.state = this.restore() || this.freshState();
    this.persist();
  }

  current() {
    return this.state.cursor >= 0 ? this.state.order[this.state.cursor] : null;
  }

  next() {
    if (this.ids.length === 0) return this.result(false);

    let newRound = false;
    if (this.state.order.length === 0) {
      // A previously empty pool can become available after a checkbox is cleared.
      const available = this.freshState(this.state.round);
      if (available.order.length === 0) return this.result(false);
      this.state = available;
      this.state.cursor = 0;
      this.state.seen = 1;
    } else if (this.state.cursor + 1 < this.state.seen) {
      // Revisit already drawn cards before extending this round's coverage.
      this.state.cursor += 1;
    } else if (this.state.seen < this.state.order.length) {
      this.state.cursor = this.state.seen;
      this.state.seen += 1;
    } else {
      const lastId = this.current();
      this.state = this.freshState(this.state.round + 1, lastId);
      if (this.state.order.length > 0) {
        this.state.cursor = 0;
        this.state.seen = 1;
      }
      newRound = true;
    }
    this.persist();
    return this.result(newRound);
  }

  previous() {
    if (this.state.cursor > 0) {
      this.state.cursor -= 1;
      this.persist();
    }
    return this.result(false);
  }

  stats() {
    const { round, cursor, seen } = this.state;
    const total = this.state.order.length;
    return {
      round,
      position: cursor + 1,
      total,
      scopeTotal: this.ids.length,
      seen,
      complete: total > 0 && seen === total,
      canPrevious: cursor > 0,
      canNextInHistory: cursor + 1 < seen,
    };
  }

  result(newRound) {
    return { id: this.current(), ...this.stats(), newRound };
  }

  snapshot() {
    return {
      id: this.current(),
      ...this.stats(),
      order: [...this.state.order],
      cursor: this.state.cursor,
    };
  }

  freshState(round = this.ids.length ? 1 : 0, lastId = null) {
    // Eligibility is sampled only at a round boundary. A checkbox never erases
    // cards or history from the round the user is currently exploring.
    const order = this.ids.filter(id => {
      try {
        return Boolean(this.isEligible(id));
      } catch {
        return false;
      }
    });
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    // Preserve a random order while avoiding an immediate cross-round repeat.
    if (order.length > 1 && order[0] === lastId) {
      const j = 1 + Math.floor(this.random() * (order.length - 1));
      [order[0], order[j]] = [order[j], order[0]];
    }
    return { version: 2, ids: this.fingerprint, round, order, seen: 0, cursor: -1 };
  }

  random() {
    try {
      const value = this.rng();
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1) {
        return value;
      }
    } catch {
      // A failed injected source should not break drawing cards.
    }
    return Math.random();
  }

  restore() {
    try {
      const state = JSON.parse(this.storage?.getItem(this.key) ?? 'null');
      if (!state || ![1, 2].includes(state.version) || !Array.isArray(state.ids)
        || JSON.stringify(state.ids) !== JSON.stringify(this.fingerprint)
        || !Array.isArray(state.order) || state.order.length > this.ids.length
        || (state.version === 1 && state.order.length !== this.ids.length)
        || new Set(state.order).size !== state.order.length
        || state.order.some(id => !this.idSet.has(id))
        || !Number.isSafeInteger(state.round)
        || (this.ids.length ? state.round < 1 : state.round !== 0)
        || !Number.isInteger(state.seen) || state.seen < 0 || state.seen > state.order.length
        || !Number.isInteger(state.cursor)
        || (state.seen === 0 ? state.cursor !== -1 : state.cursor < 0 || state.cursor >= state.seen)) {
        return null;
      }
      return {
        version: 2, ids: this.fingerprint, round: state.round,
        order: [...state.order], seen: state.seen, cursor: state.cursor,
      };
    } catch {
      return null;
    }
  }

  persist() {
    try {
      this.storage?.setItem(this.key, JSON.stringify(this.state));
    } catch {
      // Continue in memory when browser storage is unavailable or full.
    }
  }
}

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export default DeckEngine;
