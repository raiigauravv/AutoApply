const express = require('express');
const router = express.Router();
const { callClaude, parseJSON } = require('../claude');
const { getCV, getProfile, getArticleDigest } = require('../profile');
const { getLearned } = require('../profileLearner');
const { updateGrade } = require('../scanHistory');
const fs = require('fs');
const path = require('path');

const SYSTEM = `You are autoapply. Evaluate job descriptions against a candidate CV.
Return ONLY a single valid JSON object. No markdown. No explanation. No text before or after the JSON.`;

router.post('/', async (req, res) => {
  try {
    const { jd, mode = 'full' } = req.body;
    if (!jd || jd.trim().length < 20) return res.status(400).json({ error: 'Job description too short' });

    const cv = getCV();
    const profile = getProfile();
    const learned = getLearned();
    const digest = getArticleDigest();

    const langIns = req.body.language ? `\nCRITICAL: Output all summaries, notes, strategy, and gaps in ${req.body.language}. Adapt employment vocabulary to this language/market (e.g., if German use DACH terms, if French use Francophone terms).` : '';
    const prompt = `CV:\n${cv.substring(0, 2000)}\n\nPROFILE:\n${profile.substring(0, 300)}\n${learned ? '\nLEARNED:\n'+learned.substring(0,300) : ''}${digest ? '\nPROOF POINTS:\n'+digest.substring(0,500) : ''}\n\nJD:\n${jd.substring(0, 3000)}\n${langIns}\n\nReturn ONLY this JSON with no extra text:\n{"company":"name","role":"title","archetype":"MLEngineer","score":"4.2","grade":"B+","grade_letter":"b","cv_match_pct":78,"skill_coverage_pct":82,"apply_recommendation":"Yes","apply_reason":"10 words max","legitimacy_tier":"Tier 1 (High) / Tier 2 (Standard) / Tier 3 (Suspect) / Tier 4 (Ghost/Fake)","legitimacy_reason":"Why","summary":"2 sentence summary","cv_match_notes":"what matches","gaps":"key gaps","strategy":"1 sentence","comp_range":"Unknown","keywords":["kw1","kw2","kw3"],"interview_angles":["a1","a2"],"star_story_hooks":["h1","h2"],"dimensions":[{"label":"Technical fit","score":8},{"label":"Role level","score":7}],"red_flags":[],"green_flags":[]}`;

    const raw = await callClaude(SYSTEM, prompt, 8000);
    const result = parseJSON(raw);

    const id = Date.now();
    result.id = id;
    result.evaluated_at = new Date().toISOString();
    result.jd_snippet = jd.substring(0, 200);

    const reportPath = path.join(__dirname, '..', 'reports', `eval_${id}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));

    if (req.body.url && result.grade) updateGrade(req.body.url, result.grade);

    res.json({ success: true, result });
  } catch(e) {
    console.error('Evaluate error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/report', async (req, res) => {
  try {
    const { evalResult } = req.body;
    const cv = getCV();
    const prompt = `Generate a detailed markdown job application report for:\nCompany: ${evalResult?.company}\nRole: ${evalResult?.role}\nScore: ${evalResult?.score} (${evalResult?.grade})\n\nCV excerpt:\n${cv.substring(0, 1500)}\n\nEval data:\n${JSON.stringify(evalResult)}\n\nSections: Role Summary, CV Match, Gaps, Strategy, Interview Prep (3 STAR stories), Application Checklist.`;
    const report = await callClaude('You generate detailed job application reports in markdown.', prompt, 6000);
    res.json({ success: true, report });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});


router.get('/recent', (req, res) => {
  try {
    const reportsDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(reportsDir)) return res.json({ success: true, reports: [] });
    const files = fs.readdirSync(reportsDir)
      .filter(f => f.startsWith('eval_') && f.endsWith('.json'))
      .sort().reverse().slice(0, 10);
    const reports = files.map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(reportsDir, f), 'utf8')); }
      catch(e) { return null; }
    }).filter(Boolean);
    res.json({ success: true, reports });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

