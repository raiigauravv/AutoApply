/**
 * followup.js — Follow-up cadence calculator
 * Mirrors: followup-cadence.mjs from santifer/autoapply
 * Calculates follow-up dates and generates follow-up messages on the right cadence.
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { callClaude } = require('../claude');
const { getCV } = require('../profile');

const TRACKER_FILE = path.join(__dirname, '../data/applications.json');
const FOLLOWUP_FILE = path.join(__dirname, '../data/followups.json');

function loadApps() {
  if (!fs.existsSync(TRACKER_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8')); } catch { return []; }
}

function loadFollowups() {
  if (!fs.existsSync(FOLLOWUP_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(FOLLOWUP_FILE, 'utf8')); } catch { return []; }
}

function saveFollowups(data) {
  fs.writeFileSync(FOLLOWUP_FILE, JSON.stringify(data, null, 2));
}

function addBusinessDays(date, days) {
  let d = new Date(date);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++; // Skip weekends
  }
  return d;
}

function formatDate(d) {
  return d.toISOString().substring(0, 10);
}

// Cadence rules matching santifer/autoapply followup-cadence.mjs
const CADENCE = {
  applied:      [{ day: 5,  action: 'email',    label: 'First follow-up email (Day 5)' },
                 { day: 12, action: 'linkedin',  label: 'LinkedIn connect (Day 12)' },
                 { day: 21, action: 'final',     label: 'Final check-in or move on (Day 21)' }],
  phone_screen: [{ day: 3,  action: 'email',    label: 'Thank you + next steps (Day 3)' },
                 { day: 10, action: 'email',    label: 'Status check-in (Day 10)' }],
  interview:    [{ day: 1,  action: 'email',    label: 'Thank you note (Day 1)' },
                 { day: 7,  action: 'email',    label: 'Status follow-up (Day 7)' },
                 { day: 14, action: 'final',    label: 'Final check-in (Day 14)' }],
  final_round:  [{ day: 1,  action: 'email',    label: 'Thank you note (Day 1)' },
                 { day: 5,  action: 'email',    label: 'Status check-in (Day 5)' }],
};

// GET /api/followup/due — get all applications with due follow-ups
router.get('/due', (req, res) => {
  try {
    const apps = loadApps();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = [];

    for (const app of apps) {
      if (!['applied', 'phone_screen', 'interview', 'final_round'].includes(app.status)) continue;

      const statusDate = new Date(app.updated || app.added);
      const cadence = CADENCE[app.status] || [];

      for (const step of cadence) {
        const dueDate = addBusinessDays(statusDate, step.day);
        dueDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((today - dueDate) / 86400000);

        if (daysDiff >= 0 && daysDiff <= 7) { // Due today or overdue up to 7 days
          due.push({
            app_id: app.id,
            company: app.company,
            role: app.role,
            url: app.url,
            app_status: app.status,
            action: step.action,
            label: step.label,
            due_date: formatDate(dueDate),
            days_overdue: daysDiff,
            urgent: daysDiff > 3,
          });
          break; // Only surface the next pending step
        }
      }
    }

    // Sort by most overdue first
    due.sort((a, b) => b.days_overdue - a.days_overdue);

    res.json({ success: true, due, total: due.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/followup/schedule — full cadence schedule for all tracked apps
router.get('/schedule', (req, res) => {
  try {
    const apps = loadApps();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const schedule = [];

    for (const app of apps) {
      if (!['applied', 'phone_screen', 'interview', 'final_round'].includes(app.status)) continue;

      const statusDate = new Date(app.updated || app.added);
      const cadence = CADENCE[app.status] || [];
      const steps = cadence.map(step => {
        const dueDate = addBusinessDays(statusDate, step.day);
        dueDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((today - dueDate) / 86400000);
        return {
          ...step,
          due_date: formatDate(dueDate),
          status: daysDiff > 0 ? 'overdue' : daysDiff === 0 ? 'due_today' : 'upcoming',
          days_until: daysDiff < 0 ? Math.abs(daysDiff) : 0,
          days_overdue: daysDiff > 0 ? daysDiff : 0,
        };
      });

      schedule.push({
        app_id: app.id,
        company: app.company,
        role: app.role,
        app_status: app.status,
        since: formatDate(new Date(app.updated || app.added)),
        steps,
      });
    }

    res.json({ success: true, schedule });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/followup/generate — generate follow-up message with AI
router.post('/generate', async (req, res) => {
  try {
    const { company, role, status, action, contact_name, url } = req.body;
    if (!company || !role) return res.status(400).json({ error: 'company and role required' });
    const cv = getCV();

    const actionGuide = {
      email: 'a concise, professional follow-up email (max 5 sentences)',
      linkedin: 'a LinkedIn connection request message (max 3 sentences, very brief)',
      final: 'a polite final check-in email that also signals you may move on',
    };

    const raw = await callClaude(
      'You are an expert at professional follow-up communication. Be concise, warm, and specific. Never sound desperate.',
      `Write ${actionGuide[action] || 'a follow-up email'} for this job application:

Company: ${company}
Role: ${role}
Application Status: ${status}
Contact: ${contact_name || 'Hiring Manager'}
Candidate background: ${cv.substring(0, 500)}
${url ? `Job URL: ${url}` : ''}

Format your response as:
## SUBJECT (for email) or CONNECTION NOTE TITLE
[subject line]

## MESSAGE
[the message body]

Keep it under 100 words total. Reference the specific role. End with a clear, non-pushy CTA.`,
      600
    );

    // Log to followups file
    const followups = loadFollowups();
    followups.unshift({
      id: Date.now(),
      company,
      role,
      action,
      status,
      generated_at: new Date().toISOString(),
      message: raw,
    });
    if (followups.length > 200) followups.pop();
    saveFollowups(followups);

    res.json({ success: true, message: raw, action, company, role });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/followup/history — list past follow-ups
router.get('/history', (req, res) => {
  res.json({ success: true, followups: loadFollowups().slice(0, 50) });
});

module.exports = router;
