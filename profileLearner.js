const fs = require('fs');
const path = require('path');
const { callClaude } = require('./claude');

const LEARNED_FILE = path.join(__dirname, 'config', '_profile.md');
const FEEDBACK_LOG  = path.join(__dirname, 'data', 'feedback.json');

function loadLearned() {
  if (!fs.existsSync(LEARNED_FILE)) return '';
  return fs.readFileSync(LEARNED_FILE, 'utf8');
}

function saveLearned(content) {
  const dir = path.dirname(LEARNED_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LEARNED_FILE, content);
}

function loadFeedbackLog() {
  if (!fs.existsSync(FEEDBACK_LOG)) return [];
  try { return JSON.parse(fs.readFileSync(FEEDBACK_LOG, 'utf8')); }
  catch(e) { return []; }
}

function saveFeedbackLog(log) {
  fs.writeFileSync(FEEDBACK_LOG, JSON.stringify(log, null, 2));
}

// Called when user gives feedback on an evaluation
async function processFeedback({ evalResult, feedback, feedbackType }) {
  // feedbackType: 'score_too_high' | 'score_too_low' | 'missing_skill' | 'wrong_archetype' | 'good_eval' | 'custom'
  
  const log = loadFeedbackLog();
  const entry = {
    id: Date.now(),
    company: evalResult?.company,
    role: evalResult?.role,
    grade: evalResult?.grade,
    feedback,
    feedbackType,
    timestamp: new Date().toISOString(),
    applied: false
  };
  log.push(entry);
  saveFeedbackLog(log);

  // Don't update profile on every single eval — batch apply when we have 3+ unapplied feedbacks
  const unapplied = log.filter(e => !e.applied);
  if (unapplied.length >= 1) {
    await applyFeedbackToProfile(unapplied);
    // Mark all as applied
    log.forEach(e => { if (!e.applied) e.applied = true; });
    saveFeedbackLog(log);
  }

  return { success: true, queued: unapplied.length };
}

async function applyFeedbackToProfile(feedbacks) {
  const current = loadLearned();

  const feedbackText = feedbacks.map(f =>
    `- ${f.company} (${f.role}): Grade was ${f.grade}. Feedback: "${f.feedback}" [type: ${f.feedbackType}]`
  ).join('\n');

  const updated = await callClaude(
    'You update a career search profile based on feedback. Be precise and additive — never remove existing valid preferences.',
    `You manage a autoapply learner profile (_profile.md). Update it based on new feedback.

CURRENT PROFILE:
${current || '(empty — create initial profile)'}

NEW FEEDBACK FROM USER:
${feedbackText}

Instructions:
- If score was too high: note that this company/role type scores lower for this candidate
- If score was too low: note the undervalued fit signals
- If missing_skill: add the skill to the candidate's verified stack if it genuinely matches their CV
- If wrong_archetype: note the correct classification pattern
- Add preference signals, deal-breakers, or scoring adjustments as bullet points
- Keep it concise — this file is injected into every evaluation prompt
- Format as clean markdown with sections: ## Scoring Adjustments, ## Verified Skills, ## Preference Signals, ## Deal-breakers

Return the FULL updated _profile.md content only.`,
    1200
  );

  saveLearned(updated);
  return updated;
}

// Inject learned profile into evaluation prompts
function getLearned() {
  return loadLearned();
}

function getFeedbackStats() {
  const log = loadFeedbackLog();
  return {
    total: log.length,
    applied: log.filter(e => e.applied).length,
    pending: log.filter(e => !e.applied).length,
    by_type: log.reduce((acc, e) => {
      acc[e.feedbackType] = (acc[e.feedbackType] || 0) + 1;
      return acc;
    }, {})
  };
}

module.exports = { processFeedback, getLearned, getFeedbackStats, loadLearned };
