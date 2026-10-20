// Optimistic, isolated in-memory transaction fixture; not a live CloudBase database.
class MemoryDB {
  constructor() { this.records = {}; this.version = 0; this.conflicts = 0; this.failWrite = false; }
  async runTransaction(fn) {
    for (let retry = 0; retry < 10; retry++) {
      const start = this.version;
      const snapshot = structuredClone(this.records);
      const tx = { collection: name => ({ doc: id => ({
        get: async () => ({ data: snapshot[name]?.[id] || null }),
        set: async ({ data }) => {
          if (this.failWrite) throw new Error('write unavailable');
          snapshot[name] ||= {}; snapshot[name][id] = { ...structuredClone(data), _id: id };
        }
      }) }) };
      const result = await fn(tx);
      if (this.version !== start) { this.conflicts++; continue; }
      this.records = snapshot; this.version++; return result;
    }
    throw new Error('Transaction retry limit');
  }
}
module.exports = { MemoryDB };
