const API='';
let lastEval=null,trackerApps=[],pdfPreviewData=null;

const PANEL_META={
  evaluate:['Evaluate JD','paste a job description to score it'],
  scanner:['Portal Scanner','scrapes 45+ company portals for ML/AI roles'],
  batch:['Batch Evaluation','evaluate up to 20 JDs in parallel'],
  tracker:['Applications','your full pipeline tracker'],
  interview:['Interview Prep','STAR story bank + negotiation toolkit'],
  outreach:['Cold Outreach','email + LinkedIn message generator'],
  research:['Deep Research','company funding, stack, culture, interview intel'],
  modes:['All Modes','14 AI-powered pipelines'],
  profile:['Profile & CV','cv.md + profile.yml + scoring weights'],
  apply:['Apply Mode','smart pre-fill for ATS forms'],
  dashboard:['Dashboard','full pipeline overview'],
  pipeline:['Pipeline','job queue processor'],
  scheduler:['Scheduler','auto-scan scheduler'],
  training:['Cert Evaluator','is this certification worth your time?'],
  project:['Project Evaluator','is this portfolio project worth building?'],
};

const LOAD_MSGS=['Reading job description...','Parsing requirements...','Matching against your CV...','Scoring 10 dimensions...','Evaluating work auth...','Checking stack overlap...','Generating strategy...','Almost done...'];

document.querySelectorAll('.ni').forEach(el=>el.addEventListener('click',()=>switchTo(el.dataset.panel)));

function switchTo(id){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('on'));
  const panel=document.getElementById('panel-'+id);
  if(panel)panel.classList.add('on');
  document.querySelectorAll(`.ni[data-panel="${id}"]`).forEach(n=>n.classList.add('on'));
  const[title,sub]=PANEL_META[id]||[id,''];
  document.getElementById('tb-title').textContent=title;
  document.getElementById('tb-sub').textContent=sub;
  if(id==='tracker')loadTracker();
  if(id==='profile')loadProfile();
  if(id==='dashboard')loadDashboard();
  if(id==='pipeline'){loadPipelineQueue();connectPipelineSSE();}
  if(id==='scheduler')loadScheduler();
}

async function checkAPI(){
  try{
    const r=await fetch(API+'/api/tracker');
    if(r.ok){document.getElementById('api-dot').className='api-dot ok';document.getElementById('api-status-text').textContent='server connected';}
    else throw new Error();
  }catch(e){document.getElementById('api-dot').className='api-dot err';document.getElementById('api-status-text').textContent='server offline';}
}

// ─── EVALUATE ───────────────────────────────────────────
async function runEval(){
  const jd=document.getElementById('jd-input').value.trim();
  if(jd.length<20){toast('Paste a job description first','err');return;}
  const mode = document.getElementById('eval-mode').value;
  const language = document.getElementById('eval-lang')?.value || '';
  document.getElementById('eval-result').style.display='none';
  document.getElementById('eval-loading').style.display='block';
  document.getElementById('btn-report').style.display='none';
  let i=0;
  const iv=setInterval(()=>{document.getElementById('load-msg').textContent=LOAD_MSGS[i++%LOAD_MSGS.length];},900);
  try{
    const r=await fetch(API+'/api/evaluate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jd,mode,language})});
    const data=await r.json();
    clearInterval(iv);
    document.getElementById('eval-loading').style.display='none';
    if(!data.success)throw new Error(data.error);
    lastEval=data.result;
    showEvalResult(data.result);
  }catch(e){clearInterval(iv);document.getElementById('eval-loading').style.display='none';toast('Error: '+e.message,'err');}
}

function showEvalResult(r){
  const gradeMap={a:'ga',b:'gb',c:'gc',d:'gd',f:'gf'};
  const gl=r.grade_letter||'b';
  document.getElementById('r-score').textContent=r.score||'—';
  const gb=document.getElementById('r-grade-badge');
  gb.className='grade '+(gradeMap[gl]||'gb');
  gb.style.cssText='padding:5px 11px;font-size:19px';
  gb.textContent=r.grade||'—';
  document.getElementById('r-archetype').textContent='Archetype: '+(r.archetype||'—');
  document.getElementById('r-legitimacy').textContent = r.legitimacy_tier ? `Legitimacy: ${r.legitimacy_tier}` : '';
  if (r.legitimacy_reason) document.getElementById('r-legitimacy').title = r.legitimacy_reason;
  document.getElementById('r-match').textContent=(r.cv_match_pct||0)+'%';
  document.getElementById('r-match-bar').style.width=(r.cv_match_pct||0)+'%';
  document.getElementById('r-skills').textContent=(r.skill_coverage_pct||0)+'%';
  document.getElementById('r-skills-bar').style.width=(r.skill_coverage_pct||0)+'%';
  const rec=document.getElementById('r-rec');
  const isApply=r.apply_recommendation==='Yes';
  rec.textContent=isApply?'Apply ✓':'Skip ✗';
  rec.style.color=isApply?'var(--teal)':'var(--coral)';
  document.getElementById('r-rec-sub').textContent=r.apply_reason||'';
  document.getElementById('r-role-lbl').textContent=(r.company||'Company')+' — '+(r.role||'Role');
  document.getElementById('r-summary').innerHTML=(r.summary||'').replace(/\n/g,'<br>');
  document.getElementById('r-match-notes').innerHTML=(r.cv_match_notes||'').replace(/\n/g,'<br>').replace(/•/g,'<span style="color:var(--teal)">•</span>');
  document.getElementById('r-gaps').innerHTML=(r.gaps||'').replace(/\n/g,'<br>').replace(/•/g,'<span style="color:var(--coral)">•</span>');
  document.getElementById('r-strategy').innerHTML=(r.strategy||'').replace(/\n/g,'<br>');
  document.getElementById('r-comp').textContent=r.comp_range?'Est. comp: '+r.comp_range:'';
  const dims=r.dimensions||[];
  document.getElementById('r-dims').innerHTML=dims.map(d=>{
    const col=d.score>=8?'var(--accent)':d.score>=6?'var(--teal)':d.score>=4?'var(--amber)':'var(--coral)';
    return `<div class="drow"><span class="dlabel">${d.label}</span><div class="dbar"><div class="dfill" style="width:${d.score*10}%;background:${col}"></div></div><span class="dscore" style="color:${col}">${d.score}</span></div>`;
  }).join('');
  document.getElementById('r-keywords').innerHTML=(r.keywords||[]).map(k=>`<span class="tag">${k}</span>`).join('');
  document.getElementById('r-green-flags').innerHTML=(r.green_flags||[]).map(f=>`<span class="flag-green">✓ ${f}</span>`).join('');
  document.getElementById('r-red-flags').innerHTML=(r.red_flags||[]).map(f=>`<span class="flag-red">⚠ ${f}</span>`).join('');
  document.getElementById('r-interview-angles').innerHTML=(r.interview_angles||[]).map(a=>`<span class="tag" style="border-color:rgba(155,138,250,.3);color:var(--purple)">${a}</span>`).join('');
  document.getElementById('r-star-hooks').innerHTML=(r.star_story_hooks||[]).map(s=>`<span class="tag" style="border-color:rgba(200,255,87,.25);color:var(--accent)">${s}</span>`).join('');
  document.getElementById('eval-result').style.display='block';
  document.getElementById('btn-report').style.display='inline-flex';
}

async function generateReport(){
  if(!lastEval){toast('Run an evaluation first','err');return;}
  toast('Generating full report...');
  try{
    const r=await fetch(API+'/api/evaluate/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({evalResult:lastEval})});
    const data=await r.json();
    if(!data.success)throw new Error(data.error);
    showModal('Full Report — '+lastEval.company,markdownToHTML(data.report));
  }catch(e){toast('Error: '+e.message,'err');}
}

function markdownToHTML(md){
  return md
    .replace(/^## (.+)$/gm,'<h2>$1</h2>')
    .replace(/^### (.+)$/gm,'<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/^- (.+)$/gm,'<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g,'<ul>$&</ul>')
    .replace(/\n\n/g,'<br><br>')
    .replace(/\n/g,'<br>');
}
