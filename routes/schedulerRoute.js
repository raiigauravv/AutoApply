const express = require('express');
const router = express.Router();
const scheduler = require('../scheduler');
const { EventEmitter } = require('events');

// SSE for scheduler events
const schedulerBus = new EventEmitter();
scheduler.on('fired', data => schedulerBus.emit('fired', data));

router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const onFired = d => send('fired', d);
  schedulerBus.on('fired', onFired);
  send('schedules', { schedules: scheduler.getAll(), nextRuns: scheduler.getNextRuns() });
  req.on('close', () => schedulerBus.off('fired', onFired));
});

router.get('/', (req, res) => {
  res.json({
    success: true,
    schedules: scheduler.getAll(),
    nextRuns: scheduler.getNextRuns(),
    log: scheduler.getLog(10)
  });
});

router.post('/', (req, res) => {
  const { name, type = 'scan', intervalDays = 3, categories, enabled = true } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const schedule = scheduler.add({ name, type, intervalDays, categories, enabled });
  res.json({ success: true, schedule });
});

router.patch('/:id', (req, res) => {
  const updated = scheduler.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Schedule not found' });
  res.json({ success: true, schedule: updated });
});

router.delete('/:id', (req, res) => {
  scheduler.remove(req.params.id);
  res.json({ success: true });
});

router.post('/:id/run-now', async (req, res) => {
  // Trigger immediate scan via pipeline
  const schedules = scheduler.getAll();
  const s = schedules.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  scheduler.emit('fired', { scheduleId: s.id, name: s.name, firedAt: new Date().toISOString(), manual: true });
  res.json({ success: true, message: 'Schedule fired manually' });
});

module.exports = router;
