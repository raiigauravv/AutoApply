const express = require('express');
const router = express.Router();
const { callClaude, parseJSON } = require('../claude');
const { getProfile } = require('../profile');
const { upsertJobs, filterNew, getStats: getHistoryStats } = require('../scanHistory');
const queue = require('../jobQueue');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// ─── Load portals from YAML (with fallback) ───────────────
const PORTALS_FILE = path.join(__dirname, '../config/portals.yml');

function loadPortalsMap() {
  try {
    const raw = yaml.load(fs.readFileSync(PORTALS_FILE, 'utf8'));
    const flat = {};
    for (const [catKey, cat] of Object.entries(raw.categories || {})) {
      flat[catKey] = cat.portals || [];
    }
    return flat;
  } catch (e) {
    // Hardcoded fallback
    return {
      ai_labs: [
        { name: 'Anthropic',    slug: 'anthropic',    type: 'greenhouse' },
        { name: 'Pinecone',     slug: 'pinecone',     type: 'greenhouse' },
        { name: 'Hugging Face', slug: 'huggingface',  type: 'lever'      },
      ],
    };
  }
}

// ─── Fetch helpers ────────────────────────────────────────
function fetchJSON(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    }, (res) => {
      if ([301, 302, 303].includes(res.statusCode) && res.headers.location) {
        return fetchJSON(res.headers.location).then(resolve);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
  });
}

function stripHTML(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── ATS Scrapers ─────────────────────────────────────────
async function scrapeGreenhouse(slug) {
  const data = await fetchJSON(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
  if (!data?.jobs) return [];
  return data.jobs.map(j => ({
    id: String(j.id), title: j.title, company: slug,
    location: j.location?.name || 'Unknown', url: j.absolute_url,
    content: stripHTML(j.content || '').substring(0, 600),
    posted: j.updated_at, source: 'greenhouse'
  }));
}

async function scrapeLever(slug) {
  const data = await fetchJSON(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  if (!Array.isArray(data)) return [];
  return data.map(j => ({
    id: j.id, title: j.text, company: slug,
    location: j.categories?.location || 'Unknown', url: j.hostedUrl,
    content: stripHTML((j.description || '') + ' ' + (j.lists || []).map(l => l.content).join(' ')).substring(0, 600),
    posted: new Date(j.createdAt).toISOString(), source: 'lever', team: j.categories?.team || ''
  }));
}

async function scrapeAshby(slug) {
  const data = await fetchJSON(`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`);
  if (!data?.jobPostings) return [];
  return data.jobPostings.map(j => ({
    id: j.id, title: j.title, company: slug,
    location: j.locationName || (j.isRemote ? 'Remote' : 'Unknown'),
    url: j.jobUrl || `https://jobs.ashbyhq.com/${slug}/${j.id}`,
    content: (j.descriptionPlain || '').substring(0, 600),
    posted: j.publishedDate, source: 'ashby'
  }));
}

async function scrapeWorkday(companyId) {
  // Workday jobs API — uses their standard jobs listing endpoint
  // Format: https://[company].wd5.myworkdayjobs.com/wday/cxs/[company]/[jobsite]/jobs
  const workdaySites = {
    nvidia:      'https://nvidia.wd5.myworkdayjobs.com/wday/cxs/nvidia/NVIDIAExternalCareerSite/jobs',
    salesforce:  'https://salesforce.wd12.myworkdayjobs.com/wday/cxs/salesforce/External_Career_Site/jobs',
    servicenow:  'https://jobs.smartrecruiters.com/ServiceNow',
    snowflake:   'https://snowflake.wd5.myworkdayjobs.com/wday/cxs/snowflake/SnowflakeCareerPage/jobs',
    workiva:     'https://workiva.wd5.myworkdayjobs.com/wday/cxs/workiva/Workiva/jobs',
  };

  const url = workdaySites[companyId];
  if (!url) return [];

  try {
    // Workday uses a POST to their jobs search endpoint
    return new Promise((resolve) => {
      const body = JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: 'machine learning' });
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const jobs = (parsed.jobPostings || []).map(j => ({
              id: j.externalPath || j.bulletFields?.[0] || String(Math.random()),
              title: j.title,
              company: companyId,
              location: j.locationsText || 'Unknown',
              url: `https://${parsedUrl.hostname}${j.externalPath}`,
              content: (j.briefDescription || j.jobDescription || '').substring(0, 600),
              posted: j.postedOn || new Date().toISOString(),
              source: 'workday'
            }));
            resolve(jobs);
          } catch (e) { resolve([]); }
        });
      });
      req.on('error', () => resolve([]));
      req.setTimeout(10000, () => { req.destroy(); resolve([]); });
      req.write(body);
      req.end();
    });
  } catch (e) {
    return [];
  }
}

async function scrapeSmartRecruiters(companyId) {
  const data = await fetchJSON(`https://api.smartrecruiters.com/v1/companies/${companyId}/postings?limit=100&department=Engineering`);
  if (!data?.content) return [];
  return data.content.map(j => ({
    id: j.id,
    title: j.name,
    company: companyId,
    location: j.location ? `${j.location.city || ''} ${j.location.country || ''}`.trim() : 'Unknown',
    url: `https://careers.smartrecruiters.com/${companyId}/${j.id}`,
    content: (j.jobAd?.sections?.jobDescription?.text || '').replace(/<[^>]+>/g, ' ').substring(0, 600),
    posted: j.createdOn,
    source: 'smartrecruiters'
  }));
}

// ─── Relevance filter ─────────────────────────────────────
const ML_KEYWORDS = [
  'machine learning', 'ml engineer', 'ai engineer', 'data scientist', 'llm', 'nlp',
  'deep learning', 'mlops', 'python', 'pytorch', 'tensorflow', 'langchain', 'rag',
  'generative ai', 'applied ai', 'research engineer', 'data engineer', 'large language',
  'foundation model', 'fine-tun', 'vector', 'embedding', 'inference', 'neural', 'transformer',
  'reinforcement', 'multimodal', 'diffusion', 'computer vision', 'recommendation', 'ranking'
];

function isRelevant(job) {
  const text = (job.title + ' ' + job.content + ' ' + (job.team || '')).toLowerCase();
  return ML_KEYWORDS.some(kw => text.includes(kw));
}

// ─── Main scan endpoint ───────────────────────────────────
router.post('/run', async (req, res) => {
  try {
    const PORTALS = loadPortalsMap();
    const { categories = Object.keys(PORTALS), filterRelevantOnly = true, addToQueue = false, newOnly = true } = req.body;

    const tasks = [];
    for (const cat of categories) {
      for (const portal of (PORTALS[cat] || [])) {
        let scraper;
        if (portal.type === 'greenhouse') scraper = scrapeGreenhouse(portal.slug);
        else if (portal.type === 'lever')      scraper = scrapeLever(portal.slug);
        else if (portal.type === 'ashby')      scraper = scrapeAshby(portal.ashbySlug || portal.slug);
        else if (portal.type === 'workday')    scraper = scrapeWorkday(portal.workdayId || portal.slug);
        else if (portal.type === 'smartrecruiters') scraper = scrapeSmartRecruiters(portal.slug);
        else scraper = Promise.resolve([]);

        tasks.push(scraper
          .then(jobs => ({ portal, jobs: jobs || [] }))
          .catch(() => ({ portal, jobs: [] }))
        );
      }
    }

    const settled = await Promise.all(tasks);
    let allJobs = []; let totalScanned = 0;
    for (const { portal, jobs } of settled) {
      totalScanned += jobs.length;
      const relevant = filterRelevantOnly ? jobs.filter(isRelevant) : jobs;
      relevant.forEach(j => {
        j.portal_name = portal.name;
        j.category = categories.find(c => (PORTALS[c] || []).includes(portal)) || 'other';
      });
      allJobs.push(...relevant);
    }

    // Filter new BEFORE upserting so we capture actual new ones
    const newJobs = newOnly ? filterNew(allJobs) : allJobs;
    const { added, skipped } = upsertJobs(allJobs);

    let scored = newJobs;
    if (newJobs.length > 0 && newJobs.length <= 30) {
      try {
        const profile = getProfile();
        const raw = await callClaude(
          'Score job relevance 0-10. Return JSON array only.',
          `Score relevance (0-10) for ML Engineer Toronto PGWP candidate.\nProfile: ${profile.substring(0, 300)}\nJobs: ${JSON.stringify(newJobs.map(j => ({ id: j.id, title: j.title, company: j.portal_name, location: j.location })))}\nReturn: [{"id":"...","relevance_score":8,"apply_signal":"reason"}]`,
          800
        );
        const scores = JSON.parse(raw.replace(/```[a-z]*/g, '').replace(/```/g, '').trim());
        const map = {};
        scores.forEach(s => map[s.id] = s);
        scored = newJobs.map(j => ({ ...j, ...(map[j.id] || {}) })).sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
      } catch (e) { /* scoring optional */ }
    }

    if (addToQueue && scored.length > 0) {
      const toQ = scored.filter(j => (j.relevance_score || 0) >= 7).slice(0, 20);
      if (toQ.length) queue.add(toQ.map(j => ({ id: j.id, url: j.url, title: j.title, company: j.portal_name, jd: j.content })));
    }

    res.json({
      success: true,
      total_scanned: totalScanned,
      total_relevant: allJobs.length,
      new_this_scan: newJobs.length,
      already_seen: skipped,
      portals_checked: settled.length,
      history_total: getHistoryStats().total,
      jobs: scored,
      scan_time: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/portals', (req, res) => {
  const PORTALS = loadPortalsMap();
  res.json({ portals: PORTALS });
});

router.get('/history', (req, res) => res.json({ success: true, stats: getHistoryStats() }));

module.exports = router;
