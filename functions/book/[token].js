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
.days,.times{display:flex;flex-wrap:wrap;gap:8px}.chip{border:1px solid rgba(191,224,184,.3);background:transparent;color:var(--txt);border-radius:999px;padding:10px 16px;font:inherit;font-size:14px;cursor:pointer;min-height:44px}
.chip.on{background:var(--sage);color:var(--g);border-color:var(--sage);font-weight:600}.chip:hover{border-color:var(--sage)}
form{display:none;flex-direction:column;gap:10px;margin-top:22px;max-width:420px}form.show{display:flex}input{font:inherit;font-size:16px;padding:12px 14px;border-radius:10px;border:1px solid rgba(191,224,184,.3);background:rgba(255,255,255,.04);color:var(--bright)}input::placeholder{color:var(--muted)}
button.go{margin-top:6px;background:var(--cream);color:var(--g);border:0;border-radius:999px;padding:14px 22px;font:inherit;font-weight:600;letter-spacing:.06em;text-transform:uppercase;font-size:13px;cursor:pointer;min-height:48px}button.go:disabled{opacity:.5}
.done{display:none;font-size:20px;color:var(--bright);line-height:1.4}.err{color:var(--red);font-size:14px;min-height:20px}
</style></head><body><main>
<h1 id="h">Pick a <em>time.</em></h1><p class="sub" id="sub">loading your options</p>
<div class="lab" id="dl" hidden>day</div><div class="days" id="days"></div>
<div class="lab" id="tl" hidden>time</div><div class="times" id="times"></div>
<form id="f"><input id="n" placeholder="your name" required><input id="p" placeholder="best phone number" required><input id="e" type="email" placeholder="email for the confirmation (optional)"><button class="go" id="go" type="submit">Book it</button><div class="err" id="err"></div></form>
<div class="done" id="done"></div>
<script>
const T=${JSON.stringify(token)};let data=null,day=null,time=null;const $=(i)=>document.getElementById(i);
fetch('/book/slots?token='+T).then(r=>r.json()).then(d=>{if(d.error){$('sub').textContent=d.error;return;}data=d;$('h').innerHTML='Pick a <em>time</em>'+(d.me?' with '+d.me.replace(/</g,''):'')+'.';$('sub').textContent=d.slot+' minute call'+(d.business?' about '+d.business:'')+'. Times in '+d.tz+'.';$('dl').hidden=false;
 $('days').innerHTML=d.days.map((x,i)=>'<button class="chip" data-i="'+i+'">'+x.label+'</button>').join('')||'<span class="sub">no open times right now, reply to the email instead</span>';}).catch(()=>{$('sub').textContent='could not load times, try again in a minute'});
$('days').addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b)return;day=data.days[+b.dataset.i];time=null;[...$('days').children].forEach(c=>c.classList.toggle('on',c===b));$('tl').hidden=false;$('times').innerHTML=day.times.map(t=>'<button class="chip">'+t+'</button>').join('');$('f').classList.remove('show');});
$('times').addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b)return;time=b.textContent;[...$('times').children].forEach(c=>c.classList.toggle('on',c===b));$('f').classList.add('show');$('n').focus();});
$('f').addEventListener('submit',async e=>{e.preventDefault();if(!day||!time)return;$('go').disabled=true;$('err').textContent='';try{const r=await fetch('/book/pick',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:T,date:day.date,time,name:$('n').value,phone:$('p').value,email:$('e').value})});const d=await r.json();if(!r.ok)throw new Error(d.error||'try again');
 ['dl','tl'].forEach(i=>$(i).hidden=true);$('days').innerHTML='';$('times').innerHTML='';$('f').classList.remove('show');$('h').innerHTML='You\\'re <em>booked.</em>';$('sub').textContent='';$('done').style.display='block';$('done').textContent=d.when+'. Talk soon.';}catch(err){$('err').textContent=err.message;$('go').disabled=false;}});
</script></main></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
