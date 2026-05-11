const express = require('express');
const router = express.Router();
const { callClaude } = require('../claude');
const { getCV, getProfile } = require('../profile');
const { researchCompany } = require('../webSearch');

// Deep company research
router.post('/company', async (req, res) => {
  try {
    const { company, role } = req.body;
    const cv = getCV();

    // 🌐 Live web research — browse the internet first
    let liveContext = '';
    let sources = [];
    try {
      const webData = await researchCompany(company, role);
      liveContext = webData.context || '';
      sources = webData.sources || [];
    } catch (e) {
      liveContext = '(Live web research unavailable)';
    }

    const result = await callClaude(
      'You are a thorough company researcher for job seekers. You have been given LIVE web search results. Be specific and cite real facts from the web data provided.',
      `Research ${company} for a candidate applying for ${role || 'ML/AI role'}.

Candidate background: ${cv.substring(0, 800)}

${liveContext ? `LIVE WEB CONTEXT (fetched right now):\n${liveContext}\n\n` : ''}Provide:
1. Company overview (stage, funding, size, founded)
2. Tech stack signals (from job postings, tech blog, GitHub)
3. AI/ML maturity level (1-5 scale with reasoning)
4. Recent news / notable developments (cite dates from web data above)
5. Culture signals (glassdoor patterns, team LinkedIn, etc.)
6. Interview process (what's known publicly)
7. Personalization hooks (specific talking points for this candidate)
8. Red flags (if any)
9. Compensation range estimate (Toronto/remote)
10. Verdict: Strong / Moderate / Weak fit and why

Be specific. Use the live web data above — do NOT rely only on training data.`,
      2500
    );

    res.json({ success: true, research: result, sources, live_search: sources.length > 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Cold outreach generator
router.post('/outreach', async (req, res) => {
  try {
    const { company, role, contact_name, contact_title, jd } = req.body;
    const cv = getCV();
    const profile = getProfile();
    
    const result = await callClaude(
      'You are an expert at writing cold outreach emails for ML/AI job seekers. Use the proven framework: ≤7 word subject, warm intro + 3-4 measurable bullets + role link + CTA.',
      `Write a cold email and LinkedIn message for:
Company: ${company}
Role: ${role}
Contact: ${contact_name || 'Hiring Manager'} (${contact_title || 'Recruiter'})
JD snippet: ${jd?.substring(0, 500) || 'ML/AI role'}

Candidate CV: ${cv.substring(0, 1500)}

Format your response as:
## EMAIL SUBJECT
[subject here - max 7 words]

## EMAIL BODY
[email here]

## LINKEDIN MESSAGE
[connection message - max 300 chars]

## LINKEDIN INMAIL
[longer inmail if needed]

Rules:
- Subject: specific, professional, ≤7 words
- Bullet achievements must be quantified (use real numbers from CV)
- Reference something specific about the company
- Clear CTA
- No cringe. No "I am passionate about". Confident, direct tone.`,
      1500
    );
    
    res.json({ success: true, outreach: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// STAR interview stories
router.post('/star-stories', async (req, res) => {
  try {
    const { role, company, jd, count = 5 } = req.body;
    const cv = getCV();
    
    const result = await callClaude(
      'You are an expert interview coach specializing in ML/AI roles. Generate specific, quantified STAR stories.',
      `Generate ${count} STAR+Reflection interview stories for:
Role: ${role} at ${company}
JD context: ${jd?.substring(0, 800) || 'ML Engineer role'}

Candidate CV: ${cv.substring(0, 2000)}

For each story:
- Pick a real project/experience from the CV
- Map to a likely interview question
- Write full STAR (Situation, Task, Action, Result) 
- Add Reflection (what you learned / would do differently)
- Include relevant tech keywords from the JD
- Keep each story 150-200 words

Format:
## Story 1: [Question]
**Project:** [project name]
**Situation:** ...
**Task:** ...
**Action:** ...
**Result:** ...
**Reflection:** ...
**Keywords:** [kw1, kw2, kw3]

Cover: technical depth, leadership/ownership, failure/learning, collaboration, and impact at scale.`,
      2500
    );
    
    res.json({ success: true, stories: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Salary negotiation scripts
router.post('/negotiate', async (req, res) => {
  try {
    const { company, role, offer_amount, target_amount, competing_offers } = req.body;
    const profile = getProfile();
    
    const result = await callClaude(
      'You are an expert salary negotiation coach. Write specific, confident scripts.',
      `Generate salary negotiation scripts for:
Company: ${company}
Role: ${role}
Current offer: ${offer_amount || 'Unknown'}
Target: ${target_amount || '$95-110k CAD'}
Competing offers: ${competing_offers || 'Scale AI contract (active)'}
Profile: ${profile.substring(0, 400)}

Generate:
1. Counter-offer email (professional, confident)
2. Phone script for negotiation call
3. Handling "this is our best offer" pushback
4. Geographic discount pushback (if remote)
5. Leveraging competing offers/PGWP situation

Use the candidate's actual situation. Be specific, not generic.`,
      2000
    );
    
    res.json({ success: true, scripts: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Follow-up cadence
router.post('/followup', async (req, res) => {
  try {
    const { company, role, status, last_contact } = req.body;
    
    const result = await callClaude(
      'You are a job search strategist. Give specific, actionable follow-up advice.',
      `Generate a follow-up plan for:
Company: ${company}
Role: ${role}  
Current status: ${status}
Last contact: ${last_contact || 'Unknown'}

Provide:
1. When exactly to follow up (specific days)
2. What to say (exact template messages)
3. Channel (email vs LinkedIn)
4. What to do if ghosted
5. Red flag signals to watch for`,
      1000
    );
    
    res.json({ success: true, followup: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Certification / course evaluator
router.post('/training', async (req, res) => {
  try {
    const { cert_name, provider, cost, time_weeks, reason } = req.body;
    const cv = getCV();
    const profile = getProfile();

    const result = await callClaude(
      'You are a career strategist evaluating whether a certification is worth pursuing for a specific candidate. Be honest and specific.',
      `Evaluate this certification/course for the candidate:

Cert: ${cert_name}
Provider: ${provider || 'Unknown'}
Cost: ${cost || 'Unknown'}
Time to complete: ${time_weeks ? time_weeks + ' weeks' : 'Unknown'}
Reason candidate is considering: ${reason || 'Career advancement'}

Candidate CV: ${cv.substring(0, 1500)}
Profile: ${profile.substring(0, 300)}

Evaluate on these dimensions and return your response structured as:
## Verdict
[Strong Yes / Conditional Yes / No — with 1-sentence reason]

## ROI Analysis
[Time + cost vs. expected benefit]

## Market Signal
[Is this cert recognized by top employers hiring for this candidate's target roles?]

## Alternatives
[2-3 better ways to spend this time/money if applicable]

## Recommendation
[Specific action: take now / take later / skip / do project instead]

Be direct. Don't pad. Use real market knowledge.`,
      1200
    );

    res.json({ success: true, evaluation: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Portfolio project evaluator
router.post('/project', async (req, res) => {
  try {
    const { project_idea, tech_stack, time_weeks, goal } = req.body;
    const cv = getCV();
    const profile = getProfile();

    const result = await callClaude(
      'You are a senior engineering career advisor evaluating whether a portfolio project is worth building. Be strategic and specific.',
      `Evaluate this portfolio project idea for the candidate:

Project idea: ${project_idea}
Proposed tech stack: ${tech_stack || 'Not specified'}
Time estimate: ${time_weeks ? time_weeks + ' weeks' : 'Unknown'}
Goal: ${goal || 'Portfolio / job search'}

Candidate CV: ${cv.substring(0, 1500)}
Profile: ${profile.substring(0, 300)}

Evaluate and return structured as:
## Verdict
[Build it / Build a smaller version / Skip — with reason]

## Differentiation Score
[1-10: How unique is this vs. typical portfolios?]

## Hiring Signal
[Will this impress hiring managers at the candidate's target companies?]

## Gaps it fills
[What missing skills or gaps in the CV does this address?]

## Suggested Scope
[What's the MVP that maximizes signal per hour of effort?]

## Alternative ideas
[1-2 higher-signal projects if this one is weak]

Be opinionated. Target companies: AI labs, LLMOps startups, Toronto tech.`,
      1200
    );

    res.json({ success: true, evaluation: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

