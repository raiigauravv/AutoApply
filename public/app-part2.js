// ─── PDF ────────────────────────────────────────────────
async function genPDF(){
  if(!lastEval){toast('Run an evaluation first','err');return;}
  const jd=document.getElementById('jd-input').value;
  if(!jd||jd.trim().length<20){toast('Paste a job description first','err');return;}
  toast('Creating tailored resume preview...');
  try{
    const r=await fetch(API+'/api/pdf/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({evalResult:lastEval,jd})});
    const data=await r.json();
    if(!data.success)throw new Error(data.error);
    pdfPreviewData=data;
    showPDFPreviewModal(data.previewHTML,lastEval.company);
    toast('Resume preview ready','ok');
  }catch(e){toast('Error: '+e.message,'err');}
}

function showPDFPreviewModal(html,company){
  const modal=document.getElementById('modal');
  document.getElementById('modal-title').textContent=`Preview: Resume for ${company||'Opportunity'}`;
  const enc=btoa(unescape(encodeURIComponent(html)));
  document.getElementById('modal-body').innerHTML=`<iframe src="data:text/html;base64,${enc}" style="width:100%;height:600px;border:1px solid #333;border-radius:8px;background:white"></iframe>`;
  document.getElementById('modal-foot').innerHTML=`<button class="btn" onclick="closePDFPreviewModal()">Cancel</button><button class="btn btn-g" onclick="downloadPDF()">Download PDF</button>`;
  modal.classList.add('show');
}

function closePDFPreviewModal(){
  document.getElementById('modal').classList.remove('show');
  pdfPreviewData=null;
  document.getElementById('modal-foot').innerHTML=`<button class="btn btn-sm" onclick="copyModal()">Copy</button><button class="btn btn-sm" onclick="closeModal()">Close</button>`;
}

async function downloadPDF(){
  if(!pdfPreviewData?.selectedContent){toast('No preview data','err');return;}
  toast('Generating PDF...');
  try{
    const r=await fetch(API+'/api/pdf/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({selectedContent:pdfPreviewData.selectedContent,evalResult:lastEval})});
    const data=await r.json();
    if(!data.success)throw new Error(data.error);
    closePDFPreviewModal();
    toast('Downloading...','ok');
    window.open(API+'/api/pdf/download/'+data.filename,'_blank');
  }catch(e){toast('Error: '+e.message,'err');}
}

function genPDFFromApply(){
  if(!lastEval)lastEval={company:'tailored',role:'role'};
  genPDF();
}

// ─── TRACKER ─────────────────────────────────────────────
async function loadTracker(){
  try{
    const r=await fetch(API+'/api/tracker');
    const data=await r.json();
    trackerApps=data.applications||[];
    renderTracker();
    loadStats();
    document.getElementById('app-badge').textContent=trackerApps.length;
  }catch(e){}
}

function renderTracker(){
  const filter=(document.getElementById('tracker-filter')?.value||'').toLowerCase();
  const apps=trackerApps.filter(a=>!filter||a.company?.toLowerCase().includes(filter)||a.role?.toLowerCase().includes(filter));
  const tbody=document.getElementById('tracker-tbody');
  const empty=document.getElementById('tracker-empty');
  if(apps.length===0){tbody.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';
  const statusColors={applied:'var(--accent)',phone_screen:'var(--amber)',interview:'var(--teal)',final_round:'var(--accent)',offer:'var(--teal)',rejected:'var(--coral)',ghosted:'var(--dim)',new:'var(--purple)'};
  tbody.innerHTML=apps.map(a=>{
    const initials=(a.company||'?').substring(0,2).toUpperCase();
    const hue=Math.abs(initials.charCodeAt(0)*17+initials.charCodeAt(1)*13)%360;
    return `<tr>
      <td><div class="cocel"><div class="avt" style="background:hsl(${hue},35%,22%);color:hsl(${hue},60%,65%)">${initials}</div><div><div style="font-weight:500">${a.company||'—'}</div><div style="font-size:10px;color:var(--dim);font-family:var(--mono)">${a.url?`<a href="${a.url}" target="_blank" style="color:var(--dim);text-decoration:none">↗ link</a>`:''}</div></div></div></td>
      <td style="color:var(--muted)">${a.role||'—'}</td>
      <td>${a.grade?`<span class="grade g${(a.grade_letter||'b')}" style="padding:3px 9px;font-size:12px">${a.grade}</span>`:'—'}</td>
      <td><span class="pill p${a.status||'new'}">${(a.status||'new').replace(/_/g,' ')}</span></td>
      <td style="color:var(--dim);font-family:var(--mono);font-size:11px">${a.added_at?new Date(a.added_at).toLocaleDateString():'—'}</td>
      <td style="color:var(--muted);font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.notes||''}</td>
      <td>
        <select class="sel" style="font-size:11px;padding:3px 7px" onchange="updateStatus('${a.id}',this.value)">
          ${['new','applied','phone_screen','interview','final_round','offer','rejected','ghosted'].map(s=>`<option value="${s}"${a.status===s?' selected':''}>${s.replace(/_/g,' ')}</option>`).join('')}
        </select>
      </td>
    </tr>`;
  }).join('');
}

async function loadStats(){
  try{
    const r=await fetch(API+'/api/tracker/stats');
    const d=await r.json();
    document.getElementById('t-total').textContent=d.total||0;
    document.getElementById('t-progress').textContent=d.in_progress||0;
    document.getElementById('t-interviews').textContent=d.interviews||0;
    document.getElementById('t-rate').textContent=(d.response_rate||0)+'%';
  }catch(e){}
}

async function addToTracker(){
  if(!lastEval){toast('Run an evaluation first','err');return;}
  try{
    const r=await fetch(API+'/api/tracker',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company:lastEval.company,role:lastEval.role,grade:lastEval.grade,grade_letter:lastEval.grade_letter,score:lastEval.score,url:lastEval.url||'',status:'new',notes:''})});
    const data=await r.json();
    if(!data.success)throw new Error(data.error);
    toast('Added to tracker!','ok');
    loadTracker();
  }catch(e){toast(e.message,'err');}
}

async function addToTrackerFromApply(){addToTracker();}

async function updateStatus(id,status){
  try{
    await fetch(API+'/api/tracker/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});
    const app=trackerApps.find(a=>a.id==id);
    if(app)app.status=status;
    toast('Status updated','ok');
  }catch(e){toast('Error','err');}
}

// ─── SCAN ────────────────────────────────────────────────
async function runScan(){
  const categories=['ai_labs','llmops','ai_platforms','toronto_focused','automation'].filter(c=>document.getElementById('cat-'+c)?.checked);
  document.getElementById('scan-loading').style.display='block';
  document.getElementById('scan-results').style.display='none';
  document.getElementById('scan-empty').style.display='none';
  document.getElementById('scan-btn').disabled=true;
  let t=0;
  const iv=setInterval(()=>{document.getElementById('scan-msg').textContent=['Scanning portals...','Checking Greenhouse...','Checking Lever...','Checking Ashby...','Filtering ML/AI roles...','Scoring relevance...','Almost done...'][t++%7];},1200);
  try{
    const r=await fetch(API+'/api/scan/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({categories,filterRelevantOnly:true,newOnly:true,addToQueue:false})});
    const data=await r.json();
    clearInterval(iv);
    document.getElementById('scan-loading').style.display='none';
    document.getElementById('scan-btn').disabled=false;
    if(!data.success)throw new Error(data.error);
    renderScanResults(data);
  }catch(e){clearInterval(iv);document.getElementById('scan-loading').style.display='none';document.getElementById('scan-btn').disabled=false;toast('Scan error: '+e.message,'err');}
}

function renderScanResults(data){
  const el=document.getElementById('scan-results');
  if(!data.jobs||data.jobs.length===0){document.getElementById('scan-empty').style.display='block';toast('No new jobs found');return;}
  const grouped={};
  data.jobs.forEach(j=>{const c=j.category||'other';if(!grouped[c])grouped[c]=[];grouped[c].push(j);});
  el.innerHTML=`<div class="card" style="margin-bottom:14px"><div style="display:flex;gap:20px;font-family:var(--mono);font-size:12px"><span>Scanned: <strong style="color:var(--text)">${data.total_scanned||0}</strong></span><span>Relevant: <strong style="color:var(--accent)">${data.total_relevant||0}</strong></span><span>New: <strong style="color:var(--teal)">${data.new_this_scan||0}</strong></span><span>Portals: <strong style="color:var(--muted)">${data.portals_checked||0}</strong></span></div></div>`+
    Object.entries(grouped).map(([cat,jobs])=>`<div class="scan-cat"><div class="scan-cat-title">${cat.replace(/_/g,' ')} (${jobs.length})</div>${jobs.map(j=>{
      const score=j.relevance_score||0;const col=score>=8?'var(--teal)':score>=6?'var(--accent)':'var(--muted)';
      return `<div class="job-card"><div class="job-info"><div class="job-title">${j.title||'Unknown'}</div><div class="job-meta">${j.portal_name||j.company||'?'} · ${j.location||'?'} · ${j.source||''}</div>${j.apply_signal?`<div style="font-size:11px;color:var(--dim);margin-top:3px">${j.apply_signal}</div>`:''}</div><div class="job-score"><div class="rel-score" style="color:${col}">${score>0?score:'—'}</div><div style="font-size:9px;color:var(--dim);font-family:var(--mono)">fit</div></div><div style="flex-shrink:0"><a href="${j.url}" target="_blank" class="btn btn-xs" style="margin-bottom:4px;display:block;text-align:center">Open ↗</a><button class="btn btn-xs btn-g" onclick='evalFromScan(${JSON.stringify(j).replace(/'/g,"&#39;")})'>Eval</button></div></div>`;
    }).join('')}</div>`).join('');
  el.style.display='block';
  toast(`Found ${data.new_this_scan||0} new jobs`,'ok');
}

async function evalFromScan(job){
  switchTo('evaluate');
  document.getElementById('jd-input').value=`${job.title} at ${job.portal_name||job.company}\n\n${job.content||''}`;
  await runEval();
}

// ─── BATCH ───────────────────────────────────────────────
async function runBatch(){
  const raw=document.getElementById('batch-input').value.trim();
  if(!raw){toast('Paste job descriptions first','err');return;}
  const jds=raw.split(/\n---+\n/).map((t,i)=>({id:'jd_'+i,text:t.trim()})).filter(j=>j.text.length>20);
  if(jds.length===0){toast('No valid JDs found','err');return;}
  document.getElementById('batch-loading').style.display='block';
  document.getElementById('batch-results').style.display='none';
  let i=0;const msgs=['Evaluating in parallel...','Processing batch...','Almost done...'];
  const iv=setInterval(()=>document.getElementById('batch-msg').textContent=msgs[i++%msgs.length],1500);
  try{
    const r=await fetch(API+'/api/batch/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jds})});
    const data=await r.json();
    clearInterval(iv);
    document.getElementById('batch-loading').style.display='none';
    if(!data.success)throw new Error(data.error);
    renderBatch(data);
  }catch(e){clearInterval(iv);document.getElementById('batch-loading').style.display='none';toast('Error: '+e.message,'err');}
}

function renderBatch(data){
  const gradeMap={a:'ga',b:'gb',c:'gc',d:'gd',f:'gf'};
  document.getElementById('batch-title').textContent=`Results — ${data.evaluated}/${data.total} evaluated`;
  document.getElementById('batch-tbody').innerHTML=data.results.map((r,i)=>`<tr>
    <td style="color:var(--dim);font-family:var(--mono);font-size:11px">${i+1}</td>
    <td style="font-weight:500">${r.company||'?'}</td>
    <td style="color:var(--muted)">${r.role||'?'}</td>
    <td><span class="grade g${r.grade_letter||'b'}" style="padding:3px 9px;font-size:12px">${r.grade||'—'}</span></td>
    <td style="font-family:var(--mono);font-size:12px">${r.cv_match_pct||0}%</td>
    <td style="color:${r.apply_recommendation==='Yes'?'var(--teal)':'var(--coral)'}">${r.apply_recommendation==='Yes'?'Yes ✓':'No ✗'}</td>
    <td style="color:var(--dim);font-size:12px;max-width:200px">${r.main_gap||'—'}</td>
    <td><button class="btn btn-xs" onclick="useFromBatch(${i})">Eval ↗</button></td>
  </tr>`).join('');
  document.getElementById('batch-results').style.display='block';
  window._batchResults=data.results;
}

function useFromBatch(i){const r=window._batchResults[i];if(!r)return;lastEval=r;switchTo('evaluate');toast('Loaded batch result #'+(i+1));}
