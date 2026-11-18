// תור אירועים מקומי ושליחה לשרת Apps Script. אירועים נשמרים בדפדפן עד אישור קבלה מהשרת.
const KEY = 'hive-geology-u1-event-queue';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12));

export class Tracker {
  constructor(config) {
    this.config = config; this.queue = read(); this.sending = false; this.retry = 0; this.timer = null; this.lastError = ''; this.lastAck = null;
    window.addEventListener('online', () => this.flush());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.flush(); });
    this.flush();
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.queue)); } catch {} }
  enqueue(session, kind, detail = {}) {
    if (!session || session.teacher) return null;
    const e = { eventId: uid(), sessionId: session.id, version: this.config.version, name: session.name, startedAt: session.startedAt, at: new Date().toISOString(), kind, screen: session.screen + 1, ...detail };
    this.queue.push(e); this.save(); this.flush(); return e;
  }
  async flush() {
    if (this.sending || !this.queue.length || !navigator.onLine || !this.config.scriptUrl) return;
    this.sending = true; const batch = this.queue.slice(0, 12);
    try {
      const res = await fetch(this.config.scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ events: batch }) });
      if (!res.ok) throw Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.acknowledged)) throw Error(data.error || 'no ack');
      const ack = new Set(data.acknowledged);
      this.queue = read().filter(e => !ack.has(e.eventId)); // קריאה מחדש — ייתכן שנוספו אירועים בזמן השליחה
      this.save(); this.lastAck = new Date().toISOString(); this.lastError = ''; this.retry = 0;
    } catch (err) { this.lastError = String(err.message || err); this.retry = Math.min(this.retry + 1, 6); }
    finally {
      this.sending = false; clearTimeout(this.timer);
      if (this.queue.length) this.timer = setTimeout(() => this.flush(), this.retry ? Math.min(60000, 1500 * 2 ** this.retry) : 0);
    }
  }
}
export { uid };
