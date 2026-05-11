// Animated stat counters
function animateCounters(){
  document.querySelectorAll('.hstat-n').forEach(el=>{
    const target=parseInt(el.dataset.target)||0;
    let cur=0;const step=Math.max(1,Math.ceil(target/40));
    const iv=setInterval(()=>{
      cur=Math.min(cur+step,target);
      el.textContent=cur+(el.dataset.target==='100'?'%':'+');
      if(cur>=target)clearInterval(iv);
    },35);
  });
}

// Terminal typewriter
const lines=[
  {t:100,c:'#C8FF57',txt:'$ autoapply evaluate --jd "Senior ML Engineer at Anthropic"'},
  {t:800,c:'#4A4A5A',txt:'  Reading job description...'},
  {t:1400,c:'#4A4A5A',txt:'  Matching against your CV (1,847 tokens)...'},
  {t:2000,c:'#4A4A5A',txt:'  Scoring 10 dimensions...'},
  {t:2800,c:'#F2EFE9',txt:''},
  {t:2900,c:'#C8FF57',txt:'  ✓ Grade: A+  Score: 9.1/10  CV Match: 94%'},
  {t:3400,c:'#4ECDC4',txt:'  ✓ Archetype: LLMOps Engineer'},
  {t:3900,c:'#4ECDC4',txt:'  ✓ Recommendation: APPLY — strong technical fit, PGWP eligible'},
  {t:4500,c:'#9B8AFA',txt:'  → Generating tailored PDF resume...'},
  {t:5200,c:'#9B8AFA',txt:'  → Writing cold outreach email...'},
  {t:5900,c:'#C8FF57',txt:'  ✓ Done. resume_anthropic_ml_engineer.pdf saved.'},
];

function runTerminal(){
  const body=document.getElementById('term-body');
  if(!body)return;
  lines.forEach(({t,c,txt})=>{
    setTimeout(()=>{
      const div=document.createElement('div');
      div.style.color=c;
      div.style.animation='fadeInLine .3s ease';
      div.textContent=txt||'\u00a0';
      body.appendChild(div);
      body.scrollTop=body.scrollHeight;
    },t);
  });
  // Loop after 8s
  setTimeout(()=>{body.innerHTML='';runTerminal();},8500);
}

// Scroll reveal
const obs=new IntersectionObserver(entries=>{
  entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible');});
},{threshold:.15});
document.querySelectorAll('.feat-card,.step,.chip,.section-h2').forEach(el=>{
  el.classList.add('fade-up');obs.observe(el);
});

// Inject CSS animation
const style=document.createElement('style');
style.textContent='@keyframes fadeInLine{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}';
document.head.appendChild(style);

// Nav scroll effect
window.addEventListener('scroll',()=>{
  document.querySelector('.nav').style.background=
    window.scrollY>40?'rgba(13,13,16,.95)':'rgba(13,13,16,.85)';
});

// Start
animateCounters();
runTerminal();
