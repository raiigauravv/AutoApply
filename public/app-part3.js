// ─── RESEARCH ────────────────────────────────────────────
async function runResearch(){
  const company=document.getElementById('res-company').value.trim();
  const role=document.getElementById('res-role').value.trim();
  if(!company){toast('Enter a company name','err');return;}
  document.getElementById('res-loading').style.display='block';
  document.getElementById('res-result').style.display='none';
  const msgs=['Searching the web...','Reading company pages...','Checking recent news...','Analyzing funding signals...','Synthesizing research...'];
  let i=0;const iv=setInterval(()=>{const m=document.getElementById('res-load-msg');if(m)m.textContent=msgs[i++%msgs.length];},1800);
  try{
    const r=await fetch(API+'/api/research/company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company,role})});
    const data=await r.json();
    clearInterval(iv);
    document.getElementById('res-loading').style.display='none';
    if(!data.success)throw new Error(data.error);
    document.getElementById('res-title').textContent='Research: '+company;
    if(data.live_search){
      const badge=document.getElementById('res-live-badge');
      if(badge){badge.textContent='🌐 Live';badge.style.display='inline';}
    }
    document.getElementById('res-content').innerHTML=markdownToHTML(data.research);
    // Render live sources if available
    if(typeof renderResearchSources==='function') renderResearchSources(data.sources||[]);
    document.getElementById('res-result').style.display='block';
  }catch(e){clearInterval(iv);document.getElementById('res-loading').style.display='none';toast('Error: '+e.message,'err');}
}

async function runOutreach(){
  const company=document.getElementById('out-company')?.value.trim();
  const role=document.getElementById('out-role')?.value.trim();
  if(!company||!role){toast('Enter company and role','err');return;}
  const loadEl=document.getElementById('out-loading');
  const resultEl=document.getElementById('out-result');
  const contentEl=document.getElementById('out-content');
  if(loadEl)loadEl.style.display='block';
  if(resultEl)resultEl.style.display='none';
  try{
    const r=await fetch(API+'/api/research/outreach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company,role,contact_name:document.getElementById('out-contact')?.value,contact_title:document.getElementById('out-title')?.value,jd:document.getElementById('out-jd')?.value})});
    const data=await r.json();
    if(loadEl)loadEl.style.display='none';
    if(!data.success)throw new Error(data.error||'API error');
    if(contentEl)contentEl.textContent=data.outreach||'No content returned';
    if(resultEl)resultEl.style.display='block';
  }catch(e){if(loadEl)loadEl.style.display='none';toast('Error: '+e.message,'err');}
}

function copyOutreach(){navigator.clipboard.writeText(document.getElementById('out-content').textContent);toast('Copied!','ok');}

async function genStarStories(){
  if(!lastEval){toast('Run an evaluation first','err');return;}
  const jd=document.getElementById('jd-input').value;
  toast('Generating STAR stories...');
  try{
    const r=await fetch(API+'/api/research/star-stories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:lastEval.role,company:lastEval.company,jd,count:5})});
    const data=await r.json();
    if(!data.success)throw new Error(data.error);
    showModal('STAR Stories — '+lastEval.company,markdownToHTML(data.stories));
  }catch(e){toast('Error: '+e.message,'err');}
}

async function generateStarBank(){
  toast('Generating STAR story bank...');
  try{
    const r=await fetch(API+'/api/research/star-stories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'ML Engineer',company:'General',count:6})});
    const data=await r.json();
    if(!data.success)throw new Error(data.error);
    showModal('STAR Story Bank',markdownToHTML(data.stories));
  }catch(e){toast('Error: '+e.message,'err');}
}

async function genNegotiate(type){
  const company=lastEval?.company||'Company';
  const role=lastEval?.role||'ML Engineer';
  toast('Generating negotiation scripts...');
  try{
    const r=await fetch(API+'/api/research/negotiate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company,role,type})});
    const data=await r.json();
    if(!data.success)throw new Error(data.error);
    showModal('Negotiation Scripts — '+company,markdownToHTML(data.scripts));
  }catch(e){toast('Error: '+e.message,'err');}
}

async function genFollowup(){
  const company=document.getElementById('fu-company')?.value||lastEval?.company||'Company';
  const status=document.getElementById('fu-status')?.value||'applied';
  toast('Generating follow-up plan...');
  try{
    const r=await fetch(API+'/api/research/followup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company,role:lastEval?.role||'ML Engineer',status})});
    const data=await r.json();
    if(!data.success)throw new Error(data.error);
    showModal('Follow-up Plan — '+company,markdownToHTML(data.followup));
  }catch(e){toast('Error: '+e.message,'err');}
}

async function genOutreach(){genNegotiate('salary');}

// ─── TRAINING / CERT EVAL ────────────────────────────────
async function runTrainingEval(){
  const cert_name=document.getElementById('train-cert').value.trim();
  if(!cert_name){toast('Enter certification name','err');return;}
  document.getElementById('train-loading').style.display='block';
  document.getElementById('train-result').style.display='none';
  try{
    const r=await fetch(API+'/api/research/training',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cert_name,provider:document.getElementById('train-provider').value,cost:document.getElementById('train-cost').value,time_weeks:document.getElementById('train-time').value,reason:document.getElementById('train-reason').value})});
    const data=await r.json();
    document.getElementById('train-loading').style.display='none';
    if(!data.success)throw new Error(data.error);
    document.getElementById('train-content').innerHTML=markdownToHTML(data.evaluation);
    document.getElementById('train-result').style.display='block';
  }catch(e){document.getElementById('train-loading').style.display='none';toast('Error: '+e.message,'err');}
}

// ─── PROJECT EVAL ────────────────────────────────────────
async function runProjectEval(){
  const project_idea=document.getElementById('proj-idea').value.trim();
  if(!project_idea){toast('Describe your project idea','err');return;}
  document.getElementById('proj-loading').style.display='block';
  document.getElementById('proj-result').style.display='none';
  try{
    const r=await fetch(API+'/api/research/project',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project_idea,tech_stack:document.getElementById('proj-stack').value,time_weeks:document.getElementById('proj-time').value,goal:document.getElementById('proj-goal').value})});
    const data=await r.json();
    document.getElementById('proj-loading').style.display='none';
    if(!data.success)throw new Error(data.error);
    document.getElementById('proj-content').innerHTML=markdownToHTML(data.evaluation);
    document.getElementById('proj-result').style.display='block';
  }catch(e){document.getElementById('proj-loading').style.display='none';toast('Error: '+e.message,'err');}
}

function evalCert(){switchTo('training');}
function evalProject(){switchTo('project');}

// ─── APPLY MODE ──────────────────────────────────────────
async function runPrefill(){
  const url=document.getElementById('apply-url').value.trim();
  const jd=document.getElementById('apply-jd').value.trim();
  if(!url&&!jd){toast('Enter a URL or JD','err');return;}
  const qs=document.getElementById('apply-custom-q').value.trim();
  const custom_questions=qs?qs.split('\n').filter(l=>l.trim()):[];
  if(url)document.getElementById('apply-ats-hint').textContent='Detecting ATS...';
  document.getElementById('apply-loading').style.display='block';
  document.getElementById('apply-step1').style.display='none';
  const msgs=['Reading form fields...','Detecting ATS type...','Analyzing form structure...','Generating answers...','Writing cover letter...','Almost done...'];
  let i=0;const iv=setInterval(()=>document.getElementById('apply-load-msg').textContent=msgs[i++%msgs.length],1200);
  try{
    const r=await fetch(API+'/api/apply/prefill',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,jd,evalResult:lastEval,custom_questions})});
    const data=await r.json();
    clearInterval(iv);
    document.getElementById('apply-loading').style.display='none';
    if(!data.success)throw new Error(data.error);
    renderApplyResult(data);
  }catch(e){clearInterval(iv);document.getElementById('apply-loading').style.display='none';document.getElementById('apply-step1').style.display='block';toast('Error: '+e.message,'err');}
}

function renderApplyResult(data){
  document.getElementById('apply-role-title').textContent=(data.meta?.role||'Application')+' at '+(data.meta?.company||'Company');
  document.getElementById('apply-ats-type').textContent='ATS: '+(data.ats_type||'generic').toUpperCase()+(data.url?' · '+data.url:'');
  const fields=data.form_fields?.fields||[];
  const answers=data.answers?.answers||{};
  document.getElementById('apply-fields-container').innerHTML=fields.map(f=>{
    const val=answers[f.id]||'';
    if(f.type==='file')return '';
    const isTA=f.type==='textarea'||val.length>100;
    const input=isTA?`<textarea class="apply-field-value" rows="3" id="af-${f.id}">${val}</textarea>`:`<input class="apply-field-value" type="text" id="af-${f.id}" value="${val.replace(/"/g,'&quot;')}">`;
    return `<div class="apply-field"><div class="apply-field-label">${f.label}${f.required?'<span class="req">required</span>':''}<span style="margin-left:auto;color:var(--dim)">${f.section||''}</span></div>${input}</div>`;
  }).join('');
  const cl=data.answers?.cover_letter||'';
  if(cl){
    document.getElementById('apply-cover-letter').value=cl;
    document.getElementById('apply-cover-card').style.display='block';
    document.getElementById('cl-wordcount').textContent=cl.split(/\s+/).length+' words';
    document.getElementById('chk-cover').querySelector('span:last-child').textContent='Done ✓';
    document.getElementById('chk-cover').querySelector('span:last-child').style.color='var(--teal)';
  }
  const cq=data.answers?.custom_answers||{};
  const cqKeys=Object.keys(cq);
  if(cqKeys.length>0){
    document.getElementById('apply-custom-answers').innerHTML=cqKeys.map(q=>`<div class="apply-field"><div class="apply-field-label">${q}</div><textarea class="apply-field-value" rows="3">${cq[q]}</textarea></div>`).join('');
    document.getElementById('apply-custom-container').style.display='block';
  }
  const tips=data.answers?.tips||[];
  if(tips.length>0){
    document.getElementById('apply-tips-content').innerHTML=tips.map(t=>`<div style="display:flex;gap:8px;margin-bottom:6px"><span style="color:var(--accent)">→</span><span>${t}</span></div>`).join('');
    document.getElementById('apply-tips').style.display='block';
  }
  document.getElementById('apply-result').style.display='block';
}

function copyAllAnswers(){
  const fields=document.querySelectorAll('.apply-field-value');
  const text=Array.from(fields).map(f=>`${f.id?.replace('af-','')}: ${f.value||f.textContent}`).join('\n\n');
  navigator.clipboard.writeText(text);toast('All answers copied!','ok');
}

function copyCoverLetter(){navigator.clipboard.writeText(document.getElementById('apply-cover-letter').value);toast('Cover letter copied!','ok');}

async function regenCoverLetter(){
  const jd=document.getElementById('apply-jd').value;
  const tone=document.getElementById('cl-tone').value;
  toast('Regenerating cover letter...');
  try{
    const r=await fetch(API+'/api/apply/cover-letter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jd,evalResult:lastEval,tone})});
    const data=await r.json();
    if(!data.success)throw new Error(data.error);
    document.getElementById('apply-cover-letter').value=data.cover_letter;
    document.getElementById('cl-wordcount').textContent=data.cover_letter.split(/\s+/).length+' words';
    toast('Cover letter regenerated','ok');
  }catch(e){toast('Error: '+e.message,'err');}
}

function goApplyMode(){switchTo('apply');}
