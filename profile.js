const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname);

function getCV() {
  const cvPath = path.join(ROOT, 'cv.md');
  if (fs.existsSync(cvPath)) return fs.readFileSync(cvPath, 'utf8');
  return getDefaultCV();
}

function getProfile() {
  const p = path.join(ROOT, 'config', 'profile.yml');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  return getDefaultProfile();
}

function getDefaultCV() {
  return `# Gaurav Raii — ML Engineer & Data Scientist
Toronto, ON | raiigauravv@gmail.com | 437-662-3427
LinkedIn: gauravvraii | GitHub: raiigauravv | Portfolio: yourstrulygaurav.netlify.app

## Education
MSc Information Systems — Northeastern University, Toronto (GPA 3.67, May 2025)
BE Computer Engineering — University of Mumbai

## Work Authorization
PGWP (Post-Graduate Work Permit) — eligible to work in Canada

## Current Role
AI Model Quality Analyst — Scale AI / Outlier (Whitebeard project, Apr 2026, remote contract)

## Technical Skills
Languages: Python, JavaScript, TypeScript, SQL, R
ML/AI: PyTorch, TensorFlow, scikit-learn, XGBoost, LightGBM, HuggingFace, DistilBERT, BERT4Rec, GPT-4
LLM/Agentic: LangGraph, LangChain, RAG, CrewAI, FastAPI, MCP, GraphQL
MLOps: MLflow, W&B (Weights & Biases), Docker, GitHub Actions, CI/CD
Data: Kafka, Spark Streaming, Pinecone, PostgreSQL, Redis, BigQuery
Cloud: Azure Container Apps, Azure Static Web Apps, AWS basics
Frontend: Next.js, React, TypeScript, Tailwind, shadcn/ui
Visualization: Power BI, Tableau

## Key Projects
- NEXUS-AI: LangGraph + RAG + GPT-4 + DistilBERT, FastAPI, Pinecone, PostgreSQL, Redis, Docker, Next.js
- AutoMLOps-Genie: GPT-4 + AutoGluon + MLflow, 90% prototype time reduction
- Real-Time Fraud Monitoring: Kafka + XGBoost + SHAP + FastAPI + Docker, <100ms latency
- Smart News Recommender: BERT4Rec, FastAPI, React/TypeScript, Azure, <200ms latency, 51k articles
- SkillForge-AI: Gradient Boosting + FastAPI + CrewAI, 93.6% accuracy
- Multilingual NLI BERT: Fine-tuned BERT+RoBERTa, 93.4% Kaggle accuracy, 15 languages
- Healthcare AI Assistant: GPT-4 + Vision + Whisper + Gradio (live on HuggingFace)
- LLM Shield: Multi-layer hallucination evaluator (in progress)

## Open Source
- 2 merged PRs to adenhq/hive (YC-backed): W&B MCP/GraphQL integration + unit test expansion

## Experience
- Data Science Engineer Intern, C-DAC Mumbai: Spark Streaming, CNN+Word2Vec NLP pipeline, 90%+ precision
- Data Analyst Intern, SDAC Infotech

## Certifications
JP Morgan Quant Research (Forage), BCG Data Science (Forage), BCG GenAI (Forage),
Google Advanced Data Analytics, Databricks GenAI Fundamentals, Databricks Fundamentals,
BigQuery ML, Power BI (Coursera), Tableau (Coursera), Google Data Analytics

## GDSC Leadership
GDSC Northeastern Toronto — Marketing & Analytics Team Lead (Feb–Oct 2025)
35% event participation boost, A/B testing framework (SciPy/Pandas), 15% engagement increase`;
}

function getDefaultProfile() {
  return `name: Gaurav Raii
email: raiigauravv@gmail.com
location: Toronto, ON, Canada
work_auth: PGWP
target_roles:
  - ML Engineer
  - AI Engineer
  - Data Scientist
  - LLM Engineer
  - MLOps Engineer
target_locations:
  - Toronto, ON
  - Remote (Canada)
  - Remote (US)
target_company_stage:
  - startup
  - scaleup
  - mid-size
must_haves:
  - ML/AI focus
  - PGWP-eligible employer
  - Growth trajectory
deal_breakers:
  - No ML/AI component
  - Requires citizenship/PR only
  - Pure data entry/reporting
salary_target_cad: 95000
scoring_weights:
  technical_fit: 9
  role_level: 8
  company_stage: 8
  work_auth: 10
  location: 7
  growth_potential: 6
  comp_range: 7
  team_quality: 6
  domain_match: 8
  culture_fit: 5`;
}

function getArticleDigest() {
  const p = path.join(ROOT, 'article-digest.md');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  return ''; // Optional file — silently returns empty if not present
}

module.exports = { getCV, getProfile, getArticleDigest };
