/* =====================================================================
   LIVE TOOL — QUESTION STUDIO BUZZER
   ===================================================================== */
let localBuzzerSource=null, localBuzzerCode=null, localBuzzerCallback=null, localBuzzerState=null;

function buzzerState(room,override){ return Object.assign({ winner:null, locked:false, timer:null, round:0 }, override || room.buzzer || {}); }

function localBuzzerRequest(code,action,data={}){
  return fetch(`/api/buzzer/${encodeURIComponent(code)}/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(response=>{if(!response.ok)throw new Error('تعذر الوصول إلى خادم الشبكة المحلية');return response.json();});
}

function startLocalBuzzerSync(code,callback){
  if(!window.LOCAL_BUZZER_ENABLED)return false;
  if(localBuzzerSource&&localBuzzerCode===code){localBuzzerCallback=callback;return true;}
  stopLocalBuzzerSync();localBuzzerCode=code;localBuzzerCallback=callback;
  localBuzzerSource=new EventSource(`/api/buzzer/${encodeURIComponent(code)}/events`);
  localBuzzerSource.onmessage=event=>{
    if(localBuzzerCode!==code)return;
    try{localBuzzerState=JSON.parse(event.data);if(localBuzzerCallback)localBuzzerCallback(localBuzzerState);}catch(error){console.error('Invalid local buzzer state',error);}
  };
  return true;
}

function stopLocalBuzzerSync(){
  if(localBuzzerSource)localBuzzerSource.close();
  localBuzzerSource=null;localBuzzerCode=null;localBuzzerCallback=null;localBuzzerState=null;
}

function buzzerTimerHtml(timer){
  if(!timer || !timer.duration || !timer.startedAt) return '';
  const remaining=Math.max(0,Math.ceil(timer.duration-(Date.now()-timer.startedAt)/1000));
  return `<div class="buzzer-timer" data-start="${timer.startedAt}" data-duration="${timer.duration}"><span>المؤقت</span><strong>${remaining}</strong><i></i></div>`;
}

function renderBuzzerHost(code, room, localState){
  if(window.LOCAL_BUZZER_ENABLED)startLocalBuzzerSync(code,state=>{if(lastHostRoom)renderBuzzerHost(code,lastHostRoom,state);});
  const state=buzzerState(room,localState||(window.LOCAL_BUZZER_ENABLED?localBuzzerState:null)), players=room.players||{}, winner=state.winner&&players[state.winner];
  if(state.winner&&state.winner!==lastBuzzerWinner){lastBuzzerWinner=state.winner;buzzerPlayWinner();}
  else if(!state.winner)lastBuzzerWinner=null;
  if(!document.getElementById('buzzerHostRoot')){
    app.innerHTML=`<div class="stage buzzer-stage" id="stage"><main class="buzzer-panel buzzer-host-panel" id="buzzerHostRoot">
      <button class="btn btn-ghost buzzer-back" onclick="resetToLobby('${code}')">→ العودة للألعاب</button>
      <span class="host-section-kicker">الأدوات · تفاعل مباشر</span><h1>استوديو الأسئلة</h1>
      <div class="buzzer-join"><div><span>رمز انضمام اللاعبين</span><strong>${escapeHtml(code)}</strong></div><div id="buzzerQr" aria-label="رمز QR للانضمام"></div></div>
      <p class="muted">يعرض اللاعبون أسماءهم عند الانضمام إلى الغرفة، ثم يضغطون من هواتفهم للإجابة.</p>
      ${window.LOCAL_BUZZER_ENABLED?'<p class="buzzer-network-note">أولوية الضغطة والمزامنة تعملان عبر الشبكة المحلية.</p>':'<p class="buzzer-network-note">لتسريع الضغطة محلياً، شغّل <code>python server.py</code> على جهاز المنظّم وافتح المنصة من عنوان الشبكة الذي يظهر.</p>'}
      <div class="buzzer-controls"><button id="buzzerLock" class="btn" onclick="buzzerToggleLock('${code}',true)"></button><button class="btn" onclick="buzzerReset('${code}')">سؤال جديد</button><button class="btn btn-ghost" onclick="buzzerFullscreen()">ملء الشاشة</button><button id="buzzerSound" class="btn btn-ghost" onclick="buzzerToggleSound()"></button></div>
      <div class="buzzer-timer-controls"><span>مؤقت السؤال:</span><button onclick="buzzerStartTimer('${code}',10)">10 ثوانٍ</button><button onclick="buzzerStartTimer('${code}',30)">30 ثانية</button><button onclick="buzzerStopTimer('${code}')">إيقاف</button></div>
      <div id="buzzerTimerMount"></div><section id="buzzerWinner" class="buzzer-winner-card"></section>
      <section class="buzzer-roster"><h2>اللاعبون <b id="buzzerPlayerCount">0</b></h2><div id="buzzerRoster"></div></section>
    </main></div>`;
    const qr=document.getElementById('buzzerQr');
    if(qr) new QRCode(qr,{text:joinUrl(code),width:88,height:88});
  }
  const lock=document.getElementById('buzzerLock');
  lock.textContent=state.locked?'فتح الأزرار':'قفل الأزرار';
  lock.onclick=()=>buzzerToggleLock(code,!state.locked);
  lock.classList.toggle('btn-danger',state.locked);lock.classList.toggle('btn-ghost',!state.locked);
  document.getElementById('buzzerSound').textContent=buzzerMuted?'تشغيل الصوت':'كتم الصوت';
  const winnerCard=document.getElementById('buzzerWinner');
  const winnerKey=winner?`winner:${state.winner}:${winner.name}`:state.locked?'locked':`ready:${Object.keys(players).length}`;
  if(winnerCard.dataset.key!==winnerKey){
    winnerCard.dataset.key=winnerKey;
    winnerCard.classList.toggle('has-winner',!!winner);
    winnerCard.innerHTML=winner?`<span>أول من ضغط</span><strong>${escapeHtml(winner.name)}</strong>`:`<span>${state.locked?'الأزرار مقفلة':'بانتظار أول إجابة'}</span><strong class="buzzer-ready">${Object.keys(players).length?'جاهزون!':'بانتظار انضمام اللاعبين'}</strong>`;
  }
  const roster=document.getElementById('buzzerRoster');
  const rosterKey=JSON.stringify(Object.entries(players).map(([id,p])=>[id,p.name,state.winner===id]));
  if(roster.dataset.key!==rosterKey){
    roster.dataset.key=rosterKey;
    roster.innerHTML=Object.entries(players).map(([id,p])=>`<div class="buzzer-player-row ${state.winner===id?'is-winner':''}"><span class="buzzer-player-dot"></span><strong>${escapeHtml(p.name)}</strong>${state.winner===id?'<b>الأسرع</b>':''}</div>`).join('')||'<p class="muted">لا يوجد لاعبون في الغرفة بعد. شارك رمز الغرفة أو QR للانضمام.</p>';
    document.getElementById('buzzerPlayerCount').textContent=Object.keys(players).length;
  }
  updateBuzzerTimerMount(state.timer);
  startBuzzerTimerDisplay();
}

function renderBuzzerPlayer(code, myId, name, room, localState){
  if(window.LOCAL_BUZZER_ENABLED)startLocalBuzzerSync(code,state=>{if(lastPlayerRoom)renderBuzzerPlayer(code,myId,name,lastPlayerRoom,state);});
  const state=buzzerState(room,localState||(window.LOCAL_BUZZER_ENABLED?localBuzzerState:null)), first=state.winner&&room.players&&room.players[state.winner], won=state.winner===myId;
  if(!document.getElementById('buzzerPlayerRoot')){
    app.innerHTML=`<div class="phone buzzer-player-screen"><main class="buzzer-panel buzzer-player-panel" id="buzzerPlayerRoot"><span class="host-section-kicker">استوديو الأسئلة</span><h1>أهلاً ${escapeHtml(name)}</h1><div id="buzzerPlayerTimer"></div><button id="buzzerDome" class="buzzer-dome" onclick="buzzerPress('${code}','${myId}')" aria-label="اضغط للإجابة"></button><p id="buzzerPlayerStatus" class="buzzer-player-status"></p></main></div>`;
  }
  const button=document.getElementById('buzzerDome');
  button.disabled=!!(state.locked||first);
  button.classList.toggle('is-disabled',!!(state.locked||first));button.classList.toggle('is-winner',won);
  button.textContent=won?'أنت الأسرع!':first?`سبقك ${first.name}`:state.locked?'مقفلة':'اضغط للإجابة';
  document.getElementById('buzzerPlayerStatus').textContent=won?'مبروك! أنت أول من ضغط':first?`أجاب أولاً: ${first.name}`:state.locked?'انتظر فتح الأزرار من المنظم':'جاهز؟ اضغط عند معرفة الإجابة';
  updateBuzzerTimerMount(state.timer,'buzzerPlayerTimer');
  startBuzzerTimerDisplay();
}

function updateBuzzerTimerMount(timer,mountId='buzzerTimerMount'){
  const mount=document.getElementById(mountId);if(!mount)return;
  const key=timer&&timer.duration&&timer.startedAt?`${timer.startedAt}:${timer.duration}`:'none';
  if(mount.dataset.key===key)return;
  mount.dataset.key=key;mount.innerHTML=buzzerTimerHtml(timer);
}

window.buzzerPress=function(code,playerId){
  buzzerUnlockAudio(); buzzerPlayTone(740,0.16);
  if(window.LOCAL_BUZZER_ENABLED){localBuzzerRequest(code,'press',{playerId}).catch(error=>console.error(error));return;}
  db.ref('rooms/'+code+'/buzzer').transaction(state=>{
    if(!state||state.locked||state.winner) return;
    state.winner=playerId; state.pressedAt=Date.now(); return state;
  });
};
window.buzzerReset=function(code){buzzerUnlockAudio();if(window.LOCAL_BUZZER_ENABLED){localBuzzerRequest(code,'reset').catch(error=>console.error(error));return;}db.ref('rooms/'+code+'/buzzer').transaction(state=>({winner:null,locked:!!(state&&state.locked),timer:state&&state.timer||null,round:(state&&state.round||0)+1}));};
window.buzzerToggleLock=function(code,locked){buzzerUnlockAudio();if(window.LOCAL_BUZZER_ENABLED){localBuzzerRequest(code,'lock',{locked}).catch(error=>console.error(error));return;}db.ref('rooms/'+code+'/buzzer/locked').set(locked);};
window.buzzerStartTimer=function(code,duration){buzzerUnlockAudio();if(window.LOCAL_BUZZER_ENABLED){localBuzzerRequest(code,'timer',{duration}).catch(error=>console.error(error));return;}db.ref('rooms/'+code+'/buzzer/timer').set({duration,startedAt:Date.now()});};
window.buzzerStopTimer=function(code){if(window.LOCAL_BUZZER_ENABLED){localBuzzerRequest(code,'timer',{duration:0}).catch(error=>console.error(error));return;}db.ref('rooms/'+code+'/buzzer/timer').set(null);};
window.buzzerFullscreen=function(){if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen?.();};
window.buzzerToggleSound=function(){buzzerMuted=!buzzerMuted;localStorage.setItem('buzzerMuted',buzzerMuted?'1':'0');if(!buzzerMuted){buzzerUnlockAudio();buzzerPlayTone(740,0.16);}const b=document.querySelector('.buzzer-controls button:last-child');if(b)b.textContent=buzzerMuted?'تشغيل الصوت':'كتم الصوت';};

let buzzerAudio=null, buzzerMuted=localStorage.getItem('buzzerMuted')==='1', lastBuzzerWinner=null;
window.buzzerUnlockAudio=function(){try{buzzerAudio=buzzerAudio||new(window.AudioContext||window.webkitAudioContext)();if(buzzerAudio.state==='suspended')buzzerAudio.resume();}catch(e){}};
function buzzerPlayTone(frequency,duration){if(!buzzerAudio||buzzerMuted)return;try{const osc=buzzerAudio.createOscillator(),gain=buzzerAudio.createGain(),now=buzzerAudio.currentTime;osc.type='triangle';osc.frequency.value=frequency;gain.gain.setValueAtTime(.001,now);gain.gain.exponentialRampToValueAtTime(.22,now+.02);gain.gain.exponentialRampToValueAtTime(.001,now+duration);osc.connect(gain);gain.connect(buzzerAudio.destination);osc.start(now);osc.stop(now+duration+.02);}catch(e){}}
function buzzerPlayWinner(){buzzerPlayTone(740,.18);setTimeout(()=>buzzerPlayTone(988,.28),100);}

let buzzerDisplayInterval=null;
let lastBuzzerSecond=null;
function startBuzzerTimerDisplay(){
  if(buzzerDisplayInterval)return;
  lastBuzzerSecond=null;
  const update=()=>{const el=document.querySelector('.buzzer-timer');if(!el){clearInterval(buzzerDisplayInterval);buzzerDisplayInterval=null;return;}const duration=Number(el.dataset.duration),remaining=Math.max(0,Math.ceil(duration-(Date.now()-Number(el.dataset.start))/1000));el.querySelector('strong').textContent=remaining;el.classList.toggle('is-low',remaining<=5);el.querySelector('i').style.width=`${Math.max(0,remaining/duration*100)}%`;if(remaining!==lastBuzzerSecond){lastBuzzerSecond=remaining;if(remaining>0&&remaining<=5)buzzerPlayTone(880,.07);}};
  update();buzzerDisplayInterval=setInterval(update,250);
}
