const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const TRACKER_FILE = path.join(__dirname, '..', 'data', 'applications.json');

function load() {
  if (!fs.existsSync(TRACKER_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8')); }
  catch (e) { return []; }
}

function save(apps) {
  fs.writeFileSync(TRACKER_FILE, JSON.stringify(apps, null, 2));
}

// Canonical statuses matching autoapply states.yml
const VALID_STATUSES = ['new','applied','phone_screen','interview','final_round','offer','rejected','ghosted','withdrawn'];

router.get('/', (req, res) => {
  const apps = load();
  res.json({ success: true, applications: apps, total: apps.length });
});

router.post('/add', (req, res) => {
  const apps = load();
  const { company, role, grade, grade_letter, score, url, jd_snippet, status = 'new', eval_result } = req.body;
  
  // Dedup by company+role
  const exists = apps.find(a => 
    a.company?.toLowerCase() === company?.toLowerCase() && 
    a.role?.toLowerCase() === role?.toLowerCase()
  );
  if (exists) {
    return res.json({ success: false, message: 'Already tracked', existing: exists });
  }

  const app = {
    id: Date.now(),
    company: company || 'Unknown',
    role: role || 'Unknown',
    grade: grade || '—',
    grade_letter: grade_letter || 'c',
    score: score || '—',
    url: url || '',
    jd_snippet: jd_snippet || '',
    status,
    added: new Date().toISOString(),
    updated: new Date().toISOString(),
    notes: '',
    eval_result: eval_result || null,
    followup_date: null,
    interview_date: null
  };

  apps.unshift(app);
  save(apps);
  res.json({ success: true, application: app });
});

router.patch('/:id', (req, res) => {
  const apps = load();
  const idx = apps.findIndex(a => a.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  
  const { status, notes, followup_date, interview_date } = req.body;
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Use: ${VALID_STATUSES.join(', ')}` });
  }
  
  apps[idx] = { 
    ...apps[idx], 
    ...(status && { status }),
    ...(notes !== undefined && { notes }),
    ...(followup_date && { followup_date }),
    ...(interview_date && { interview_date }),
    updated: new Date().toISOString()
  };
  save(apps);
  res.json({ success: true, application: apps[idx] });
});

router.delete('/:id', (req, res) => {
  const apps = load();
  const filtered = apps.filter(a => a.id != req.params.id);
  save(filtered);
  res.json({ success: true });
});

router.get('/stats', (req, res) => {
  const apps = load();
  const stats = {
    total: apps.length,
    by_status: {},
    by_grade: {},
    avg_score: 0,
    response_rate: 0
  };
  
  apps.forEach(a => {
    stats.by_status[a.status] = (stats.by_status[a.status] || 0) + 1;
    stats.by_grade[a.grade_letter] = (stats.by_grade[a.grade_letter] || 0) + 1;
  });

  const responded = apps.filter(a => ['phone_screen','interview','final_round','offer'].includes(a.status)).length;
  const applied = apps.filter(a => a.status !== 'new').length;
  stats.response_rate = applied > 0 ? Math.round((responded / applied) * 100) : 0;
  
  res.json({ success: true, stats });
});

module.exports = router;
