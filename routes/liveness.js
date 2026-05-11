/**
 * liveness.js — Job posting liveness checker
 * Mirrors: check-liveness.mjs + liveness-core.mjs from santifer/autoapply
 * Uses HTTP fetch to check if a job URL is still active.
 * Signals: "Apply" button text = active. 404 / "position filled" / "no longer available" = closed.
 */
const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');

// Closed signals — if these appear in the page, the job is gone
const CLOSED_SIGNALS = [
  'position has been filled',
  'no longer accepting',
  'job is no longer available',
  'this posting has expired',
  'posting is closed',
  'no longer available',
  'position filled',
  'job has been filled',
  'application is closed',
  'expired',
  'this position has been closed',
  'we are not currently hiring',
  'posting has been removed',
];

// Active signals — presence of these strongly indicates job is open
const ACTIVE_SIGNALS = [
  'apply now',
  'apply for this job',
  'submit application',
  'apply to this job',
  'apply for this position',
  '<button.*apply',
  'greenhouse.io',
  'lever.co/apply',
  'jobs.ashbyhq.com',
];

function fetchPage(url) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const mod = parsedUrl.protocol === 'https:' ? https : http;
      const req = mod.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      }, (res) => {
        // Follow redirects
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          return fetchPage(res.headers.location).then(resolve);
        }
        if (res.statusCode === 404) {
          return resolve({ status: 404, body: '', url });
        }
        let body = '';
        res.on('data', chunk => { body += chunk; if (body.length > 80000) req.destroy(); });
        res.on('end', () => resolve({ status: res.statusCode, body: body.toLowerCase(), url }));
      });
      req.on('error', () => resolve({ status: 0, body: '', url }));
      req.setTimeout(12000, () => { req.destroy(); resolve({ status: 0, body: '', url }); });
    } catch (e) {
      resolve({ status: 0, body: '', url });
    }
  });
}

function checkLiveness(url, body, statusCode) {
  if (statusCode === 404 || statusCode === 410) {
    return { alive: false, confidence: 'high', signal: '404 Not Found' };
  }
  if (statusCode === 0) {
    return { alive: null, confidence: 'unknown', signal: 'Could not reach URL' };
  }

  // Check for closed signals FIRST — they win
  for (const signal of CLOSED_SIGNALS) {
    if (body.includes(signal)) {
      return { alive: false, confidence: 'high', signal: `Closed signal: "${signal}"` };
    }
  }

  // Check for active signals
  for (const signal of ACTIVE_SIGNALS) {
    if (body.includes(signal.replace('<button.*apply', '').toLowerCase())) {
      return { alive: true, confidence: 'high', signal: `Active signal: "${signal}"` };
    }
  }

  // Greenhouse/Lever/Ashby APIs return JSON — if we got a 200 with job content, it's likely active
  if (statusCode === 200 && body.length > 500) {
    return { alive: true, confidence: 'medium', signal: 'Page returned content (200 OK)' };
  }

  return { alive: null, confidence: 'low', signal: 'Inconclusive — verify manually' };
}

// POST /api/liveness/check — check one or many URLs
router.post('/check', async (req, res) => {
  try {
    const { urls, url } = req.body;
    const targets = urls || (url ? [url] : []);
    if (!targets.length) return res.status(400).json({ error: 'Provide url or urls array' });

    const results = await Promise.all(
      targets.map(async (u) => {
        const { status, body, url: finalUrl } = await fetchPage(u);
        const liveness = checkLiveness(u, body, status);
        return {
          url: u,
          final_url: finalUrl !== u ? finalUrl : undefined,
          http_status: status,
          ...liveness,
          checked_at: new Date().toISOString(),
        };
      })
    );

    const alive = results.filter(r => r.alive === true).length;
    const closed = results.filter(r => r.alive === false).length;
    const unknown = results.filter(r => r.alive === null).length;

    res.json({
      success: true,
      summary: { total: results.length, alive, closed, unknown },
      results,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/liveness/tracker — check all tracked applications with URLs
router.get('/tracker', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const TRACKER_FILE = path.join(__dirname, '../data/applications.json');
    const apps = fs.existsSync(TRACKER_FILE) ? JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8')) : [];

    const withUrls = apps.filter(a => a.url && ['new', 'applied', 'phone_screen', 'interview'].includes(a.status));
    if (!withUrls.length) return res.json({ success: true, message: 'No active applications with URLs to check', results: [] });

    const results = await Promise.all(
      withUrls.map(async (app) => {
        const { status, body } = await fetchPage(app.url);
        const liveness = checkLiveness(app.url, body, status);
        return {
          id: app.id,
          company: app.company,
          role: app.role,
          url: app.url,
          app_status: app.status,
          ...liveness,
          checked_at: new Date().toISOString(),
        };
      })
    );

    res.json({ success: true, results, total_checked: results.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
