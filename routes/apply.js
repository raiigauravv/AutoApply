const express = require('express');
const router = express.Router();
const { callClaude, parseJSON } = require('../claude');
const { getCV, getProfile } = require('../profile');
const https = require('https');
const http = require('http');

// ─── FETCH PAGE HTML ──────────────────────────────────
async function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 12000
    }, (res) => {
      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        return fetchPage(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout fetching URL')); });
  });
}

// ─── DETECT ATS TYPE ──────────────────────────────────
function detectATS(url) {
  if (!url) return 'unknown';
  if (url.includes('greenhouse.io') || url.includes('boards.greenhouse')) return 'greenhouse';
  if (url.includes('lever.co')) return 'lever';
  if (url.includes('ashbyhq.com') || url.includes('jobs.ashbyhq')) return 'ashby';
  if (url.includes('workday.com') || url.includes('myworkdayjobs')) return 'workday';
  if (url.includes('linkedin.com/jobs')) return 'linkedin';
  if (url.includes('wellfound.com') || url.includes('angel.co')) return 'wellfound';
  if (url.includes('workable.com')) return 'workable';
  return 'generic';
}

// ─── EXTRACT FORM FIELDS FROM HTML ───────────────────
async function extractFormFields(html, url, atsType) {
  // Use Claude to parse the form structure from HTML
  const truncated = html.substring(0, 8000); // First 8k chars usually has the form
  
  const prompt = `You are parsing an ATS job application form HTML to extract all required fields.

ATS type: ${atsType}
URL: ${url}

HTML snippet:
${truncated}

Extract ALL form fields from this application form. Return ONLY this JSON:
{
  "fields": [
    {
      "id": "field_id_or_name",
      "label": "human readable label",
      "type": "text|email|phone|textarea|select|checkbox|file|url|date",
      "required": true,
      "options": ["option1","option2"],
      "placeholder": "placeholder if any",
      "section": "Basic Info|Work Experience|Education|Cover Letter|Custom Questions|Legal|Documents"
    }
  ],
  "has_cover_letter": true,
  "has_resume_upload": true,
  "has_work_auth": true,
  "detected_questions": ["any custom screening questions found in HTML"]
}

Be thorough — include every visible field. For select/radio fields, include the options array.`;

  try {
    const raw = await callClaude('You extract form fields from HTML. JSON only.', prompt, 1500);
    return parseJSON(raw);
  } catch(e) {
    // Fallback: return standard ATS fields based on type
    return getStandardFields(atsType);
  }
}

// ─── STANDARD FIELD TEMPLATES PER ATS ────────────────
function getStandardFields(atsType) {
  const base = [
    { id: 'first_name', label: 'First Name', type: 'text', required: true, section: 'Basic Info' },
    { id: 'last_name', label: 'Last Name', type: 'text', required: true, section: 'Basic Info' },
    { id: 'email', label: 'Email', type: 'email', required: true, section: 'Basic Info' },
    { id: 'phone', label: 'Phone', type: 'phone', required: true, section: 'Basic Info' },
    { id: 'location', label: 'Location / City', type: 'text', required: true, section: 'Basic Info' },
    { id: 'linkedin', label: 'LinkedIn URL', type: 'url', required: false, section: 'Basic Info' },
    { id: 'github', label: 'GitHub URL', type: 'url', required: false, section: 'Basic Info' },
    { id: 'portfolio', label: 'Portfolio / Website', type: 'url', required: false, section: 'Basic Info' },
    { id: 'resume', label: 'Resume / CV', type: 'file', required: true, section: 'Documents' },
    { id: 'cover_letter', label: 'Cover Letter', type: 'textarea', required: false, section: 'Cover Letter' },
    { id: 'work_auth', label: 'Are you authorized to work in Canada?', type: 'select', required: true, options: ['Yes', 'No', 'Will require sponsorship'], section: 'Legal' },
    { id: 'sponsorship', label: 'Will you require sponsorship now or in the future?', type: 'select', required: true, options: ['No', 'Yes'], section: 'Legal' },
  ];

  if (atsType === 'greenhouse') {
    base.push(
      { id: 'salary', label: 'Desired Salary', type: 'text', required: false, section: 'Custom Questions' },
      { id: 'start_date', label: 'Earliest Start Date', type: 'date', required: false, section: 'Custom Questions' },
      { id: 'how_heard', label: 'How did you hear about this role?', type: 'select', required: false, options: ['LinkedIn','GitHub','Company website','Referral','Job board','Other'], section: 'Custom Questions' }
    );
  }
  if (atsType === 'lever') {
    base.push(
      { id: 'summary', label: 'What makes you a great fit for this role?', type: 'textarea', required: false, section: 'Custom Questions' }
    );
  }
  if (atsType === 'ashby') {
    base.push(
      { id: 'pronouns', label: 'Pronouns (optional)', type: 'text', required: false, section: 'Basic Info' }
    );
  }

  return {
    fields: base,
    has_cover_letter: true,
    has_resume_upload: true,
    has_work_auth: true,
    detected_questions: []
  };
}

// ─── GENERATE ALL ANSWERS ────────────────────────────
async function generateAnswers(fields, evalResult, jdText, customQuestions) {
  const cv = getCV();
  const profile = getProfile();

  const fieldList = fields.map(f => 
    `- ${f.label} (${f.type}${f.required?' *required':''}${f.options?' options:['+f.options.join('/')+']':''})`
  ).join('\n');

  const prompt = `You are filling out a job application for Gaurav Raii.

CV:
${cv.substring(0, 3000)}

PROFILE:
${profile.substring(0, 500)}

JOB:
Company: ${evalResult?.company || 'Unknown'}
Role: ${evalResult?.role || 'Unknown'}
JD: ${jdText?.substring(0, 1500) || ''}

FORM FIELDS TO FILL:
${fieldList}

ADDITIONAL CUSTOM QUESTIONS:
${customQuestions?.join('\n') || 'None'}

Generate answers for every field. Return ONLY this JSON:
{
  "answers": {
    "first_name": "Gaurav",
    "last_name": "Raii",
    "email": "raiigauravv@gmail.com",
    "phone": "437-662-3427",
    "location": "Toronto, ON, Canada",
    "linkedin": "https://linkedin.com/in/gauravvraii",
    "github": "https://github.com/raiigauravv",
    "portfolio": "https://yourstrulygaurav.netlify.app",
    "work_auth": "Yes",
    "sponsorship": "No",
    "salary": "95000",
    "start_date": "Immediately",
    "how_heard": "GitHub",
    "cover_letter": "..full tailored cover letter..",
    "summary": "..tailored answer..",
    "field_id": "answer"
  },
  "cover_letter": "Full tailored cover letter here — 3 paragraphs, specific to role and company, mentioning 2-3 projects, confident tone, no fluff",
  "custom_answers": {
    "question text": "answer"
  },
  "tips": ["tip about this specific application", "thing to watch for on this form"]
}

Rules for cover letter:
- Open with specific company/role hook, NOT "I am excited to apply"
- Para 2: 2-3 relevant projects with specific metrics
- Para 3: Why this company specifically + clear ask
- Max 250 words
- Confident, direct tone — no "I am passionate about"

Rules for all answers:
- Use real data from CV only — never fabricate
- For work auth: Gaurav has PGWP — always "Yes" authorized, "No" sponsorship needed
- For salary: use market rate unless JD specifies
- For custom questions: give specific, quantified answers using real projects`;

  const raw = await callClaude(
    'You fill ATS job application forms accurately. JSON only, no markdown.',
    prompt,
    2500
  );
  return parseJSON(raw);
}

// ─── MAIN ROUTE: GENERATE PRE-FILL ───────────────────
router.post('/prefill', async (req, res) => {
  try {
    const { url, jd, evalResult, custom_questions = [] } = req.body;
    if (!url && !jd) return res.status(400).json({ error: 'Provide a job URL or JD text' });

    const atsType = detectATS(url || '');
    let html = '';
    let formFields;

    // Try to fetch and parse the actual form
    if (url) {
      try {
        html = await fetchPage(url);
        formFields = await extractFormFields(html, url, atsType);
      } catch(e) {
        console.log('Could not fetch URL, using standard fields:', e.message);
        formFields = getStandardFields(atsType);
      }
    } else {
      formFields = getStandardFields('generic');
    }

    // Merge any extra custom questions user provided
    if (custom_questions.length > 0) {
      formFields.detected_questions = [...(formFields.detected_questions || []), ...custom_questions];
    }

    // Generate all answers
    const answers = await generateAnswers(
      formFields.fields,
      evalResult,
      jd || html.substring(0, 2000),
      formFields.detected_questions
    );

    res.json({
      success: true,
      ats_type: atsType,
      url: url || null,
      form_fields: formFields,
      answers,
      meta: {
        company: evalResult?.company || 'Unknown',
        role: evalResult?.role || 'Unknown',
        generated_at: new Date().toISOString()
      }
    });

  } catch(e) {
    console.error('Apply prefill error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── GENERATE COVER LETTER ONLY ──────────────────────
router.post('/cover-letter', async (req, res) => {
  try {
    const { jd, evalResult, tone = 'confident' } = req.body;
    const cv = getCV();

    const result = await callClaude(
      'You write exceptional cover letters for ML/AI engineers. Never use "I am passionate about". Be specific, confident, direct.',
      `Write a tailored cover letter for:
Company: ${evalResult?.company || 'Company'}
Role: ${evalResult?.role || 'ML Engineer'}
JD: ${jd?.substring(0, 2000) || ''}
Eval keywords: ${evalResult?.keywords?.join(', ') || ''}
Eval strategy: ${evalResult?.strategy || ''}

CV: ${cv.substring(0, 2500)}

Rules:
- Tone: ${tone}
- Para 1: Specific hook referencing something real about the company + direct statement of fit
- Para 2: 2-3 concrete projects with metrics that directly match JD requirements
- Para 3: Why this company specifically, clear ask for conversation
- Max 250 words
- No "I am excited/passionate/thrilled"
- End with confidence, not begging`,
      1000
    );

    res.json({ success: true, cover_letter: result });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SCREENING QUESTIONS ─────────────────────────────
router.post('/screening', async (req, res) => {
  try {
    const { questions, evalResult, jd } = req.body;
    const cv = getCV();

    if (!questions || questions.length === 0) {
      return res.status(400).json({ error: 'No questions provided' });
    }

    const result = await callClaude(
      'You answer job application screening questions accurately using the candidate\'s real background.',
      `Answer these screening/custom questions for a job application.

Role: ${evalResult?.role || 'ML Engineer'} at ${evalResult?.company || 'Company'}
JD context: ${jd?.substring(0, 800) || ''}
CV: ${cv.substring(0, 2500)}

QUESTIONS:
${questions.map((q, i) => `${i+1}. ${q}`).join('\n')}

Return ONLY JSON:
{
  "answers": [
    {
      "question": "question text",
      "answer": "specific, quantified answer using real CV data",
      "word_count": 45,
      "confidence": "high|medium|low"
    }
  ]
}

Rules:
- Use real projects and metrics from CV only
- Keep answers concise unless it's an essay question (>100 words only if asked)
- For yes/no questions: answer + brief justification
- For work auth: Gaurav has PGWP, authorized in Canada, no sponsorship needed`,
      1500
    );

    const parsed = parseJSON(result);
    res.json({ success: true, ...parsed });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
