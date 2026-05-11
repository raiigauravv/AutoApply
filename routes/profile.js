const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

router.get('/', (req, res) => {
  const cvPath = path.join(ROOT, 'cv.md');
  const profilePath = path.join(ROOT, 'config', 'profile.yml');
  
  res.json({
    cv: fs.existsSync(cvPath) ? fs.readFileSync(cvPath, 'utf8') : null,
    profile: fs.existsSync(profilePath) ? fs.readFileSync(profilePath, 'utf8') : null,
    cv_exists: fs.existsSync(cvPath),
    profile_exists: fs.existsSync(profilePath)
  });
});

router.post('/cv', (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'No content' });
  fs.writeFileSync(path.join(ROOT, 'cv.md'), content);
  res.json({ success: true });
});

router.post('/profile', (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'No content' });
  const configDir = path.join(ROOT, 'config');
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir);
  fs.writeFileSync(path.join(configDir, 'profile.yml'), content);
  res.json({ success: true });
});

// List generated outputs
router.get('/outputs', (req, res) => {
  const outputDir = path.join(ROOT, 'output');
  const reportsDir = path.join(ROOT, 'reports');
  
  const outputs = fs.existsSync(outputDir) 
    ? fs.readdirSync(outputDir).map(f => ({ file: f, type: 'pdf', path: `/api/pdf/download/${f}` }))
    : [];
  const reports = fs.existsSync(reportsDir)
    ? fs.readdirSync(reportsDir).filter(f => f.endsWith('.json')).map(f => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(reportsDir, f), 'utf8'));
          return { file: f, company: data.company, role: data.role, grade: data.grade, date: data.evaluated_at };
        } catch(e) { return { file: f }; }
      })
    : [];

  res.json({ outputs, reports });
});

module.exports = router;
