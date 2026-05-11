const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const SCHEDULE_FILE = path.join(__dirname, 'data', 'schedule.json');

class Scheduler extends EventEmitter {
  constructor() {
    super();
    this.timers = new Map();
    this.log = [];
  }

  load() {
    if (!fs.existsSync(SCHEDULE_FILE)) return [];
    try { return JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8')); }
    catch(e) { return []; }
  }

  save(schedules) {
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedules, null, 2));
  }

  getAll() { return this.load(); }

  add({ name, type, intervalDays = 3, categories = [], enabled = true }) {
    const schedules = this.load();
    const id = 'sched_' + Date.now();
    const schedule = {
      id, name, type, intervalDays, categories, enabled,
      created: new Date().toISOString(),
      lastRun: null,
      nextRun: calcNextRun(intervalDays),
      runCount: 0
    };
    schedules.push(schedule);
    this.save(schedules);
    if (enabled) this._arm(schedule);
    return schedule;
  }

  update(id, patch) {
    const schedules = this.load();
    const idx = schedules.findIndex(s => s.id === id);
    if (idx === -1) return null;
    schedules[idx] = { ...schedules[idx], ...patch };
    if ('enabled' in patch || 'intervalDays' in patch) {
      this._disarm(id);
      if (schedules[idx].enabled) this._arm(schedules[idx]);
    }
    this.save(schedules);
    return schedules[idx];
  }

  remove(id) {
    this._disarm(id);
    const schedules = this.load().filter(s => s.id !== id);
    this.save(schedules);
  }

  _arm(schedule) {
    this._disarm(schedule.id);
    const msUntilNext = Math.max(0, new Date(schedule.nextRun) - Date.now());
    const timer = setTimeout(async () => {
      await this._fire(schedule.id);
      // Re-arm for next interval
      const updated = this.load().find(s => s.id === schedule.id);
      if (updated?.enabled) this._arm({ ...updated, nextRun: calcNextRun(updated.intervalDays) });
    }, msUntilNext);
    this.timers.set(schedule.id, timer);
  }

  _disarm(id) {
    if (this.timers.has(id)) {
      clearTimeout(this.timers.get(id));
      this.timers.delete(id);
    }
  }

  async _fire(id) {
    const schedules = this.load();
    const schedule = schedules.find(s => s.id === id);
    if (!schedule || !schedule.enabled) return;

    const now = new Date().toISOString();
    const logEntry = { scheduleId: id, name: schedule.name, firedAt: now, type: schedule.type };
    this.log.push(logEntry);

    this.emit('fired', logEntry);

    // Update schedule metadata
    const idx = schedules.findIndex(s => s.id === id);
    schedules[idx].lastRun = now;
    schedules[idx].nextRun = calcNextRun(schedule.intervalDays);
    schedules[idx].runCount = (schedules[idx].runCount || 0) + 1;
    this.save(schedules);
  }

  // Boot: re-arm all enabled schedules on server start
  boot() {
    const schedules = this.load();
    let armed = 0;
    for (const s of schedules) {
      if (s.enabled) { this._arm(s); armed++; }
    }
    if (armed > 0) console.log(`  Scheduler: ${armed} schedule(s) armed`);
    return armed;
  }

  getLog(limit = 20) {
    return this.log.slice(-limit).reverse();
  }

  getNextRuns() {
    return this.load().filter(s => s.enabled).map(s => ({
      id: s.id, name: s.name,
      nextRun: s.nextRun,
      msUntil: Math.max(0, new Date(s.nextRun) - Date.now())
    })).sort((a, b) => a.msUntil - b.msUntil);
  }
}

function calcNextRun(days) {
  const d = new Date();
  d.setDate(d.getDate() + (days || 3));
  return d.toISOString();
}

module.exports = new Scheduler();
