require('dotenv').config();
// Node 18+ has native fetch; polyfill for older versions
if (!globalThis.fetch) {
  globalThis.fetch = require('node-fetch');
}
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Landing page at root (MUST be before express.static)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'landing.html')));

// App at /app
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Static assets (index:false prevents auto-serving index.html for /)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Ensure dirs exist
['data','output','reports','config'].forEach(d => {
  const p = path.join(__dirname, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// Core routes
app.use('/api/evaluate', require('./routes/evaluate'));
app.use('/api/pdf',      require('./routes/pdf'));
app.use('/api/scan',     require('./routes/scan'));
app.use('/api/tracker',  require('./routes/tracker'));
app.use('/api/batch',    require('./routes/batch'));
app.use('/api/research', require('./routes/research'));
app.use('/api/profile',  require('./routes/profile'));
app.use('/api/apply',    require('./routes/apply'));

// New v3 routes
app.use('/api/pipeline',  require('./routes/pipelineRoute'));
app.use('/api/scheduler', require('./routes/schedulerRoute'));
app.use('/api/feedback',  require('./routes/feedbackRoute'));
app.use('/api/portals',   require('./routes/portals'));
app.use('/api/liveness',  require('./routes/liveness'));
app.use('/api/patterns',  require('./routes/patterns'));
app.use('/api/followup',  require('./routes/followup'));
app.use('/api/latex',     require('./routes/latex'));

// Scan history stats
app.get('/api/history/stats', (req, res) => {
  const { getStats } = require('./scanHistory');
  res.json({ success: true, stats: getStats() });
});

// App at /app — already registered above
// (kept here as comment for clarity)

// SPA fallback for all other routes (API 404s excluded)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3773;
app.listen(PORT, () => {
  console.log(`\n  AutoApply v3 → http://localhost:${PORT}`);
  console.log(`  API key: ${process.env.ANTHROPIC_API_KEY ? '✓ set' : '✗ NOT SET — add to .env'}\n`);

  // Boot scheduler
  const scheduler = require('./scheduler');
  scheduler.boot();

  // Wire scheduler fired events to auto-scan
  scheduler.on('fired', async (event) => {
    console.log(`  [Scheduler] Firing: ${event.name}`);
    try {
      const res2 = await fetch(`http://localhost:${PORT}/api/scan/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addToQueue: true, newOnly: true })
      });
      const data = await res2.json();
      console.log(`  [Scheduler] Scan done: ${data.new_this_scan} new jobs found`);
      // Auto-start pipeline if new jobs queued
      if ((data.new_this_scan || 0) > 0) {
        const pipeline = require('./pipeline');
        pipeline.start();
      }
    } catch(e) { console.error('  [Scheduler] scan error:', e.message); }
  });
});
