/**
 * latex.js — LaTeX CV generation
 * Mirrors: generate-latex.mjs from santifer/autoapply
 * Generates a .tex file from the candidate's CV using a professional template.
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { callClaude } = require('../claude');
const { getCV } = require('../profile');

const OUTPUT_DIR = path.join(__dirname, '../output');

function escapeLatex(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/→/g, '$\\rightarrow$')
    .replace(/•/g, '\\textbullet{}')
    .replace(/[""]/g, "''")
    .replace(/['']/g, "'");
}

const LATEX_TEMPLATE = (data) => `\\documentclass[10.5pt,letterpaper]{article}
\\usepackage[margin=0.75in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{hyperref}
\\usepackage{fontenc}
\\usepackage{inputenc}
\\usepackage{lmodern}
\\usepackage{microtype}
\\usepackage{parskip}

\\hypersetup{colorlinks=true, urlcolor=blue, linkcolor=black}
\\setlist[itemize]{leftmargin=*, noitemsep, topsep=2pt}
\\titleformat{\\section}{\\large\\bfseries}{}{0em}{}[\\titlerule]
\\titlespacing{\\section}{0pt}{8pt}{4pt}
\\pagestyle{empty}

\\begin{document}

% Header
\\begin{center}
  {\\LARGE\\textbf{${escapeLatex(data.name)}}} \\\\[4pt]
  ${escapeLatex(data.contact)}
\\end{center}

% Summary
\\section{Summary}
${escapeLatex(data.summary)}

% Experience
\\section{Experience}
${(data.experience || []).map(exp => `
\\textbf{${escapeLatex(exp.role)}} \\hfill ${escapeLatex(exp.dates)} \\\\
\\textit{${escapeLatex(exp.company)}}
\\begin{itemize}
${(exp.bullets || []).map(b => `  \\item ${escapeLatex(b)}`).join('\n')}
\\end{itemize}
`).join('\n')}

% Projects
${data.projects && data.projects.length > 0 ? `\\section{Projects}
${data.projects.map(p => `\\textbf{${escapeLatex(p.name)}} — ${escapeLatex(p.description)} ${p.impact ? `\\textit{${escapeLatex(p.impact)}}` : ''}`).join('\n\n')}` : ''}

% Skills
\\section{Skills}
${escapeLatex((data.skills || []).join(' · '))}

\\end{document}
`;

// POST /api/latex/generate — generate .tex file from CV
router.post('/generate', async (req, res) => {
  try {
    const { jd, evalResult } = req.body;
    const cv = getCV();

    // Use same AI content selection as PDF route
    const raw = await callClaude(
      'You are a professional resume curator. Select and curate the most relevant content for a single-page resume. Return ONLY valid JSON.',
      `CANDIDATE CV:\n${cv}\n\nJOB DESCRIPTION:\n${jd || 'General ML/AI role'}\n\nReturn ONLY this JSON (no markdown):\n{"name":"Full Name","contact":"Email | LinkedIn | Location","summary":"2-3 sentence tailored summary","skills":["skill1","skill2"],"experience":[{"role":"Title","company":"Co","dates":"Mon Year - Mon Year","bullets":["achievement 1","achievement 2"]}],"projects":[{"name":"Project","description":"description","impact":"result"}]}`,
      1200
    );

    let data;
    try {
      data = JSON.parse(raw.replace(/```[a-z]*/g, '').replace(/```/g, '').trim());
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse AI response into CV structure' });
    }

    const latex = LATEX_TEMPLATE(data);
    const slug = (data.name || 'cv').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const filename = `${slug}-${Date.now()}.tex`;
    const filepath = path.join(OUTPUT_DIR, filename);

    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(filepath, latex, 'utf8');

    res.json({
      success: true,
      filename,
      latex_preview: latex.substring(0, 800) + '...',
      message: `LaTeX CV generated. Download and compile with: pdflatex ${filename}`,
      instructions: [
        '1. Download the .tex file',
        '2. Compile with: pdflatex ' + filename,
        '3. Or paste into Overleaf (overleaf.com) for online compilation',
        '4. Overleaf produces the highest quality PDF output'
      ]
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/latex/download/:filename
router.get('/download/:filename', (req, res) => {
  const filepath = path.join(OUTPUT_DIR, req.params.filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'File not found' });
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
  res.setHeader('Content-Type', 'application/x-tex');
  res.sendFile(filepath);
});

module.exports = router;
