/* =====================================================================
   LIVE TOOL — QUESTION STUDIO BUZZER
   ===================================================================== */
function buzzerState(room){ return Object.assign({ winner:null, locked:false, timer:null, round:0 }, room.buzzer || {}); }

function buzzerTimerHtml(timer){
  if(!timer || !timer.duration || !timer.startedAt) return '';
  const remaining=Math.max(0,Math.ceil(timer.duration-(Date.now()-timer.startedAt)/1000));
  return `<div class="buzzer-timer" data-start="${timer.startedAt}" data-duration="${timer.duration}"><span>المؤقت</span><strong>${remaining}</strong><i></i></div>`;
}

function renderBuzzerHost(code, room){
  const state=buzzerState(room), players=room.players||{}, winner=state.winner&&players[state.winner];
  const roster=Object.entries(players).map(([id,p])=>`<div class="buzzer-player-row ${state.winner===id?'is-winner':''}"><span class="buzzer-player-dot"></span><strong>${escapeHtml(p.name)}</strong>${state.winner===id?'<b>الأسرع</b>':''}</div>`).join('');
  app.innerHTML=`<div class="stage buzzer-stage"><main class="buzzer-panel buzzer-host-panel">
    <button class="btn btn-ghost buzzer-back" onclick="resetToLobby('${code}')">→ العودة للألعاب</button>
    <span class="host-section-kicker">الأدوات · تفاعل مباشر</span><h1>🔔 استوديو الأسئلة</h1>
    <div class="buzzer-join"><div><span>رمز انضمام اللاعبين</span><strong>${escapeHtml(code)}</strong></div><div id="buzzerQr" aria-label="رمز QR للانضمام"></div></div>
    <p class="muted">يعرض اللاعبون أسماءهم عند الانضمام إلى الغرفة، ثم يضغطون من هواتفهم للإجابة.</p>
    <div class="buzzer-controls"><button class="btn ${state.locked?'btn-danger':'btn-ghost'}" onclick="buzzerToggleLock('${code}',${!state.locked})">${state.locked?'🔒 فتح الأزرار':'🔓 قفل الأزرار'}</button><button class="btn" onclick="buzzerReset('${code}')">سؤال جديد ↻</button><button class="btn btn-ghost" onclick="buzzerFullscreen()">⛶ ملء الشاشة</button></div>
    <div class="buzzer-timer-controls"><span>مؤقت السؤال:</span><button onclick="buzzerStartTimer('${code}',10)">10 ثوانٍ</button><button onclick="buzzerStartTimer('${code}',30)">30 ثانية</button><button onclick="buzzerStopTimer('${code}')">إيقاف</button></div>
    ${buzzerTimerHtml(state.timer)}
    <section class="buzzer-winner-card ${winner?'has-winner':''}">${winner?`<span>أول من ضغط</span><strong>${escapeHtml(winner.name)}</strong>`:`<span>${state.locked?'الأزرار مقفلة':'بانتظار أول إجابة'}</span><strong class="buzzer-ready">${Object.keys(players).length?'جاهزون!':'بانتظار انضمام اللاعبين'}</strong>`}</section>
    <section class="buzzer-roster"><h2>اللاعبون <b>${Object.keys(players).length}</b></h2>${roster||'<p class="muted">لا يوجد لاعبون في الغرفة بعد. شارك رمز الغرفة أو QR للانضمام.</p>'}</section>
  </main></div>`;
  const qr=document.getElementById('buzzerQr');
  if(qr) new QRCode(qr,{text:joinUrl(code),width:88,height:88});
  startBuzzerTimerDisplay();
}

function renderBuzzerPlayer(code, myId, name, room){
  const state=buzzerState(room), first=state.winner&&room.players&&room.players[state.winner], won=state.winner===myId;
  app.innerHTML=`<div class="phone buzzer-player-screen"><main class="buzzer-panel buzzer-player-panel"><span class="host-section-kicker">🔔 استوديو الأسئلة</span><h1>أهلاً ${escapeHtml(name)}</h1>${buzzerTimerHtml(state.timer)}<button class="buzzer-dome ${state.locked||first?'is-disabled':''} ${won?'is-winner':''}" ${state.locked||first?'disabled':''} onclick="buzzerPress('${code}','${myId}')" aria-label="اضغط للإجابة">${won?'أنت الأسرع!':first?`سبقك ${escapeHtml(first.name)}`:state.locked?'مقفلة':'اضغط للإجابة'}</button><p class="buzzer-player-status">${won?'مبروك! أنت أول من ضغط 🎉':first?`أجاب أولاً: ${escapeHtml(first.name)}`:state.locked?'انتظر فتح الأزرار من المنظم':'جاهز؟ اضغط عند معرفة الإجابة'}</p></main></div>`;
  startBuzzerTimerDisplay();
}

window.buzzerPress=function(code,playerId){
  db.ref('rooms/'+code+'/buzzer').transaction(state=>{
    if(!state||state.locked||state.winner) return;
    state.winner=playerId; state.pressedAt=Date.now(); return state;
  });
};
window.buzzerReset=function(code){db.ref('rooms/'+code+'/buzzer').transaction(state=>({winner:null,locked:!!(state&&state.locked),timer:state&&state.timer||null,round:(state&&state.round||0)+1}));};
window.buzzerToggleLock=function(code,locked){db.ref('rooms/'+code+'/buzzer/locked').set(locked);};
window.buzzerStartTimer=function(code,duration){db.ref('rooms/'+code+'/buzzer/timer').set({duration,startedAt:Date.now()});};
window.buzzerStopTimer=function(code){db.ref('rooms/'+code+'/buzzer/timer').set(null);};
window.buzzerFullscreen=function(){if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen?.();};

let buzzerDisplayInterval=null;
function startBuzzerTimerDisplay(){
  if(buzzerDisplayInterval)clearInterval(buzzerDisplayInterval);
  const update=()=>{const el=document.querySelector('.buzzer-timer');if(!el){clearInterval(buzzerDisplayInterval);buzzerDisplayInterval=null;return;}const duration=Number(el.dataset.duration),remaining=Math.max(0,Math.ceil(duration-(Date.now()-Number(el.dataset.start))/1000));el.querySelector('strong').textContent=remaining;el.classList.toggle('is-low',remaining<=5);el.querySelector('i').style.width=`${Math.max(0,remaining/duration*100)}%`;};
  update();buzzerDisplayInterval=setInterval(update,250);
}
