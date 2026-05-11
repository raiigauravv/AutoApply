const express = require('express');
const router = express.Router();
const { callClaude, parseJSON } = require('../claude');
const { getCV, getProfile } = require('../profile');
const fs = require('fs');
const path = require('path');

const SYSTEM = `You are autoapply batch evaluator. Evaluate multiple job descriptions simultaneously.
For each JD, produce a concise structured evaluation. JSON only, no markdown.`;

// Evaluate multiple JDs in parallel (like batch-runner.sh with parallel workers)
router.post('/run', async (req, res) => {
  try {
    const { jds } = req.body; // Array of {id, text} or {id, url}
    if (!jds || !Array.isArray(jds) || jds.length === 0) {
      return res.status(400).json({ error: 'Send array of JDs: [{id, text}]' });
    }
    if (jds.length > 20) {
      return res.status(400).json({ error: 'Max 20 JDs per batch' });
    }

    const cv = getCV();
    const profile = getProfile();

    // Run up to 5 evaluations in parallel (like the batch worker architecture)
    const CONCURRENCY = 5;
    const results = [];
    const errors = [];

    for (let i = 0; i < jds.length; i += CONCURRENCY) {
      const chunk = jds.slice(i, i + CONCURRENCY);
      const promises = chunk.map(async (jd) => {
        try {
          const prompt = `
CV: ${cv.substring(0, 2000)}
PROFILE: ${profile.substring(0, 500)}
JD: ${jd.text?.substring(0, 2000) || 'No text provided'}

Return JSON for this one JD:
{
  "id": "${jd.id}",
  "company": "company name",
  "role": "role title",
  "score": "4.2",
  "grade": "B+",
  "grade_letter": "b",
  "cv_match_pct": 75,
  "apply_recommendation": "Yes",
  "apply_reason": "max 10 words",
  "top_keywords": ["kw1","kw2","kw3"],
  "main_gap": "biggest gap in one sentence",
  "archetype": "LLMOps/DataScience/MLEngineer/Other"
}`;
          const raw = await callClaude(SYSTEM, prompt, 800);
          const result = parseJSON(raw);
          return { ...result, id: jd.id, status: 'success' };
        } catch (e) {
          return { id: jd.id, status: 'error', error: e.message };
        }
      });

      const chunkResults = await Promise.allSettled(promises);
      chunkResults.forEach(r => {
        if (r.status === 'fulfilled') results.push(r.value);
        else errors.push(r.reason?.message || 'Unknown error');
      });
    }

    // Sort by score descending
    const successful = results.filter(r => r.status === 'success');
    successful.sort((a, b) => parseFloat(b.score || 0) - parseFloat(a.score || 0));

    // Save batch results
    const batchId = Date.now();
    const batchPath = path.join(__dirname, '..', 'data', `batch_${batchId}.json`);
    fs.writeFileSync(batchPath, JSON.stringify({ batchId, results: successful, errors, timestamp: new Date().toISOString() }, null, 2));

    res.json({
      success: true,
      batch_id: batchId,
      total: jds.length,
      evaluated: successful.length,
      errors: errors.length,
      results: successful,
      top_pick: successful[0] || null
    });
  } catch (e) {
    console.error('Batch error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/history', (req, res) => {
  const dataDir = path.join(__dirname, '..', 'data');
  const batches = fs.readdirSync(dataDir)
    .filter(f => f.startsWith('batch_'))
    .map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
        return { file: f, batchId: data.batchId, timestamp: data.timestamp, count: data.results?.length || 0 };
      } catch(e) { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => b.batchId - a.batchId);
  res.json({ success: true, batches });
});

module.exports = router;
