const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const QUEUE_FILE = path.join(__dirname, 'data', 'queue.json');

class JobQueue extends EventEmitter {
  constructor() {
    super();
    this.processing = false;
    this.currentJob = null;
    this.workers = 0;
    this.MAX_WORKERS = 3;
  }

  load() {
    if (!fs.existsSync(QUEUE_FILE)) return [];
    try { return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')); }
    catch(e) { return []; }
  }

  save(queue) {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
  }

  add(jobs) {
    const queue = this.load();
    let added = 0;
    for (const job of (Array.isArray(jobs) ? jobs : [jobs])) {
      const exists = queue.find(q => q.url === job.url || q.id === job.id);
      if (!exists) {
        queue.push({
          id: job.id || ('q_' + Date.now() + '_' + Math.random().toString(36).substr(2,5)),
          url: job.url || '',
          title: job.title || '',
          company: job.company || '',
          jd: job.jd || '',
          status: 'pending',
          added: new Date().toISOString(),
          started: null,
          completed: null,
          result: null,
          error: null,
          retries: 0
        });
        added++;
      }
    }
    this.save(queue);
    return { added, total: queue.length };
  }

  getPending() {
    return this.load().filter(j => j.status === 'pending');
  }

  getAll() {
    return this.load();
  }

  getStats() {
    const q = this.load();
    return {
      total: q.length,
      pending: q.filter(j => j.status === 'pending').length,
      processing: q.filter(j => j.status === 'processing').length,
      completed: q.filter(j => j.status === 'completed').length,
      failed: q.filter(j => j.status === 'failed').length,
    };
  }

  markProcessing(id) {
    const q = this.load();
    const job = q.find(j => j.id === id);
    if (job) { job.status = 'processing'; job.started = new Date().toISOString(); }
    this.save(q);
  }

  markCompleted(id, result) {
    const q = this.load();
    const job = q.find(j => j.id === id);
    if (job) {
      job.status = 'completed';
      job.completed = new Date().toISOString();
      job.result = result;
    }
    this.save(q);
    this.emit('job_completed', { id, result });
  }

  markFailed(id, error) {
    const q = this.load();
    const job = q.find(j => j.id === id);
    if (job) {
      job.retries = (job.retries || 0) + 1;
      if (job.retries >= 3) {
        job.status = 'failed';
        job.error = error;
      } else {
        job.status = 'pending'; // retry
      }
    }
    this.save(q);
    this.emit('job_failed', { id, error });
  }

  clear(status = 'all') {
    if (status === 'all') { this.save([]); return; }
    const q = this.load().filter(j => j.status !== status);
    this.save(q);
  }

  remove(id) {
    const q = this.load().filter(j => j.id !== id);
    this.save(q);
  }
}

module.exports = new JobQueue(); // singleton
