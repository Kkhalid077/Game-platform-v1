/* =====================================================================
   LIVE TOOL — QUESTION STUDIO BUZZER
   ===================================================================== */
let rtcHostCode=null,rtcHostSession=null,rtcHostSignals=null,rtcHostSignalHandler=null,rtcHostPeers=new Map(),rtcHostState=null;
let rtcPlayerCode=null,rtcPlayerId=null,rtcPlayerSession=null,rtcPlayerSignal=null,rtcPlayerConnection=null,rtcPlayerChannel=null,rtcPlayerState=null,rtcPlayerStatus='idle';

function buzzerState(room,override){ return Object.assign({ winner:null, locked:false, timer:null, round:0 }, override || room.buzzer || {}); }
function rtcConfiguration(){return {iceServers:[]};}
function waitForIceGathering(pc){
  if(pc.iceGatheringState==='complete')return Promise.resolve();
  return new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timeout);pc.removeEventListener('icegatheringstatechange',check);resolve();};const check=()=>{if(pc.iceGatheringState==='complete')finish();};const timeout=setTimeout(finish,5000);pc.addEventListener('icegatheringstatechange',check);});
}
function connectedRtcPlayers(){return [...rtcHostPeers.values()].filter(peer=>peer.connection.connectionState==='connected'&&peer.channel&&peer.channel.readyState==='open').length;}
function publishRtcHostState(){
  const payload=JSON.stringify({type:'state',state:rtcHostState});
  for(const peer of rtcHostPeers.values())if(peer.channel&&peer.channel.readyState==='open')try{peer.channel.send(payload);}catch(error){console.warn('Unable to send buzzer state',error);}
  if(rtcHostCode&&lastHostRoom)renderBuzzerHost(rtcHostCode,lastHostRoom,rtcHostState);
}
function handleRtcHostMessage(signalKey,peer,event){
  let message;try{message=JSON.parse(event.data);}catch(_error){return;}
  if(message.type!=='press'||message.playerId!==peer.playerId||!lastHostRoom?.players?.[peer.playerId])return;
  if(rtcHostState.locked||rtcHostState.winner){try{peer.channel.send(JSON.stringify({type:'state',state:rtcHostState}));}catch(_error){}return;}
  rtcHostState.winner=peer.playerId;rtcHostState.pressedAt=Date.now();publishRtcHostState();
}
async function acceptRtcOffer(signalKey,snapshot,session){
  const signal=snapshot.val();if(!signal?.offer||rtcHostPeers.has(signalKey)||session!==rtcHostSession)return;
  const peer={playerId:signal.playerId,connection:new RTCPeerConnection(rtcConfiguration()),channel:null};
  rtcHostPeers.set(signalKey,peer);
  peer.connection.ondatachannel=event=>{
    peer.channel=event.channel;peer.channel.onmessage=message=>handleRtcHostMessage(signalKey,peer,message);
    peer.channel.onopen=()=>{try{peer.channel.send(JSON.stringify({type:'state',state:rtcHostState}));rtcHostSignals.child(signalKey).remove();}catch(_error){}publishRtcHostState();};
    peer.channel.onclose=()=>publishRtcHostState();
  };
  peer.connection.onconnectionstatechange=()=>{if(['failed','closed'].includes(peer.connection.connectionState)){peer.connection.close();rtcHostPeers.delete(signalKey);}publishRtcHostState();};
  try{
    await peer.connection.setRemoteDescription(new RTCSessionDescription(signal.offer));
    const answer=await peer.connection.createAnswer();await peer.connection.setLocalDescription(answer);await waitForIceGathering(peer.connection);
    if(session===rtcHostSession)await rtcHostSignals.child(signalKey).child('answer').set(peer.connection.localDescription.toJSON());
  }catch(error){console.warn('Direct buzzer connection failed',error);peer.connection.close();rtcHostPeers.delete(signalKey);publishRtcHostState();}
}
function startBuzzerRtcHost(code,session,room){
  if(!window.RTCPeerConnection)return false;
  if(!session){
    if(rtcHostCode===code&&rtcHostSession)return true;
    session=Date.now()+'_'+Math.random().toString(36).slice(2,8);
    db.ref('rooms/'+code).update({buzzerSession:session,buzzerRtc:null});
  }
  if(rtcHostCode===code&&rtcHostSession===session)return true;
  closeBuzzerRtcHost();rtcHostCode=code;rtcHostSession=session;rtcHostState=buzzerState(room);
  rtcHostSignals=db.ref(`rooms/${code}/buzzerRtc/${session}`);
  rtcHostSignalHandler=snapshot=>acceptRtcOffer(snapshot.key,snapshot,session);
  rtcHostSignals.on('child_added',rtcHostSignalHandler);
  return true;
}
function closeBuzzerRtcHost(){
  if(rtcHostSignals&&rtcHostSignalHandler)rtcHostSignals.off('child_added',rtcHostSignalHandler);
  for(const peer of rtcHostPeers.values())peer.connection.close();
  rtcHostPeers.clear();rtcHostSignals=null;rtcHostSignalHandler=null;rtcHostCode=null;rtcHostSession=null;rtcHostState=null;
}
async function startBuzzerRtcPlayer(code,playerId,session){
  if(!window.RTCPeerConnection||!session)return false;
  if(rtcPlayerCode===code&&rtcPlayerId===playerId&&rtcPlayerSession===session&&rtcPlayerConnection&&rtcPlayerConnection.connectionState!=='failed')return true;
  closeBuzzerRtcPlayer();rtcPlayerCode=code;rtcPlayerId=playerId;rtcPlayerSession=session;rtcPlayerState=null;rtcPlayerStatus='connecting';
  const connection=new RTCPeerConnection(rtcConfiguration()),channel=connection.createDataChannel('buzzer-presses');
  rtcPlayerConnection=connection;rtcPlayerChannel=channel;
  channel.onopen=()=>{rtcPlayerStatus='connected';if(rtcPlayerSignal){rtcPlayerSignal.off();rtcPlayerSignal.remove();}refreshRtcPlayer(code,playerId);};
  channel.onclose=()=>{rtcPlayerStatus='failed';refreshRtcPlayer(code,playerId);};
  channel.onmessage=event=>{try{const message=JSON.parse(event.data);if(message.type==='state'){rtcPlayerState=message.state;rtcPlayerStatus='connected';refreshRtcPlayer(code,playerId);}}catch(error){console.warn('Invalid direct buzzer message',error);}};
  connection.onconnectionstatechange=()=>{if(connection.connectionState==='connected')rtcPlayerStatus='connected';else if(['failed','disconnected'].includes(connection.connectionState))rtcPlayerStatus='failed';refreshRtcPlayer(code,playerId);};
  rtcPlayerSignal=db.ref(`rooms/${code}/buzzerRtc/${session}`).push();
  rtcPlayerSignal.child('answer').on('value',async snapshot=>{
    const answer=snapshot.val();if(!answer||connection.remoteDescription||rtcPlayerConnection!==connection)return;
    try{await connection.setRemoteDescription(new RTCSessionDescription(answer));}
    catch(error){rtcPlayerStatus='failed';console.warn('Direct buzzer answer failed',error);refreshRtcPlayer(code,playerId);}
  });
  try{
    const offer=await connection.createOffer();await connection.setLocalDescription(offer);await waitForIceGathering(connection);
    if(rtcPlayerConnection!==connection)return false;
    await rtcPlayerSignal.set({playerId,offer:connection.localDescription.toJSON()});
    setTimeout(()=>{if(rtcPlayerConnection===connection&&connection.connectionState!=='connected'&&rtcPlayerStatus==='connecting'){rtcPlayerStatus='failed';refreshRtcPlayer(code,playerId);}},12000);
  }catch(error){rtcPlayerStatus='failed';console.warn('Direct buzzer setup failed',error);refreshRtcPlayer(code,playerId);return false;}
  return true;
}
function closeBuzzerRtcPlayer(){
  if(rtcPlayerSignal){rtcPlayerSignal.off();rtcPlayerSignal.remove();}
  if(rtcPlayerConnection)rtcPlayerConnection.close();
  rtcPlayerCode=null;rtcPlayerId=null;rtcPlayerSession=null;rtcPlayerSignal=null;rtcPlayerConnection=null;rtcPlayerChannel=null;rtcPlayerState=null;rtcPlayerStatus='idle';
}
function refreshRtcPlayer(code,playerId){
  if(rtcPlayerCode===code&&lastPlayerRoom&&lastPlayerRoom.status==='in_tool'&&lastPlayerRoom.activeTool==='buzzer')
    renderBuzzerPlayer(code,playerId,CURRENT_PLAYER_NAME,lastPlayerRoom,rtcPlayerState);
}
function updateRtcHostState(code,update){
  if(rtcHostCode!==code||!rtcHostState)return false;
  update(rtcHostState);publishRtcHostState();return true;
}

function buzzerTimerHtml(timer){
  if(!timer || !timer.duration || !timer.startedAt) return '';
  const remaining=Math.max(0,Math.ceil(timer.duration-(Date.now()-timer.startedAt)/1000));
  return `<div class="buzzer-timer" data-start="${timer.startedAt}" data-duration="${timer.duration}"><span>المؤقت</span><strong>${remaining}</strong><i></i></div>`;
}

function renderBuzzerHost(code, room, directState){
  if(room.buzzerTransport==='rtc')startBuzzerRtcHost(code,room.buzzerSession,room);
  const state=buzzerState(room,directState||(rtcHostCode===code?rtcHostState:null)), players=room.players||{}, winner=state.winner&&players[state.winner];
  if(state.winner&&state.winner!==lastBuzzerWinner){lastBuzzerWinner=state.winner;buzzerPlayWinner();}
  else if(!state.winner)lastBuzzerWinner=null;
  if(!document.getElementById('buzzerHostRoot')){
    app.innerHTML=`<div class="stage buzzer-stage" id="stage"><main class="buzzer-panel buzzer-host-panel" id="buzzerHostRoot">
      <button class="btn btn-ghost buzzer-back" onclick="resetToLobby('${code}')">→ العودة للألعاب</button>
      <span class="host-section-kicker">الأدوات · تفاعل مباشر</span><h1>استوديو الأسئلة</h1>
      <div class="buzzer-join"><div><span>رمز انضمام اللاعبين</span><strong>${escapeHtml(code)}</strong></div><div id="buzzerQr" aria-label="رمز QR للانضمام"></div></div>
      <p class="muted">يعرض اللاعبون أسماءهم عند الانضمام إلى الغرفة، ثم يضغطون من هواتفهم للإجابة.</p>
      <p class="buzzer-network-note">${room.buzzerTransport==='rtc'?'تنتقل الضغطة مباشرةً بين جهاز المنظّم وهواتف اللاعبين. لأفضل استجابة، اتصلوا جميعاً بشبكة Wi‑Fi نفسها.':'الاتصال المباشر غير مدعوم في هذا المتصفح؛ تُرسل الضغطات عبر Firebase.'}</p>
      <p class="buzzer-peer-status">الأجهزة المتصلة مباشرة: <strong id="buzzerPeerCount">0</strong></p>
      <div class="buzzer-controls"><button id="buzzerLock" class="btn" onclick="buzzerToggleLock('${code}',true)"></button><button class="btn" onclick="buzzerReset('${code}')">سؤال جديد</button><button class="btn btn-ghost" onclick="buzzerFullscreen()">ملء الشاشة</button><button id="buzzerSound" class="btn btn-ghost" onclick="buzzerToggleSound()"></button></div>
      <div class="buzzer-timer-controls"><span>مؤقت السؤال:</span><button onclick="buzzerStartTimer('${code}',10)">10 ثوانٍ</button><button onclick="buzzerStartTimer('${code}',30)">30 ثانية</button><button onclick="buzzerStopTimer('${code}')">إيقاف</button></div>
      <div id="buzzerTimerMount"></div><section id="buzzerWinner" class="buzzer-winner-card"></section>
      <section class="buzzer-roster"><h2>اللاعبون <b id="buzzerPlayerCount">0</b></h2><div id="buzzerRoster"></div></section>
    </main></div>`;
    const qr=document.getElementById('buzzerQr');
    if(qr) new QRCode(qr,{text:joinUrl(code),width:88,height:88});
  }
  const peerCount=document.getElementById('buzzerPeerCount');
  if(peerCount)peerCount.textContent=connectedRtcPlayers();
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

function renderBuzzerPlayer(code, myId, name, room, directState){
  if(room.buzzerTransport==='rtc')startBuzzerRtcPlayer(code,myId,room.buzzerSession);
  const state=buzzerState(room,directState||(rtcPlayerCode===code?rtcPlayerState:null)), first=state.winner&&room.players&&room.players[state.winner], won=state.winner===myId;
  if(!document.getElementById('buzzerPlayerRoot')){
    app.innerHTML=`<div class="phone buzzer-player-screen"><main class="buzzer-panel buzzer-player-panel" id="buzzerPlayerRoot"><span class="host-section-kicker">استوديو الأسئلة</span><h1>أهلاً ${escapeHtml(name)}</h1><p class="buzzer-network-note">لأفضل استجابة، تأكد أن هاتفك وجهاز المنظّم على شبكة Wi‑Fi نفسها.</p><div id="buzzerPlayerTimer"></div><button id="buzzerDome" class="buzzer-dome" onclick="buzzerPress('${code}','${myId}')" aria-label="اضغط للإجابة"></button><p id="buzzerPlayerStatus" class="buzzer-player-status"></p></main></div>`;
  }
  const button=document.getElementById('buzzerDome');
  const rtcExpected=room.buzzerTransport==='rtc',rtcSupported=!!window.RTCPeerConnection,rtcConnected=rtcPlayerChannel&&rtcPlayerChannel.readyState==='open';
  const rtcUnavailable=rtcExpected&&!rtcSupported;
  button.disabled=!!(state.locked||first||(rtcExpected&&(!rtcSupported||!rtcConnected)));
  button.classList.toggle('is-disabled',!!(state.locked||first||(rtcExpected&&(!rtcSupported||!rtcConnected))));button.classList.toggle('is-winner',won);
  button.textContent=won?'أنت الأسرع!':first?`سبقك ${first.name}`:state.locked?'مقفلة':rtcExpected&&!rtcConnected?'جار الاتصال':'اضغط للإجابة';
  document.getElementById('buzzerPlayerStatus').textContent=rtcUnavailable?'المتصفح لا يدعم الاتصال المباشر، حدّثه للمشاركة.':rtcExpected&&!rtcConnected?(rtcPlayerStatus==='failed'?'تعذر الاتصال المباشر. تأكد من شبكة Wi‑Fi ثم أعد فتح الأداة.':'جارٍ إنشاء اتصال مباشر...'):won?'مبروك! أنت أول من ضغط':first?`أجاب أولاً: ${first.name}`:state.locked?'انتظر فتح الأزرار من المنظم':'جاهز؟ اضغط عند معرفة الإجابة';
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
  if(rtcPlayerSession&&rtcPlayerChannel&&rtcPlayerChannel.readyState==='open'){
    try{rtcPlayerChannel.send(JSON.stringify({type:'press',playerId}));}catch(error){console.error('تعذر إرسال الضغطة عبر الاتصال المباشر',error);}
    return;
  }
  if(rtcPlayerSession)return;
  db.ref('rooms/'+code+'/buzzer').transaction(state=>{
    if(!state||state.locked||state.winner) return;
    state.winner=playerId; state.pressedAt=Date.now(); return state;
  });
};
window.buzzerReset=function(code){buzzerUnlockAudio();if(updateRtcHostState(code,state=>{state.winner=null;state.pressedAt=null;state.round=(state.round||0)+1;}))return;db.ref('rooms/'+code+'/buzzer').transaction(state=>({winner:null,locked:!!(state&&state.locked),timer:state&&state.timer||null,round:(state&&state.round||0)+1}));};
window.buzzerToggleLock=function(code,locked){buzzerUnlockAudio();if(updateRtcHostState(code,state=>{state.locked=locked;}))return;db.ref('rooms/'+code+'/buzzer/locked').set(locked);};
window.buzzerStartTimer=function(code,duration){buzzerUnlockAudio();if(updateRtcHostState(code,state=>{state.timer={duration,startedAt:Date.now()};}))return;db.ref('rooms/'+code+'/buzzer/timer').set({duration,startedAt:Date.now()});};
window.buzzerStopTimer=function(code){if(updateRtcHostState(code,state=>{state.timer=null;}))return;db.ref('rooms/'+code+'/buzzer/timer').set(null);};
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
