const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, 'data', 'scan-history.tsv');
const HEADERS = ['url','title','company','location','source','first_seen','last_seen','eval_grade','status'];

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return new Map();
  const lines = fs.readFileSync(HISTORY_FILE, 'utf8').split('\n').filter(Boolean);
  const map = new Map();
  lines.slice(1).forEach(line => { // skip header
    const cols = line.split('\t');
    if (cols[0]) map.set(normalizeURL(cols[0]), {
      url: cols[0], title: cols[1], company: cols[2],
      location: cols[3], source: cols[4], first_seen: cols[5],
      last_seen: cols[6], eval_grade: cols[7], status: cols[8] || 'new'
    });
  });
  return map;
}

function saveHistory(map) {
  const lines = [HEADERS.join('\t')];
  for (const entry of map.values()) {
    lines.push([
      entry.url, entry.title, entry.company, entry.location,
      entry.source, entry.first_seen, entry.last_seen,
      entry.eval_grade || '', entry.status || 'new'
    ].join('\t'));
  }
  fs.writeFileSync(HISTORY_FILE, lines.join('\n'));
}

function normalizeURL(url) {
  try {
    const u = new URL(url);
    return (u.hostname + u.pathname).replace(/\/$/, '').toLowerCase();
  } catch(e) { return url.toLowerCase().trim(); }
}

// Add or update entries, return { added, skipped }
function upsertJobs(jobs) {
  const history = loadHistory();
  let added = 0, skipped = 0;
  const now = new Date().toISOString().substring(0, 10);

  for (const job of jobs) {
    const key = normalizeURL(job.url || job.id || '');
    if (!key) continue;
    if (history.has(key)) {
      // Update last_seen only
      const existing = history.get(key);
      existing.last_seen = now;
      history.set(key, existing);
      skipped++;
    } else {
      history.set(key, {
        url: job.url || '', title: job.title || '', company: job.company || job.portal_name || '',
        location: job.location || '', source: job.source || '',
        first_seen: now, last_seen: now, eval_grade: '', status: 'new'
      });
      added++;
    }
  }
  saveHistory(history);
  return { added, skipped, total: history.size };
}

function isKnown(url) {
  const history = loadHistory();
  return history.has(normalizeURL(url));
}

function filterNew(jobs) {
  const history = loadHistory();
  return jobs.filter(j => !history.has(normalizeURL(j.url || j.id || '')));
}

function updateGrade(url, grade) {
  const history = loadHistory();
  const key = normalizeURL(url);
  if (history.has(key)) {
    const entry = history.get(key);
    entry.eval_grade = grade;
    history.set(key, entry);
    saveHistory(history);
  }
}

function getStats() {
  const history = loadHistory();
  const entries = Array.from(history.values());
  return {
    total: entries.length,
    graded: entries.filter(e => e.eval_grade).length,
    by_grade: entries.reduce((acc, e) => {
      if (e.eval_grade) acc[e.eval_grade] = (acc[e.eval_grade] || 0) + 1;
      return acc;
    }, {}),
    by_source: entries.reduce((acc, e) => {
      acc[e.source || 'unknown'] = (acc[e.source || 'unknown'] || 0) + 1;
      return acc;
    }, {}),
    recent: entries.filter(e => e.first_seen === new Date().toISOString().substring(0,10)).length
  };
}

module.exports = { loadHistory, upsertJobs, filterNew, isKnown, updateGrade, getStats, normalizeURL };
