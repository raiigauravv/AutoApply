const express = require('express');
const router = express.Router();
const { callClaude, parseJSON } = require('../claude');
const { getCV, getProfile } = require('../profile');
const fs = require('fs');
const path = require('path');

/**
 * selectResumeContent(fullCV, jd, evalResult)
 * Sends full CV + full JD to Gemini, asks it to curate:
 * - Most relevant skills
 * - Max 4 projects with descriptions
 * - Trimmed experience (2-3 bullets per role)
 * - Tailored professional summary
 * Returns structured JSON for single A4 page at 10.5pt
 */
async function selectResumeContent(fullCV, jd, evalResult) {
  const prompt = `You are a professional resume curator. Given a candidate CV and job description, select and curate the most relevant content for a single-page A4 resume at 10.5pt font.

FULL CANDIDATE CV:
${fullCV}

JOB DESCRIPTION:
${jd || 'General role'}

COMPANY/ROLE:
Company: ${evalResult?.company || 'Unknown'}
Role: ${evalResult?.role || 'Unknown'}
Match Score: ${evalResult?.score || 'N/A'}

TASK: Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "name": "Full Name",
  "contact": "Email | Phone | Location | LinkedIn",
  "summary": "2-3 sentence tailored professional summary specific to this JD, 40-60 words",
  "skills": ["skill1", "skill2", "skill3", "skill4", "skill5"],
  "experience": [
    {
      "role": "Job Title",
      "company": "Company Name",
      "dates": "Month Year - Month Year",
      "bullets": ["Achievement 1", "Achievement 2", "Achievement 3"]
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "1-2 sentence description with tech stack",
      "impact": "Key result or metric"
    }
  ]
}

RULES:
1. Skills: Extract 5 most relevant from CV that match JD keywords
2. Experience: Include 2-3 most recent/relevant roles, trim bullets to 2-3 achievements each
3. Projects: Select max 4 projects that best demonstrate JD-required skills
4. Summary: Tailor to this specific JD, highlight role/company fit
5. ALL content must come from CV - NEVER fabricate experience or skills
6. Trim all text to fit one A4 page at 10.5pt font (be concise)
7. Maintain professional language, quantify achievements where possible`;

  const systemPrompt = 'You are a resume curation expert. Return ONLY valid JSON with no markdown, code blocks, or explanation.';
  
  try {
    const raw = await callClaude(systemPrompt, prompt, 4000);
    const parsed = parseJSON(raw);
    return parsed;
  } catch(e) {
    console.error('selectResumeContent error:', e.message);
    throw new Error('Failed to curate resume content: ' + e.message);
  }
}

/**
 * buildOnePageHTML(content)
 * Takes selected content JSON object
 * Renders clean single-page A4 HTML resume (10.5pt, white background)
 * Optimized to fit exactly one page
 */
function buildOnePageHTML(content) {
  if (!content) throw new Error('No content provided for resume');
  
  const {
    name = 'Candidate Name',
    contact = '',
    summary = '',
    skills = [],
    experience = [],
    projects = []
  } = content;

  // Render skills as comma-separated list
  const skillsHtml = skills.length > 0
    ? `<div class="section">
        <h2>Skills</h2>
        <p class="skills-list">${skills.join(' • ')}</p>
      </div>`
    : '';

  // Render experience section
  const experienceHtml = experience.length > 0
    ? `<div class="section">
        <h2>Experience</h2>
        ${experience.map(exp => `
          <div class="role">
            <div class="role-header">
              <span class="role-title">${exp.role || ''}</span>
              <span class="role-date">${exp.dates || ''}</span>
            </div>
            <div class="role-company">${exp.company || ''}</div>
            <ul>
              ${(exp.bullets || []).map(bullet => `<li>${bullet}</li>`).join('')}
            </ul>
          </div>
        `).join('')}
      </div>`
    : '';

  // Render projects section
  const projectsHtml = projects.length > 0
    ? `<div class="section">
        <h2>Projects</h2>
        ${projects.map(proj => `
          <div class="project">
            <div class="project-title">${proj.name || ''}</div>
            <p class="project-desc">${proj.description || ''}</p>
            ${proj.impact ? `<p class="project-impact"><strong>Impact:</strong> ${proj.impact}</p>` : ''}
          </div>
        `).join('')}
      </div>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { 
    width: 210mm; 
    height: 297mm; 
    margin: 0; 
    padding: 10mm; 
    background: white; 
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 10.5pt;
    line-height: 1.35;
    color: #1a1a1a;
  }
  @page {
    size: A4;
    margin: 10mm;
  }
  @media print {
    body { margin: 0; padding: 10mm; }
    .section { page-break-inside: avoid; }
  }
  
  .resume {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .header {
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid #ddd;
  }
  .header h1 {
    font-size: 16pt;
    font-weight: 700;
    color: #111;
    margin-bottom: 2px;
    letter-spacing: -0.5px;
  }
  .header .contact {
    font-size: 9pt;
    color: #555;
    line-height: 1.3;
  }
  
  .summary {
    font-size: 10.5pt;
    color: #333;
    line-height: 1.4;
    margin-bottom: 8px;
    padding: 6px 8px;
    background: #f8f8f8;
    border-left: 2px solid #1a1a1a;
  }
  
  .section {
    margin-bottom: 8px;
    page-break-inside: avoid;
  }
  .section h2 {
    font-size: 8.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #1a1a1a;
    border-bottom: 0.5px solid #ccc;
    padding-bottom: 2px;
    margin-bottom: 5px;
  }
  
  .skills-list {
    font-size: 10pt;
    line-height: 1.4;
    color: #333;
  }
  
  .role {
    margin-bottom: 6px;
    page-break-inside: avoid;
  }
  .role-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 1px;
  }
  .role-title {
    font-weight: 600;
    font-size: 10.5pt;
    color: #1a1a1a;
  }
  .role-date {
    font-size: 9pt;
    color: #666;
    text-align: right;
    white-space: nowrap;
  }
  .role-company {
    font-size: 10pt;
    color: #555;
    font-style: italic;
    margin-bottom: 2px;
  }
  
  ul {
    padding-left: 12px;
    margin: 0;
  }
  li {
    font-size: 9.5pt;
    margin-bottom: 1px;
    line-height: 1.35;
  }
  
  .project {
    margin-bottom: 5px;
    page-break-inside: avoid;
  }
  .project-title {
    font-weight: 600;
    font-size: 10.5pt;
    color: #1a1a1a;
    margin-bottom: 1px;
  }
  .project-desc {
    font-size: 9.5pt;
    color: #333;
    margin-bottom: 1px;
    line-height: 1.35;
  }
  .project-impact {
    font-size: 9.5pt;
    color: #555;
    margin: 1px 0;
    line-height: 1.3;
  }
  
  .footer {
    font-size: 8pt;
    color: #999;
    text-align: right;
    margin-top: auto;
    padding-top: 4px;
    border-top: 0.5px solid #eee;
  }
</style>
</head>
<body>
<div class="resume">
  <div class="header">
    <h1>${name}</h1>
    <div class="contact">${contact}</div>
  </div>
  
  ${summary ? `<div class="summary">${summary}</div>` : ''}
  
  ${skillsHtml}
  ${experienceHtml}
  ${projectsHtml}
  
  <div class="footer">Generated by AutoApply</div>
</div>
</body>
</html>`;

  return html;
}

/**
 * POST /preview
 * Calls selectResumeContent() to get curated JSON
 * Calls buildOnePageHTML() to render styled HTML
 * Returns both for client preview
 */
router.post('/preview', async (req, res) => {
  try {
    const { evalResult, jd } = req.body;
    if (!evalResult || !jd) {
      return res.status(400).json({ error: 'Missing evalResult or jd' });
    }

    const cv = getCV();
    if (!cv) {
      return res.status(400).json({ error: 'CV not found' });
    }

    console.log(`[PDF Preview] CV length: ${cv.length} chars, JD length: ${jd.length} chars`);

    // Step 1: Get curated content from Gemini
    const selectedContent = await selectResumeContent(cv, jd, evalResult);
    
    // Step 2: Render to HTML
    const previewHTML = buildOnePageHTML(selectedContent);

    res.json({
      success: true,
      selectedContent,
      previewHTML
    });
  } catch (e) {
    console.error('[PDF Preview Error]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /generate
 * Takes selectedContent JSON (from preview)
 * Renders to HTML and generates PDF via Puppeteer
 * Returns filename for download
 */
router.post('/generate', async (req, res) => {
  try {
    const { selectedContent, evalResult } = req.body;
    if (!selectedContent) {
      return res.status(400).json({ error: 'Missing selectedContent' });
    }

    // Render curated content to styled HTML
    const html = buildOnePageHTML(selectedContent);

    // Try to generate PDF with Puppeteer
    let puppeteer;
    try {
      puppeteer = require('puppeteer');
    } catch(e) {
      // Puppeteer not available, return HTML fallback
      const filename = `resume_${Date.now()}.html`;
      const outPath = path.join(__dirname, '..', 'output', filename);
      fs.writeFileSync(outPath, html);
      return res.json({ success: true, type: 'html', filename });
    }

    const browser = await puppeteer.launch({ 
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: 'new'
    });
    const page = await browser.newPage();
    
    // Set A4 page size and margins
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const sanitizedCompany = (evalResult?.company || 'tailored')
      .replace(/[^a-z0-9]/gi, '_')
      .substring(0, 20);
    const filename = `resume_${sanitizedCompany}_${Date.now()}.pdf`;
    const outPath = path.join(__dirname, '..', 'output', filename);
    
    await page.pdf({
      path: outPath,
      format: 'A4',
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      printBackground: true,
      scale: 1
    });
    
    await browser.close();

    console.log(`[PDF Generated] ${filename}`);
    res.json({ success: true, type: 'pdf', filename });
  } catch (e) {
    console.error('[PDF Generate Error]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /download/:filename
 * Downloads generated PDF/HTML from output folder
 */
router.get('/download/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    // Security: prevent directory traversal
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filePath = path.join(__dirname, '..', 'output', filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.download(filePath);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
