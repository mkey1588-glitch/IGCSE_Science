/** Tiny event bus used for decoupled game systems (quests, mastery, UI). */
export class Emitter {
  constructor() { this.map = new Map(); }
  on(evt, fn) {
    if (!this.map.has(evt)) this.map.set(evt, new Set());
    this.map.get(evt).add(fn);
    return () => this.off(evt, fn);
  }
  once(evt, fn) { const off = this.on(evt, (...a) => { off(); fn(...a); }); return off; }
  off(evt, fn) { this.map.get(evt)?.delete(fn); }
  emit(evt, ...args) {
    const set = this.map.get(evt);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(...args); } catch (e) { console.error(`[bus] handler for "${evt}" failed`, e); }
    }
  }
}
export const bus = new Emitter();
