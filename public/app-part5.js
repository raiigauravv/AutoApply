// ═══ PORTALS MANAGEMENT ══════════════════════════════════════
async function loadPortals() {
  const el = document.getElementById('portals-list');
  if (!el) return;
  try {
    const r = await fetch(API + '/api/portals/all');
    const data = await r.json();
    const cats = data.portals || {};
    let html = '';
    for (const [catKey, cat] of Object.entries(cats)) {
      const portals = cat.portals || [];
      html += `<div style="margin-bottom:18px">
        <div style="font-size:10px;font-family:var(--mono);color:var(--dim);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">${cat.label || catKey} (${portals.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">`;
      for (const p of portals) {
        const srcColor = p.type === 'greenhouse' ? 'var(--teal)' : p.type === 'lever' ? 'var(--purple)' : p.type === 'ashby' ? 'var(--accent)' : p.type === 'workday' ? 'var(--amber)' : 'var(--muted)';
        html += `<div style="display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:5px 10px;font-size:12px">
          <span style="width:6px;height:6px;border-radius:50%;background:${srcColor};flex-shrink:0"></span>
          <span>${p.name}</span>
          <span style="font-family:var(--mono);font-size:9px;color:var(--dim)">${p.type}</span>
          <button onclick="deletePortal('${p.slug}')" style="background:none;border:none;cursor:pointer;color:var(--dim);font-size:14px;padding:0;line-height:1;margin-left:2px" title="Remove">×</button>
        </div>`;
      }
      html += `</div></div>`;
    }
    el.innerHTML = html || '<div class="hint">No portals loaded.</div>';
  } catch (e) {
    if (el) el.innerHTML = `<div class="hint" style="color:var(--coral)">Error: ${e.message}</div>`;
  }
}

async function addPortal() {
  const name = document.getElementById('portal-name')?.value?.trim();
  const slug = document.getElementById('portal-slug')?.value?.trim();
  const type = document.getElementById('portal-type')?.value;
  const category = document.getElementById('portal-category')?.value;
  if (!name || !slug) { toast('Name and slug are required', 'err'); return; }
  try {
    const r = await fetch(API + '/api/portals/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug, type, category })
    });
    const data = await r.json();
    if (!data.success) throw new Error(data.error);
    toast(`Added ${name}!`, 'ok');
    document.getElementById('portal-name').value = '';
    document.getElementById('portal-slug').value = '';
    loadPortals();
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

async function deletePortal(slug) {
  try {
    const r = await fetch(API + '/api/portals/' + slug, { method: 'DELETE' });
    const data = await r.json();
    if (!data.success) throw new Error(data.error);
    toast('Removed ' + slug, 'ok');
    loadPortals();
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

// ═══ DASHBOARD CHARTS ════════════════════════════════════════
let _chartGrades = null;
let _chartSources = null;

function renderDashboardCharts(stats) {
  if (typeof Chart === 'undefined') return;

  // Chart defaults for dark theme
  Chart.defaults.color = '#7A8292';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
  Chart.defaults.font.family = "'DM Mono', monospace";
  Chart.defaults.font.size = 11;

  // ── Grade distribution donut ──
  const gradeCanvas = document.getElementById('chart-grades');
  if (gradeCanvas) {
    const grades = stats?.by_grade || {};
    const labels = Object.keys(grades);
    const values = Object.values(grades);
    const gradeColors = {
      'A+': '#00E5CC', 'A': '#00E5CC', 'A-': '#00C4AE',
      'B+': '#C8FF57', 'B': '#B8EF47', 'B-': '#A8DF37',
      'C+': '#F5A623', 'C': '#F5A623', 'C-': '#E5922A',
      'D': '#FF6B6B', 'F': '#FF4444',
    };
    const colors = labels.map(l => gradeColors[l] || '#555');
    if (_chartGrades) _chartGrades.destroy();
    _chartGrades = new Chart(gradeCanvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 10, padding: 12 } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} jobs` } }
        },
        cutout: '65%'
      }
    });
  }

  // ── Jobs by source bar chart ──
  const srcCanvas = document.getElementById('chart-sources');
  if (srcCanvas) {
    const sources = stats?.by_source || {};
    const srcLabels = Object.keys(sources);
    const srcValues = Object.values(sources);
    const srcColors = { greenhouse: '#00E5CC', lever: '#9B8AFA', ashby: '#C8FF57', workday: '#F5A623', smartrecruiters: '#FF6B6B' };
    const bgColors = srcLabels.map(l => srcColors[l] || '#555');
    if (_chartSources) _chartSources.destroy();
    _chartSources = new Chart(srcCanvas, {
      type: 'bar',
      data: {
        labels: srcLabels,
        datasets: [{ data: srcValues, backgroundColor: bgColors, borderRadius: 4, borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }
}

// ═══ RESEARCH SOURCES DISPLAY ════════════════════════════════
function renderResearchSources(sources) {
  const el = document.getElementById('research-sources');
  if (!el || !sources?.length) return;
  el.innerHTML = `<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
    <div style="font-size:10px;font-family:var(--mono);color:var(--dim);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">🌐 Live sources (fetched now)</div>
    ${sources.slice(0, 6).map(s => `<div style="margin-bottom:8px">
      <a href="${s.url}" target="_blank" style="color:var(--accent);font-size:12px;text-decoration:none;font-weight:500">${s.title || s.url}</a>
      <div style="font-size:11px;color:var(--dim);margin-top:2px">${s.snippet || ''}</div>
    </div>`).join('')}
  </div>`;
  el.style.display = 'block';
}

// ═══ INIT HOOKS ══════════════════════════════════════════════
// Called when portals panel is shown
const _origSwitchTo = window.switchTo;
if (typeof window.switchTo === 'function') {
  window.switchTo = function(panel) {
    _origSwitchTo(panel);
    if (panel === 'portals') loadPortals();
    if (panel === 'dashboard') {
      // Trigger chart render after dashboard loads
      setTimeout(() => {
        fetch(API + '/api/history/stats').then(r => r.json()).then(d => {
          if (d.success) renderDashboardCharts(d.stats);
        }).catch(() => {});
      }, 400);
    }
  };
} else {
  // Fallback: patch after DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.ni[data-panel]').forEach(ni => {
      ni.addEventListener('click', () => {
        const panel = ni.dataset.panel;
        if (panel === 'portals') setTimeout(loadPortals, 100);
        if (panel === 'dashboard') {
          setTimeout(() => {
            fetch(API + '/api/history/stats').then(r => r.json()).then(d => {
              if (d.success) renderDashboardCharts(d.stats);
            }).catch(() => {});
          }, 400);
        }
      });
    });
  });
}
