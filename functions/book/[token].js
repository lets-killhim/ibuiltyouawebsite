// Public booking page: pick a day, pick a time, done. All logic is in /book/slots and /book/pick.
export async function onRequestGet({ params }) {
  const token = String(params.token || '').replace(/[^a-z0-9]/g, '');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pick a time</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,600;1,500&display=swap">
<style>
:root{--g:#0F3B2E;--cream:#DED8CE;--sage:#A8C8A6;--txt:#BFE0B8;--bright:#DCF1D7;--muted:#8FB596;--red:#C9574F}
*{box-sizing:border-box}body{margin:0;background:var(--g);color:var(--txt);font-family:"Instrument Sans",system-ui,sans-serif;min-height:100vh;display:flex;justify-content:center;padding:32px 16px}
main{width:100%;max-width:720px}h1{font-size:clamp(28px,6vw,44px);line-height:1.05;margin:0 0 6px;color:var(--bright);font-weight:600;letter-spacing:-0.02em}h1 em{font-style:italic;font-weight:500}
.sub{color:var(--muted);margin:0 0 28px;font-size:14px}.lab{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:22px 0 10px}
.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;max-width:520px}.cal .dow{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);text-align:center;padding:4px 0 8px}
.cal .d{aspect-ratio:1;border-radius:10px;border:1px solid transparent;background:transparent;color:var(--muted);font:inherit;font-size:14px;display:flex;align-items:center;justify-content:center;cursor:default;position:relative}
.cal .d.open{color:var(--bright);border-color:rgba(191,224,184,.3);cursor:pointer}.cal .d.open:hover{border-color:var(--sage)}.cal .d.today::after{content:"";position:absolute;bottom:6px;width:5px;height:5px;border-radius:999px;background:var(--sage)}.cal .d.on{background:var(--sage);color:var(--g);font-weight:600;border-color:var(--sage)}.cal .d.pad{visibility:hidden}
.mh{display:flex;align-items:center;justify-content:space-between;max-width:520px;margin-bottom:8px}.mh b{color:var(--bright);font-weight:600;font-size:16px}.mh button{background:transparent;border:1px solid rgba(191,224,184,.3);color:var(--txt);border-radius:999px;width:36px;height:36px;cursor:pointer;font:inherit}.mh button:disabled{opacity:.3;cursor:default}
.times{display:flex;flex-wrap:wrap;gap:8px}.chip{border:1px solid rgba(191,224,184,.3);background:transparent;color:var(--txt);border-radius:999px;padding:10px 16px;font:inherit;font-size:14px;cursor:pointer;min-height:44px}
.chip.on{background:var(--sage);color:var(--g);border-color:var(--sage);font-weight:600}.chip:hover{border-color:var(--sage)}
form{display:none;flex-direction:column;gap:10px;margin-top:22px;max-width:420px}form.show{display:flex}input{font:inherit;font-size:16px;padding:12px 14px;border-radius:10px;border:1px solid rgba(191,224,184,.3);background:rgba(255,255,255,.04);color:var(--bright)}input::placeholder{color:var(--muted)}
button.go{margin-top:6px;background:var(--cream);color:var(--g);border:0;border-radius:999px;padding:14px 22px;font:inherit;font-weight:600;letter-spacing:.06em;text-transform:uppercase;font-size:13px;cursor:pointer;min-height:48px}button.go:disabled{opacity:.5}
.done{display:none;font-size:20px;color:var(--bright);line-height:1.4}.err{color:var(--red);font-size:14px;min-height:20px}
</style></head><body><main>
<h1 id="h">Pick a <em>time.</em></h1><p class="sub" id="sub">loading your options</p>
<div id="calwrap" hidden><div class="mh"><button id="prev" aria-label="Previous month">‹</button><b id="mon"></b><button id="next" aria-label="Next month">›</button></div><div class="cal" id="cal"></div></div>
<div class="lab" id="tl" hidden>time</div><div class="times" id="times"></div>
<form id="f"><input id="n" placeholder="your name" required><input id="p" placeholder="best phone number" required><input id="e" type="email" placeholder="email for the confirmation (optional)"><button class="go" id="go" type="submit">Book it</button><div class="err" id="err"></div></form>
<div class="done" id="done"></div>
<script>
const T=${JSON.stringify(token)};let data=null,day=null,time=null,view=null;const $=(i)=>document.getElementById(i);
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
function render(){const byDate=Object.fromEntries(data.days.map(d=>[d.date,d]));const y=view.y,m=view.m;const first=new Date(Date.UTC(y,m,1));const n=new Date(Date.UTC(y,m+1,0)).getUTCDate();
 $('mon').textContent=MONTHS[m]+' '+y;let h='';for(const w of ['S','M','T','W','T','F','S'])h+='<div class="dow">'+w+'</div>';for(let i=0;i<first.getUTCDay();i++)h+='<div class="d pad"></div>';
 for(let d=1;d<=n;d++){const date=y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');const open=!!byDate[date];h+='<button class="d'+(open?' open':'')+(date===data.today?' today':'')+(day&&day.date===date?' on':'')+'" data-date="'+date+'"'+(open?'':' disabled')+'>'+d+'</button>';}
 $('cal').innerHTML=h;const last=data.days[data.days.length-1];const [ty,tm]=data.today.split('-').map(Number);$('prev').disabled=(y<ty)||(y===ty&&m<=tm-1);const lastM=last?last.date.split('-').map(Number):[ty,tm];$('next').disabled=(y>lastM[0])||(y===lastM[0]&&m>=lastM[1]-1);}
fetch('/book/slots?token='+T).then(r=>r.json()).then(d=>{if(d.error){$('sub').textContent=d.error;return;}data=d;const [y,m]=d.today.split('-').map(Number);view={y,m:m-1};$('h').innerHTML='Pick a <em>time</em>'+(d.me?' with '+d.me.replace(/</g,''):'')+'.';$('sub').textContent=d.slot+' minute call'+(d.business?' about '+d.business:'')+'. Times in '+d.tz+'.';$('calwrap').hidden=false;render();
 if(!d.days.length)$('sub').textContent='No open times right now; reply to the email instead.';}).catch(()=>{$('sub').textContent='could not load times, try again in a minute'});
$('prev').onclick=()=>{view.m--;if(view.m<0){view.m=11;view.y--;}render();};$('next').onclick=()=>{view.m++;if(view.m>11){view.m=0;view.y++;}render();};
$('cal').addEventListener('click',e=>{const b=e.target.closest('.d.open');if(!b)return;day=data.days.find(x=>x.date===b.dataset.date);time=null;render();$('tl').hidden=false;$('tl').textContent=day.label;$('times').innerHTML=day.times.map(t=>'<button class="chip">'+t+'</button>').join('');$('f').classList.remove('show');$('tl').scrollIntoView({behavior:'smooth',block:'nearest'});});
$('times').addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b)return;time=b.textContent;[...$('times').children].forEach(c=>c.classList.toggle('on',c===b));$('f').classList.add('show');$('n').focus();});
$('f').addEventListener('submit',async e=>{e.preventDefault();if(!day||!time)return;$('go').disabled=true;$('err').textContent='';try{const r=await fetch('/book/pick',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:T,date:day.date,time,name:$('n').value,phone:$('p').value,email:$('e').value})});const d=await r.json();if(!r.ok)throw new Error(d.error||'try again');
 $('calwrap').hidden=true;$('tl').hidden=true;$('times').innerHTML='';$('f').classList.remove('show');$('h').innerHTML='You\\'re <em>booked.</em>';$('sub').textContent='';$('done').style.display='block';$('done').textContent=d.when+'. Talk soon.';}catch(err){$('err').textContent=err.message;$('go').disabled=false;}});
</script></main></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
