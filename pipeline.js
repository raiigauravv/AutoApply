const queue = require('./jobQueue');
const { callClaude, parseJSON } = require('./claude');
const { getCV, getProfile } = require('./profile');
const { updateGrade } = require('./scanHistory');
const { EventEmitter } = require('events');

class Pipeline extends EventEmitter {
  constructor() {
    super();
    this.running = false;
    this.concurrency = 3;
    this.activeWorkers = 0;
    this.stats = { processed: 0, failed: 0, startedAt: null };
  }

  async start() {
    if (this.running) return { message: 'Pipeline already running' };
    this.running = true;
    this.stats = { processed: 0, failed: 0, startedAt: new Date().toISOString() };
    this.emit('started', this.stats);
    this._drain();
    return { message: 'Pipeline started', pending: queue.getPending().length };
  }

  stop() {
    this.running = false;
    this.emit('stopped', this.stats);
    return { message: 'Pipeline stopped', stats: this.stats };
  }

  async _drain() {
    while (this.running) {
      const pending = queue.getPending();
      if (pending.length === 0) {
        this.running = false;
        this.emit('completed', this.stats);
        break;
      }

      // Fill up to concurrency limit
      const available = this.concurrency - this.activeWorkers;
      const batch = pending.slice(0, available);

      if (batch.length === 0) {
        await sleep(500);
        continue;
      }

      batch.forEach(job => this._processJob(job));
      await sleep(300);
    }
  }

  async _processJob(job) {
    this.activeWorkers++;
    queue.markProcessing(job.id);
    this.emit('job_started', { id: job.id, company: job.company, title: job.title });

    try {
      const result = await evaluateJob(job);
      queue.markCompleted(job.id, result);
      if (result.grade_letter) updateGrade(job.url, result.grade);
      this.stats.processed++;
      this.emit('job_done', { id: job.id, company: job.company, grade: result.grade });
    } catch(e) {
      queue.markFailed(job.id, e.message);
      this.stats.failed++;
      this.emit('job_error', { id: job.id, error: e.message });
    } finally {
      this.activeWorkers--;
    }
  }

  getStatus() {
    return {
      running: this.running,
      workers: this.activeWorkers,
      stats: this.stats,
      queue: queue.getStats()
    };
  }
}

async function evaluateJob(job) {
  const cv = getCV();
  const profile = getProfile();
  const jdText = job.jd || job.title + ' at ' + job.company;

  const prompt = `
CV: ${cv.substring(0, 2500)}
PROFILE: ${profile.substring(0, 400)}
JD: ${jdText.substring(0, 2500)}

Evaluate this job. Return ONLY JSON:
{
  "company": "${job.company || 'Unknown'}",
  "role": "${job.title || 'Unknown'}",
  "score": "4.2",
  "grade": "B+",
  "grade_letter": "b",
  "cv_match_pct": 75,
  "skill_coverage_pct": 78,
  "apply_recommendation": "Yes",
  "apply_reason": "max 10 words",
  "archetype": "MLEngineer",
  "keywords": ["kw1","kw2","kw3"],
  "main_gap": "one sentence",
  "strategy": "one sentence application strategy"
}`;

  const raw = await callClaude(
    'You are autoapply pipeline evaluator. JSON only, no markdown.',
    prompt, 800
  );
  return parseJSON(raw);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = new Pipeline(); // singleton
