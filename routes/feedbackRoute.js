const express = require('express');
const router = express.Router();
const { processFeedback, getLearned, getFeedbackStats } = require('../profileLearner');

router.post('/', async (req, res) => {
  try {
    const { evalResult, feedback, feedbackType } = req.body;
    if (!feedback) return res.status(400).json({ error: 'feedback text required' });
    const result = await processFeedback({ evalResult, feedback, feedbackType: feedbackType || 'custom' });
    res.json({ success: true, ...result });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/learned', (req, res) => {
  res.json({ success: true, profile: getLearned(), stats: getFeedbackStats() });
});

module.exports = router;
