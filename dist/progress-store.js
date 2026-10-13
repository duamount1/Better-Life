/** Shared card decisions and lifetime progress, independent of shuffle scopes. */
export class ProgressStore {
  constructor(cards, { storage, key = 'life-cards:progress:v2', todoKey = 'life-cards:todo:v1' } = {}) {
    if (!Array.isArray(cards) || cards.some(card => !card || typeof card.id !== 'string' || !card.id)) {
      throw new TypeError('ProgressStore cards must have non-empty string IDs.');
    }
    this.cards = [...new Map(cards.map(card => [card.id, card])).values()];
    this.cardById = new Map(this.cards.map(card => [card.id, card]));
    this.topics = new Map();
    for (const card of this.cards) {
      const id = card.categoryId || card.category || 'uncategorized';
      if (!this.topics.has(id)) {
        this.topics.set(id, { id, name: card.category || '未分类', ids: [] });
      }
      this.topics.get(id).ids.push(card.id);
    }
    this.storage = storage === undefined ? defaultStorage() : storage;
    this.key = key;
    this.todoKey = todoKey;
    const restored = this.restore();
    this.statuses = new Map(restored?.statuses || []);
    this.todos = new Set(this.restoreTodo());
    // A separately saved todo survives older clients rewriting the main progress key.
    for (const id of this.todos) this.statuses.delete(id);
    this.viewed = new Set(restored?.viewed || []);
    this.reportEvents = new Set(restored?.reportEvents || []);
    this.name = restored?.name || '';
    if (!restored) this.migrateLegacyViews();
    this.persist();
  }

  status(id) {
    return this.statuses.get(id) || 'pending';
  }

  isTodo(id) {
    return this.todos.has(id);
  }

  setTodo(id, enabled) {
    if (typeof enabled !== 'boolean') throw new TypeError('Todo selection must be a boolean.');
    if (!this.cardById.has(id)) return { todo: false };
    if (enabled) {
      this.statuses.delete(id);
      this.todos.add(id);
    } else {
      this.todos.delete(id);
    }
    this.persist();
    return { todo: this.isTodo(id) };
  }

  setStatus(id, status) {
    if (!['pending', 'declined', 'done'].includes(status)) {
      throw new TypeError('Card status must be pending, declined, or done.');
    }
    if (!this.cardById.has(id)) return { newlyGoldenTopics: [] };
    const topic = this.topicForCard(id);
    const wasGold = this.isGolden(topic);
    if (status === 'pending') this.statuses.delete(id);
    else {
      this.statuses.set(id, status);
      this.todos.delete(id);
    }
    const newlyGoldenTopics = !wasGold && this.isGolden(topic) ? [topic.id] : [];
    this.persist();
    return { newlyGoldenTopics };
  }

  markViewed(id) {
    const wasAllViewed = this.allViewed();
    if (!this.cardById.has(id)) {
      return { newlyCompletedTopics: [], allViewed: wasAllViewed, newlyAllViewed: false };
    }
    const topic = this.topicForCard(id);
    const wasCompleted = this.isViewed(topic);
    this.viewed.add(id);
    const allViewed = this.allViewed();
    const newlyCompletedTopics = !wasCompleted && this.isViewed(topic) ? [topic.id] : [];
    this.persist();
    return { newlyCompletedTopics, allViewed, newlyAllViewed: !wasAllViewed && allViewed };
  }

  summary() {
    const topics = [...this.topics.values()].map(topic => {
      const total = topic.ids.length;
      const viewed = topic.ids.filter(id => this.viewed.has(id)).length;
      const done = topic.ids.filter(id => this.status(id) === 'done').length;
      const declined = topic.ids.filter(id => this.status(id) === 'declined').length;
      const todo = topic.ids.filter(id => this.isTodo(id)).length;
      const pending = total - done - declined;
      return { id: topic.id, name: topic.name, total, viewed, done, declined, todo, pending, gold: pending === 0 };
    });
    const total = this.cards.length;
    const viewed = this.viewed.size;
    const done = [...this.statuses.values()].filter(status => status === 'done').length;
    const declined = this.statuses.size - done;
    return {
      total,
      viewed,
      done,
      declined,
      todo: this.todos.size,
      pending: total - done - declined,
      index: total ? Math.round((viewed / total * 0.3 + done / total * 0.7) * 100) : 0,
      topics,
      goldCount: topics.filter(topic => topic.gold).length,
      name: this.name,
    };
  }

  claimReport(eventKey) {
    if (typeof eventKey !== 'string' || !eventKey.trim() || this.reportEvents.has(eventKey)) return false;
    this.reportEvents.add(eventKey);
    this.persist();
    return true;
  }

  getName() {
    return this.name;
  }

  setName(name) {
    this.name = typeof name === 'string' ? name.trim() : '';
    this.persist();
    return this.name;
  }

  topicForCard(id) {
    const card = this.cardById.get(id);
    return this.topics.get(card.categoryId || card.category || 'uncategorized');
  }

  isGolden(topic) {
    return topic.ids.every(id => this.status(id) !== 'pending');
  }

  isViewed(topic) {
    return topic.ids.every(id => this.viewed.has(id));
  }

  allViewed() {
    return this.cards.length > 0 && this.viewed.size === this.cards.length;
  }

  restore() {
    try {
      const state = JSON.parse(this.storage?.getItem(this.key) ?? 'null');
      if (!state || state.version !== 2 || !state.statuses || typeof state.statuses !== 'object'
        || Array.isArray(state.statuses) || !Array.isArray(state.viewed)
        || !Array.isArray(state.reportEvents) || typeof state.name !== 'string') return null;
      return {
        statuses: Object.entries(state.statuses).filter(([id, status]) => this.cardById.has(id) && ['declined', 'done'].includes(status)),
        viewed: state.viewed.filter(id => this.cardById.has(id)),
        reportEvents: state.reportEvents.filter(event => typeof event === 'string' && event.trim()),
        name: state.name,
      };
    } catch {
      return null;
    }
  }

  restoreTodo() {
    try {
      const state = JSON.parse(this.storage?.getItem(this.todoKey) ?? 'null');
      if (!state || state.version !== 1 || !Array.isArray(state.ids)) return [];
      return state.ids.filter(id => typeof id === 'string' && this.cardById.has(id));
    } catch {
      return [];
    }
  }

  migrateLegacyViews() {
    const scopes = new Set(['all', ...this.cards.map(card => card.category).filter(Boolean)]);
    for (const scope of scopes) {
      try {
        const state = JSON.parse(this.storage?.getItem(`life-cards:deck:v1:${scope}`) ?? 'null');
        if (!state || state.version !== 1 || !Array.isArray(state.order)
          || !Number.isInteger(state.seen) || state.seen < 0 || state.seen > state.order.length) continue;
        for (const id of state.order.slice(0, state.seen)) {
          if (this.cardById.has(id)) this.viewed.add(id);
        }
      } catch {
        // One damaged or unavailable scope does not discard the others.
      }
    }
  }

  persist() {
    try {
      this.storage?.setItem(this.todoKey, JSON.stringify({ version: 1, ids: [...this.todos] }));
    } catch {
      // Todo and progress saves are independent; either can still succeed.
    }
    try {
      this.storage?.setItem(this.key, JSON.stringify({
        version: 2,
        statuses: Object.fromEntries(this.statuses),
        viewed: [...this.viewed],
        reportEvents: [...this.reportEvents],
        name: this.name,
      }));
    } catch {
      // All features remain usable in memory when local storage is unavailable.
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

export default ProgressStore;
