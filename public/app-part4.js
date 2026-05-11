// ─── PROFILE ─────────────────────────────────────────────
async function loadProfile(){
  try{
    const r=await fetch(API+'/api/profile');
    const data=await r.json();
    document.getElementById('cv-editor').value=data.cv||'';
    document.getElementById('profile-editor').value=data.profile||'';
  }catch(e){}
}

async function saveCV(){
  try{
    const r=await fetch(API+'/api/profile/cv',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:document.getElementById('cv-editor').value})});
    const data=await r.json();
    toast(data.success?'CV saved!':'Error: '+data.error,data.success?'ok':'err');
  }catch(e){toast('Error: '+e.message,'err');}
}

async function saveProfile(){
  try{
    const r=await fetch(API+'/api/profile/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:document.getElementById('profile-editor').value})});
    const data=await r.json();
    toast(data.success?'Profile saved!':'Error: '+data.error,data.success?'ok':'err');
  }catch(e){toast('Error: '+e.message,'err');}
}

async function loadOutputs(){
  try{
    const r=await fetch(API+'/api/profile/outputs');
    const data=await r.json();
    document.getElementById('outputs-list').innerHTML=(data.files||[]).length>0
      ?data.files.map(f=>`<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)"><span style="font-family:var(--mono);font-size:12px;color:var(--muted);flex:1">${f.name}</span><a href="/api/pdf/download/${f.name}" target="_blank" class="btn btn-xs">Download</a></div>`).join('')
      :'<div class="hint">No generated files yet.</div>';
  }catch(e){}
}

// ─── DASHBOARD ───────────────────────────────────────────
async function loadDashboard(){
  try{
    const[histR,trackerR]=await Promise.all([fetch(API+'/api/history/stats'),fetch(API+'/api/tracker/stats')]);
    const hist=await histR.json();
    const tracker=await trackerR.json();
    const stats=hist.stats||{};
    const t=tracker||{};
    setAnimated('d-scanned',stats.total||0);
    setAnimated('d-new',stats.new_last_7_days||0);
    setAnimated('d-evaluated',t.total||0);
    document.getElementById('d-rate').textContent=(t.response_rate||0)+'%';
    // Hero stats
    document.getElementById('dh-scanned').textContent=stats.total||'—';
    document.getElementById('dh-evaluated').textContent=t.total||'—';
    document.getElementById('dh-interviews').textContent=t.interviews||'—';
    // Funnel
    const funnelEl=document.getElementById('dash-funnel');
    const stages=[['Applied',t.applied||0,'var(--accent)'],['Phone Screen',t.phone_screen||0,'var(--amber)'],['Interview',t.interviews||0,'var(--teal)'],['Offer',t.offers||0,'var(--purple)']];
    funnelEl.innerHTML=stages.map(([lbl,n,col])=>`<div class="drow"><span class="dlabel">${lbl}</span><div class="dbar" style="width:100px"><div class="dfill" style="width:${Math.min(100,n*20)}%;background:${col}"></div></div><span class="dscore" style="color:${col}">${n}</span></div>`).join('');
    // Recent evals
    const reportsR=await fetch(API+'/api/evaluate/recent').catch(()=>null);
    if(reportsR&&reportsR.ok){
      const rData=await reportsR.json();
      const evals=rData.reports||[];
      document.getElementById('dash-recent-evals').innerHTML=evals.length?evals.slice(0,5).map(e=>`<div class="drow"><span class="dlabel" style="font-weight:500">${e.company||'?'} — ${e.role||'?'}</span><span class="grade g${e.grade_letter||'b'}" style="padding:2px 8px;font-size:11px">${e.grade||'—'}</span><span style="font-size:10px;color:var(--dim);font-family:var(--mono);margin-left:8px">${e.evaluated_at?new Date(e.evaluated_at).toLocaleDateString():''}</span></div>`).join(''):'<div class="hint">No evaluations yet.</div>';
    }
    // Feedback
    const fbR=await fetch(API+'/api/feedback/stats').catch(()=>null);
    if(fbR&&fbR.ok){const fb=await fbR.json();document.getElementById('dash-feedback-hint').textContent=`${fb.total||0} feedback entries`;}
  }catch(e){}
}

function setAnimated(id,target){
  const el=document.getElementById(id);
  if(!el)return;
  let cur=0;const step=Math.ceil(target/20);
  const iv=setInterval(()=>{cur=Math.min(cur+step,target);el.textContent=cur;if(cur>=target)clearInterval(iv);},40);
}

// ─── PIPELINE ────────────────────────────────────────────
let pipelineSSE=null;

async function loadPipelineQueue(){
  try{
    const r=await fetch(API+'/api/pipeline/status');
    const data=await r.json();
    const s=data.status||{};
    document.getElementById('ps-status').textContent=s.running?'running':'idle';
    document.getElementById('ps-status').style.color=s.running?'var(--teal)':'var(--dim)';
    document.getElementById('ps-workers').textContent=s.workers||0;
    document.getElementById('ps-processed').textContent=s.stats?.processed||0;
    document.getElementById('ps-failed').textContent=s.stats?.failed||0;
    const q=s.queue||{};
    document.getElementById('ps-pending').textContent=q.pending||0;
    document.getElementById('pipeline-badge').textContent=q.pending||0;
    const stats=document.getElementById('pipeline-queue-stats');
    stats.innerHTML=`<div class="drow"><span class="dlabel">Pending</span><span style="font-family:var(--mono);color:var(--amber)">${q.pending||0}</span></div><div class="drow"><span class="dlabel">Processing</span><span style="font-family:var(--mono);color:var(--teal)">${q.processing||0}</span></div><div class="drow"><span class="dlabel">Completed</span><span style="font-family:var(--mono);color:var(--accent)">${q.completed||0}</span></div><div class="drow"><span class="dlabel">Failed</span><span style="font-family:var(--mono);color:var(--coral)">${q.failed||0}</span></div>`;
    document.getElementById('pipeline-start-btn').style.display=s.running?'none':'inline-flex';
    document.getElementById('pipeline-stop-btn').style.display=s.running?'inline-flex':'none';
    // Queue list
    const jobs=data.status?.queue?.jobs||[];
    document.getElementById('queue-count-hint').textContent=jobs.length+' jobs';
    document.getElementById('pipeline-queue-list').innerHTML=jobs.slice(0,20).map(j=>`<div class="batch-row"><span class="pill p${j.status||'new'}" style="flex-shrink:0">${j.status||'pending'}</span><span style="flex:1;font-size:12px">${j.company||'?'} — ${j.title||'?'}</span>${j.grade?`<span class="grade g${j.grade_letter||'b'}" style="padding:2px 8px;font-size:11px">${j.grade}</span>`:''}</div>`).join('');
  }catch(e){}
}

async function startPipeline(){
  try{await fetch(API+'/api/pipeline/start',{method:'POST'});toast('Pipeline started','ok');setTimeout(loadPipelineQueue,500);}catch(e){toast('Error','err');}
}

async function stopPipeline(){
  try{await fetch(API+'/api/pipeline/stop',{method:'POST'});toast('Pipeline stopped');setTimeout(loadPipelineQueue,500);}catch(e){toast('Error','err');}
}

function connectPipelineSSE(){
  if(pipelineSSE)return;
  const logEl=document.getElementById('pipeline-log');
  try{
    pipelineSSE=new EventSource(API+'/api/pipeline/events');
    pipelineSSE.onmessage=e=>{
      const d=JSON.parse(e.data);
      const entry=document.createElement('div');
      entry.className='pipe-log-entry'+(d.type==='job_done'?' ok':d.type==='job_error'?' err':'');
      entry.textContent=`[${new Date().toLocaleTimeString()}] ${d.type}: ${d.company||''} ${d.grade||d.error||''}`;
      logEl.prepend(entry);
      if(logEl.children.length>50)logEl.removeChild(logEl.lastChild);
      loadPipelineQueue();
    };
  }catch(e){}
}

async function addURLsToQueue(){
  const urls=document.getElementById('queue-urls').value.trim().split('\n').filter(u=>u.trim());
  if(!urls.length){toast('Paste some URLs first','err');return;}
  try{
    const r=await fetch(API+'/api/pipeline/queue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({urls})});
    const data=await r.json();
    toast(`Added ${data.added||0} URLs to queue`,'ok');
    document.getElementById('queue-urls').value='';
    loadPipelineQueue();
  }catch(e){toast('Error: '+e.message,'err');}
}

async function scanAndQueue(){
  toast('Scanning + queueing...');
  try{
    const r=await fetch(API+'/api/scan/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({addToQueue:true,newOnly:true})});
    const data=await r.json();
    toast(`Queued ${data.new_this_scan||0} new jobs`,'ok');
    loadPipelineQueue();
  }catch(e){toast('Error: '+e.message,'err');}
}

async function clearQueue(type){
  try{await fetch(API+'/api/pipeline/queue/clear',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type})});toast('Queue cleared');loadPipelineQueue();}catch(e){toast('Error','err');}
}

// ─── SCHEDULER ───────────────────────────────────────────
async function loadScheduler(){
  try{
    const r=await fetch(API+'/api/scheduler/list');
    const data=await r.json();
    const scheds=data.schedules||[];
    document.getElementById('schedules-list').innerHTML=scheds.length?scheds.map(s=>`<div class="card" style="margin-bottom:10px"><div class="ch"><div><div style="font-weight:500;font-family:var(--head);font-style:italic">${s.name}</div><div style="font-size:11px;color:var(--dim);font-family:var(--mono);margin-top:2px">Every ${s.intervalDays} day(s) · Next: ${s.nextRun?new Date(s.nextRun).toLocaleString():'—'}</div></div><div style="display:flex;gap:6px"><button class="btn btn-xs ${s.enabled?'btn-t':''}" onclick="toggleSchedule('${s.id}',${!s.enabled})">${s.enabled?'Enabled':'Disabled'}</button><button class="btn btn-xs" style="color:var(--coral)" onclick="deleteSchedule('${s.id}')">Delete</button></div></div></div>`).join(''):'<div class="card"><div class="hint" style="text-align:center;padding:20px">No schedules yet. Create one above.</div></div>';
    const nextR=await fetch(API+'/api/scheduler/next');
    const nextD=await nextR.json();
    document.getElementById('scheduler-next-runs').innerHTML=(nextD.upcoming||[]).map(s=>`<div style="padding:5px 0;border-bottom:1px solid var(--border)"><strong style="color:var(--text)">${s.name}</strong> → ${s.nextRun?new Date(s.nextRun).toLocaleString():'?'}</div>`).join('')||'<div style="color:var(--dim)">No upcoming runs.</div>';
  }catch(e){}
}

function showAddSchedule(){document.getElementById('add-schedule-form').style.display='block';}

async function createSchedule(){
  const name=document.getElementById('sched-name').value.trim();
  if(!name){toast('Enter a schedule name','err');return;}
  const categories=Array.from(document.querySelectorAll('.sched-cat:checked')).map(c=>c.value);
  const intervalDays=parseInt(document.getElementById('sched-interval').value)||3;
  try{
    const r=await fetch(API+'/api/scheduler/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,type:'scan',intervalDays,categories})});
    const data=await r.json();
    if(!data.success)throw new Error(data.error);
    document.getElementById('add-schedule-form').style.display='none';
    document.getElementById('sched-name').value='';
    toast('Schedule created!','ok');
    loadScheduler();
  }catch(e){toast('Error: '+e.message,'err');}
}

async function toggleSchedule(id,enabled){
  try{await fetch(API+'/api/scheduler/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled})});loadScheduler();}catch(e){toast('Error','err');}
}

async function deleteSchedule(id){
  try{await fetch(API+'/api/scheduler/'+id,{method:'DELETE'});toast('Deleted');loadScheduler();}catch(e){toast('Error','err');}
}

function connectSchedulerSSE(){} // no SSE for scheduler currently

// ─── FEEDBACK ────────────────────────────────────────────
async function sendFeedback(type,msg){
  if(!lastEval){toast('No evaluation to give feedback on','err');return;}
  try{
    await fetch(API+'/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({evalResult:lastEval,feedbackType:type,feedback:msg})});
    toast('Feedback sent!','ok');
  }catch(e){toast('Error','err');}
}

async function sendCustomFeedback(){
  const msg=document.getElementById('feedback-custom').value.trim();
  if(!msg){toast('Enter feedback','err');return;}
  await sendFeedback('custom',msg);
  document.getElementById('feedback-custom').value='';
}

async function showStats(){
  try{
    const r=await fetch(API+'/api/history/stats');
    const data=await r.json();
    const s=data.stats||{};
    showModal('Pipeline Stats',`<div class="drow"><span class="dlabel">Total scanned</span><span style="font-family:var(--mono)">${s.total||0}</span></div><div class="drow"><span class="dlabel">New last 7 days</span><span style="font-family:var(--mono);color:var(--accent)">${s.new_last_7_days||0}</span></div><div class="drow"><span class="dlabel">Evaluated</span><span style="font-family:var(--mono);color:var(--teal)">${s.evaluated||0}</span></div>`);
  }catch(e){toast('Error','err');}
}

// ─── MODAL / TOAST / UTILS ───────────────────────────────
function showModal(title,html){
  document.getElementById('modal-title').textContent=title;
  document.getElementById('modal-body').innerHTML=html;
  document.getElementById('modal-foot').innerHTML=`<button class="btn btn-sm" onclick="copyModal()">Copy</button><button class="btn btn-sm" onclick="closeModal()">Close</button>`;
  document.getElementById('modal').classList.add('show');
}

function closeModal(){document.getElementById('modal').classList.remove('show');}

function copyModal(){
  const text=document.getElementById('modal-body').innerText;
  navigator.clipboard.writeText(text);toast('Copied!','ok');
}

let toastTimer=null;
function toast(msg,type=''){
  const el=document.getElementById('toast');
  el.textContent=msg;
  el.className='show'+(type?' '+type:'');
  if(toastTimer)clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.className='',3000);
}

// ─── INIT ────────────────────────────────────────────────
checkAPI();
loadTracker();
setInterval(checkAPI,30000);
