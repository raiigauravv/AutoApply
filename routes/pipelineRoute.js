const express = require('express');
const router = express.Router();
const pipeline = require('../pipeline');
const queue = require('../jobQueue');

// SSE stream for real-time pipeline updates
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const onStarted  = d => send('started', d);
  const onDone     = d => send('job_done', d);
  const onError    = d => send('job_error', d);
  const onComplete = d => send('completed', d);
  const onStopped  = d => send('stopped', d);

  pipeline.on('started',   onStarted);
  pipeline.on('job_done',  onDone);
  pipeline.on('job_error', onError);
  pipeline.on('completed', onComplete);
  pipeline.on('stopped',   onStopped);

  // Send current status immediately
  send('status', pipeline.getStatus());

  req.on('close', () => {
    pipeline.off('started',   onStarted);
    pipeline.off('job_done',  onDone);
    pipeline.off('job_error', onError);
    pipeline.off('completed', onComplete);
    pipeline.off('stopped',   onStopped);
  });
});

router.post('/start', async (req, res) => {
  const result = await pipeline.start();
  res.json({ success: true, ...result });
});

router.post('/stop', (req, res) => {
  res.json({ success: true, ...pipeline.stop() });
});

router.get('/status', (req, res) => {
  res.json({ success: true, ...pipeline.getStatus() });
});

// Queue management
router.get('/queue', (req, res) => {
  res.json({ success: true, jobs: queue.getAll(), stats: queue.getStats() });
});

router.post('/queue/add', (req, res) => {
  const { jobs } = req.body;
  if (!jobs || !Array.isArray(jobs)) return res.status(400).json({ error: 'Send {jobs: [...]}' });
  const result = queue.add(jobs);
  res.json({ success: true, ...result });
});

router.delete('/queue/:id', (req, res) => {
  queue.remove(req.params.id);
  res.json({ success: true });
});

router.post('/queue/clear', (req, res) => {
  const { status = 'completed' } = req.body;
  queue.clear(status);
  res.json({ success: true });
});

module.exports = router;
