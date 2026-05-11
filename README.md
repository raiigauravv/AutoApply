# AutoApply Web App

Full web UI version of santifer/autoapply — all 14 modes, portal scanner, PDF generation, batch eval, tracker, and more.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright (for portal scanning)
npx playwright install chromium

# 3. Set your Anthropic API key
cp .env.example .env
# Edit .env and add your key

# 4. Start the app
npm start

# Open http://localhost:3773
```

## Add your CV

Drop your CV as `cv.md` in the project root — or edit it directly in the Profile tab.

## Features

| Feature | Status |
|---|---|
| JD Evaluation (A–F, 10 dimensions) | ✅ Full |
| Portal Scanner (45+ companies, Greenhouse + Lever) | ✅ Full |
| Batch Evaluation (up to 20 JDs parallel) | ✅ Full |
| Application Tracker (dedup, status, notes) | ✅ Full |
| PDF Resume Generation (Puppeteer) | ✅ Full |
| Cold Outreach Generator | ✅ Full |
| Company Deep Research | ✅ Full |
| STAR Story Bank | ✅ Full |
| Salary Negotiation Scripts | ✅ Full |
| Follow-up Cadence | ✅ Full |
| Full Report (8 blocks like santifer) | ✅ Full |
| Profile + CV editor (live) | ✅ Full |

## Architecture

```
autoapply-app/
├── server.js          — Express server
├── claude.js          — Anthropic API wrapper
├── profile.js         — CV + profile loader
├── routes/
│   ├── evaluate.js    — JD evaluation + report generation
│   ├── pdf.js         — Tailored resume PDF generation
│   ├── scan.js        — Portal scanner (Greenhouse + Lever APIs)
│   ├── batch.js       — Parallel batch evaluation
│   ├── tracker.js     — Application tracker (JSON persistence)
│   ├── research.js    — Company research, outreach, STAR stories, negotiation
│   └── profile.js     — CV/profile read/write
├── public/
│   └── index.html     — Full SPA frontend
├── cv.md              — Your CV (create this)
├── config/
│   └── profile.yml    — Your profile + scoring weights
├── data/              — Tracker + batch results (gitignored)
├── output/            — Generated PDFs (gitignored)
└── reports/           — Eval reports (gitignored)
```

## API Key

Get one at https://console.anthropic.com/
Set in `.env` as `ANTHROPIC_API_KEY=sk-ant-...`
