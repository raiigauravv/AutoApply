// ═══════════════════════════════════════════════════════
// app-part6.js — Liveness, Follow-ups, Patterns, LaTeX CV
// Mirrors: check-liveness, followup-cadence, analyze-patterns, generate-latex
// ═══════════════════════════════════════════════════════

// ─── LIVENESS CHECKER ────────────────────────────────────
async function checkSingleLiveness() {
  const url = document.getElementById('liveness-url')?.value?.trim();
  if (!url) { toast('Enter a URL first', 'err'); return; }
  const el = document.getElementById('liveness-results');
  if (el) el.innerHTML = '<div class="hint">Checking...</div>';
  try {
    const r = await fetch(API + '/api/liveness/check', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await r.json();
    if (el) renderLivenessResults(data.results || []);
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

async function checkAllLiveness() {
  const el = document.getElementById('liveness-results');
  if (el) el.innerHTML = '<div class="hint">Checking all active applications...</div>';
  const badge = document.getElementById('liveness-badge');
  try {
    const r = await fetch(API + '/api/liveness/tracker');
    const data = await r.json();
    if (data.message) {
      if (el) el.innerHTML = `<div class="hint">${data.message}</div>`;
      return;
    }
    if (el) renderLivenessResults(data.results || []);
    const closed = (data.results || []).filter(r => r.alive === false).length;
    if (badge && closed > 0) {
      badge.textContent = closed + ' closed';
      badge.style.display = 'inline';
    }
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

function renderLivenessResults(results) {
  const el = document.getElementById('liveness-results');
  if (!el || !results.length) { if (el) el.innerHTML = '<div class="hint">No results.</div>'; return; }
  el.innerHTML = results.map(r => {
    const color = r.alive === true ? 'var(--teal)' : r.alive === false ? '#ff6b6b' : 'var(--dim)';
    const icon = r.alive === true ? '✓ Active' : r.alive === false ? '✗ Closed' : '? Unknown';
    const conf = r.confidence ? ` · ${r.confidence} confidence` : '';
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:12px;font-weight:600;color:${color};min-width:70px">${icon}</span>
      <div style="flex:1;min-width:0">
        <a href="${r.url}" target="_blank" style="color:var(--fg);font-size:12px;word-break:break-all">${r.company ? `<strong>${r.company}</strong> — ${r.role}` : r.url}</a>
        <div style="font-size:11px;color:var(--dim);margin-top:2px">${r.signal || ''}${conf} · HTTP ${r.http_status || '?'}</div>
      </div>
    </div>`;
  }).join('');
}

// ─── FOLLOW-UP CADENCE ───────────────────────────────────
async function loadFollowupSchedule() {
  try {
    // Load due follow-ups
    const [dueR, schedR] = await Promise.all([
      fetch(API + '/api/followup/due').then(r => r.json()),
      fetch(API + '/api/followup/schedule').then(r => r.json()),
    ]);

    const dueEl = document.getElementById('followup-due-section');
    const schedEl = document.getElementById('followup-schedule-section');
    const badge = document.getElementById('followup-badge');

    // Due now
    if (dueEl) {
      const due = dueR.due || [];
      if (due.length > 0) {
        if (badge) { badge.textContent = due.length + ' due'; badge.style.display = 'inline'; }
        dueEl.innerHTML = `<div style="font-size:10px;font-family:var(--mono);color:var(--dim);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">⚡ Action Required (${due.length})</div>` +
          due.map(d => `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(245,166,35,.06);border:1px solid rgba(245,166,35,.2);border-radius:8px;margin-bottom:6px">
            <span style="font-size:11px;font-weight:600;color:#f5a623">${d.days_overdue === 0 ? 'TODAY' : d.days_overdue + 'd ago'}</span>
            <div style="flex:1">
              <div style="font-size:12px;font-weight:600">${d.company} — ${d.role}</div>
              <div style="font-size:11px;color:var(--dim)">${d.label}</div>
            </div>
            <button class="btn btn-xs btn-g" onclick="prefillFollowup('${d.company}','${d.role}','${d.app_status}','${d.action}')">Draft →</button>
          </div>`).join('');
      } else {
        dueEl.innerHTML = '<div class="hint" style="color:var(--teal)">✓ No follow-ups due right now</div>';
      }
    }

    // Full schedule
    if (schedEl) {
      const sched = schedR.schedule || [];
      if (!sched.length) {
        schedEl.innerHTML = '<div class="hint">No active applications to track. Apply to some jobs first!</div>';
        return;
      }
      schedEl.innerHTML = `<div style="font-size:10px;font-family:var(--mono);color:var(--dim);text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">Full Schedule (${sched.length} applications)</div>` +
        sched.map(s => `<div style="margin-bottom:12px;padding:10px;background:var(--surface);border:1px solid var(--border);border-radius:8px">
          <div style="font-size:12px;font-weight:600;margin-bottom:6px">${s.company} — ${s.role} <span style="font-family:var(--mono);font-size:10px;color:var(--dim)">[${s.app_status}]</span></div>
          ${s.steps.map(step => {
            const color = step.status === 'overdue' ? '#ff6b6b' : step.status === 'due_today' ? '#f5a623' : 'var(--dim)';
            const label = step.status === 'overdue' ? `${step.days_overdue}d overdue` : step.status === 'due_today' ? 'TODAY' : `in ${step.days_until}d`;
            return `<div style="display:flex;gap:8px;align-items:center;font-size:11px;margin-bottom:3px">
              <span style="color:${color};min-width:80px">${label}</span>
              <span style="color:var(--muted)">${step.label}</span>
            </div>`;
          }).join('')}
        </div>`).join('');
    }
  } catch (e) { toast('Error loading schedule: ' + e.message, 'err'); }
}

function prefillFollowup(company, role, status, action) {
  const coEl = document.getElementById('fu-co');
  const roleEl = document.getElementById('fu-role');
  const statusEl = document.getElementById('fu-status');
  const actionEl = document.getElementById('fu-action');
  if (coEl) coEl.value = company;
  if (roleEl) roleEl.value = role;
  if (statusEl) statusEl.value = status;
  if (actionEl) actionEl.value = action;
  document.getElementById('fu-result').style.display = 'none';
}

async function generateFollowup() {
  const company = document.getElementById('fu-co')?.value?.trim();
  const role = document.getElementById('fu-role')?.value?.trim();
  const status = document.getElementById('fu-status')?.value;
  const action = document.getElementById('fu-action')?.value;
  const contact_name = document.getElementById('fu-contact')?.value?.trim();
  if (!company || !role) { toast('Enter company and role', 'err'); return; }

  document.getElementById('fu-loading').style.display = 'block';
  document.getElementById('fu-result').style.display = 'none';
  try {
    const r = await fetch(API + '/api/followup/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company, role, status, action, contact_name })
    });
    const data = await r.json();
    document.getElementById('fu-loading').style.display = 'none';
    if (!data.success) throw new Error(data.error);
    document.getElementById('fu-content').textContent = data.message;
    document.getElementById('fu-result').style.display = 'block';
  } catch (e) { document.getElementById('fu-loading').style.display = 'none'; toast('Error: ' + e.message, 'err'); }
}

function copyFollowup() {
  navigator.clipboard.writeText(document.getElementById('fu-content')?.textContent || '');
  toast('Copied!', 'ok');
}

// ─── PATTERN ANALYSIS ────────────────────────────────────
async function runPatternAnalysis() {
  // Load quick stats first
  try {
    const statsR = await fetch(API + '/api/patterns/stats');
    const statsData = await statsR.json();
    const stats = statsData.stats || {};
    const el = document.getElementById('patterns-stats');
    if (el) {
      el.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap">
        ${[
          ['Total tracked', stats.total, 'var(--fg)'],
          ['Applied', stats.applied, 'var(--muted)'],
          ['Progressed', stats.progressed, 'var(--teal)'],
          ['Rejected', stats.rejected, '#ff6b6b'],
          ['Response rate', stats.response_rate + '%', stats.response_rate >= 20 ? 'var(--teal)' : '#f5a623'],
          ['Ghost rate', stats.ghost_rate + '%', stats.ghost_rate >= 30 ? '#ff6b6b' : 'var(--dim)'],
        ].map(([label, val, color]) => `<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 16px;text-align:center">
          <div style="font-size:22px;font-weight:700;color:${color}">${val ?? '—'}</div>
          <div style="font-size:10px;color:var(--dim);margin-top:2px">${label}</div>
        </div>`).join('')}
      </div>`;
    }
    if ((stats.total || 0) < 3) {
      toast('Need at least 3 tracked applications for pattern analysis', 'err');
      return;
    }
  } catch (e) { /* stats optional */ }

  document.getElementById('patterns-loading').style.display = 'block';
  document.getElementById('patterns-result').style.display = 'none';

  const msgs = ['Reading tracker data...', 'Identifying patterns...', 'Analyzing rejection signals...', 'Building report...'];
  let i = 0;
  const iv = setInterval(() => { const m = document.getElementById('patterns-load-msg'); if (m) m.textContent = msgs[i++ % msgs.length]; }, 2000);

  try {
    const r = await fetch(API + '/api/patterns/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const data = await r.json();
    clearInterval(iv);
    document.getElementById('patterns-loading').style.display = 'none';
    if (!data.success) throw new Error(data.error || data.message);
    document.getElementById('patterns-content').innerHTML = markdownToHTML(data.analysis);
    document.getElementById('patterns-result').style.display = 'block';
  } catch (e) {
    clearInterval(iv);
    document.getElementById('patterns-loading').style.display = 'none';
    toast('Error: ' + e.message, 'err');
  }
}

function copyPatterns() {
  const el = document.getElementById('patterns-content');
  if (el) { navigator.clipboard.writeText(el.innerText); toast('Copied!', 'ok'); }
}

// ─── LATEX CV GENERATOR ──────────────────────────────────
let _latexFilename = '';

async function generateLatex() {
  const jd = document.getElementById('latex-jd')?.value?.trim();
  document.getElementById('latex-loading').style.display = 'block';
  document.getElementById('latex-result').style.display = 'none';
  try {
    const r = await fetch(API + '/api/latex/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jd })
    });
    const data = await r.json();
    document.getElementById('latex-loading').style.display = 'none';
    if (!data.success) throw new Error(data.error);
    _latexFilename = data.filename;
    const instrEl = document.getElementById('latex-instructions');
    if (instrEl && data.instructions) {
      instrEl.innerHTML = data.instructions.map(s => `<div style="font-size:12px;color:var(--muted);margin-bottom:4px">${s}</div>`).join('');
    }
    const prevEl = document.getElementById('latex-preview');
    if (prevEl) prevEl.textContent = data.latex_preview;
    const dlBtn = document.getElementById('latex-download-btn');
    if (dlBtn) {
      dlBtn.onclick = () => { window.location.href = `${API}/api/latex/download/${_latexFilename}`; };
    }
    document.getElementById('latex-result').style.display = 'block';
    toast('LaTeX CV generated!', 'ok');
  } catch (e) {
    document.getElementById('latex-loading').style.display = 'none';
    toast('Error: ' + e.message, 'err');
  }
}

// ─── AUTO-LOAD BADGES ON STARTUP ─────────────────────────
(async function initBadges() {
  // Check follow-up due count
  try {
    const r = await fetch(API + '/api/followup/due');
    const data = await r.json();
    const due = (data.due || []).length;
    if (due > 0) {
      const b = document.getElementById('followup-badge');
      if (b) { b.textContent = due + ' due'; b.style.display = 'inline'; }
    }
  } catch (e) {}
})();

// ─── PATCH switchTo FOR AUTOLOAD ─────────────────────────
(function patchSwitchTo() {
  const _orig = window.switchTo;
  if (typeof _orig === 'function') {
    window.switchTo = function(panel) {
      _orig(panel);
      if (panel === 'followups') setTimeout(loadFollowupSchedule, 100);
      if (panel === 'patterns') setTimeout(() => {
        fetch(API + '/api/patterns/stats').then(r => r.json()).then(data => {
          const el = document.getElementById('patterns-stats');
          const stats = data.stats || {};
          if (el && stats.total !== undefined) {
            el.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap">
              ${[['Total tracked', stats.total, 'var(--fg)'],['Progressed', stats.progressed, 'var(--teal)'],['Rejected', stats.rejected, '#ff6b6b'],['Response rate', stats.response_rate + '%', stats.response_rate >= 20 ? 'var(--teal)' : '#f5a623']].map(([l,v,c]) => `<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 16px;text-align:center"><div style="font-size:22px;font-weight:700;color:${c}">${v ?? '—'}</div><div style="font-size:10px;color:var(--dim);margin-top:2px">${l}</div></div>`).join('')}
            </div>`;
          }
        }).catch(() => {});
      }, 100);
    };
  } else {
    // DOM event fallback
    document.addEventListener('click', e => {
      const ni = e.target.closest('.ni[data-panel]');
      if (!ni) return;
      const panel = ni.dataset.panel;
      if (panel === 'followups') setTimeout(loadFollowupSchedule, 150);
    });
  }
})();
