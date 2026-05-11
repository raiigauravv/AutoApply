/**
 * patterns.js — Rejection pattern analysis
 * Mirrors: analyze-patterns.mjs from santifer/autoapply
 * Reads full tracker history, runs LLM analysis to identify WHY rejections happen.
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { callClaude } = require('../claude');
const { getCV, getProfile } = require('../profile');

const TRACKER_FILE = path.join(__dirname, '../data/applications.json');

function loadApps() {
  if (!fs.existsSync(TRACKER_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8')); } catch { return []; }
}

// POST /api/patterns/analyze — full pattern analysis like analyze-patterns.mjs
router.post('/analyze', async (req, res) => {
  try {
    const apps = loadApps();
    if (apps.length < 3) {
      return res.json({ success: false, message: 'Need at least 3 tracked applications for pattern analysis.' });
    }

    const cv = getCV();
    const profile = getProfile();

    // Build a structured summary of all applications for the LLM
    const trackerSummary = apps.map(a => ({
      company: a.company,
      role: a.role,
      grade: a.grade,
      score: a.score,
      status: a.status,
      added: a.added?.substring(0, 10),
      notes: a.notes || '',
    }));

    const rejected = apps.filter(a => ['rejected', 'ghosted'].includes(a.status));
    const progressed = apps.filter(a => ['phone_screen', 'interview', 'final_round', 'offer'].includes(a.status));
    const applied = apps.filter(a => a.status === 'applied');

    const raw = await callClaude(
      `You are a career coach and data analyst. Analyze job search patterns to identify what's working and what's failing. Be brutally honest and specific. Output structured markdown.`,
      `## Candidate Profile
${profile.substring(0, 600)}

## Full Application Tracker (${apps.length} entries)
${JSON.stringify(trackerSummary, null, 2)}

## Summary Stats
- Total tracked: ${apps.length}
- Applied: ${applied.length}
- Rejected/Ghosted: ${rejected.length}
- Progressed to interview+: ${progressed.length}
- Response rate: ${applied.length > 0 ? Math.round((progressed.length / applied.length) * 100) : 0}%

## Your Task
Analyze this job search data and produce a report with these exact sections:

### 🔍 Pattern Analysis
What patterns do you see across rejections vs. progressions? (seniority mismatch, location, stack, company size, etc.)

### ❌ Top 3 Rejection Reasons
List the 3 most likely reasons applications aren't converting, with specific evidence from the data.

### ✅ What's Working
What roles/companies/types are producing the best results? What should the candidate do MORE of?

### 📊 Grade Distribution Insight
Are they applying to roles above/below their fit level? Is grade inflation/deflation happening?

### 🎯 Targeting Recommendations
Specific changes to make to the search strategy (different companies, roles, seniority levels, locations, etc.)

### 🚀 Immediate Actions (Top 3)
The 3 highest-impact things to do THIS WEEK to improve results.`,
      2500
    );

    res.json({
      success: true,
      analysis: raw,
      stats: {
        total: apps.length,
        applied: applied.length,
        rejected: rejected.length,
        progressed: progressed.length,
        response_rate: applied.length > 0 ? Math.round((progressed.length / applied.length) * 100) : 0,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/patterns/stats — quick stats without LLM
router.get('/stats', (req, res) => {
  try {
    const apps = loadApps();
    const byStatus = {};
    const byGrade = {};
    const byCompanySize = {};

    apps.forEach(a => {
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;
      if (a.grade_letter) byGrade[a.grade_letter] = (byGrade[a.grade_letter] || 0) + 1;
    });

    const applied = apps.filter(a => a.status !== 'new').length;
    const progressed = apps.filter(a => ['phone_screen', 'interview', 'final_round', 'offer'].includes(a.status)).length;
    const rejected = apps.filter(a => ['rejected', 'ghosted'].includes(a.status)).length;

    res.json({
      success: true,
      stats: {
        total: apps.length,
        by_status: byStatus,
        by_grade: byGrade,
        applied,
        progressed,
        rejected,
        response_rate: applied > 0 ? Math.round((progressed / applied) * 100) : 0,
        ghost_rate: applied > 0 ? Math.round((apps.filter(a => a.status === 'ghosted').length / applied) * 100) : 0,
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
