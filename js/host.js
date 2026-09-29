/* =====================================================================
   SECTION 5 — HOST CONTROLLER
   ===================================================================== */
let ACTIVE_HOST_CODE = null;
let lastHostRoom = null;
let hostDetailGameId = null;

function renderHost(){
  const savedCode = localStorage.getItem('hostRoomCode');
  if (savedCode) {
    db.ref('rooms/' + savedCode).once('value', snap => {
      if (snap.exists()) initHostRoom(savedCode, false);
      else { localStorage.removeItem('hostRoomCode'); initHostRoom(makeRoomCode(), true); }
    });
  } else {
    initHostRoom(makeRoomCode(), true);
  }
}

function initHostRoom(code, isNew){
  ACTIVE_HOST_CODE = code;
  localStorage.setItem('hostRoomCode', code);
  const roomRef = db.ref('rooms/' + code);
  if (isNew) roomRef.set({ status:'voting', players:{}, votes:{}, activeGame:null });

  app.innerHTML = `
    <button class="btn btn-ghost top-bar" id="newRoomBtn">غرفة جديدة</button>
    <div class="brand">🎮 منصة <b>الألعاب</b></div>
    <div class="stage" id="stage"></div>
  `;
  document.getElementById('newRoomBtn').onclick = () => {
    if (confirm('سيتم إنشاء غرفة جديدة وفقدان الاتصال باللاعبين الحاليين. متابعة؟')) {
      localStorage.removeItem('hostRoomCode');
      renderHost();
    }
  };

  roomRef.on('value', snap => dispatchHostRender(code, snap.val()));
}

function dispatchHostRender(code, room){
  if (!room) return;
  lastHostRoom = room;
  if (room.status === 'voting') renderHostLobby(code, room);
  else if (room.status === 'in_game' && room.activeGame === 'mafia') renderMafiaHost(code, room);
  else if (room.status === 'in_game' && room.activeGame === 'silentdraw') renderSilentDrawHost(code, room);
  else renderHostGenericPlaceholder(code, room);
}

window.showHostGameDetail = function(gameId){ hostDetailGameId = gameId; if (lastHostRoom) renderHostLobby(ACTIVE_HOST_CODE, lastHostRoom); };
window.hideHostGameDetail = function(){ hostDetailGameId = null; if (lastHostRoom) renderHostLobby(ACTIVE_HOST_CODE, lastHostRoom); };

function renderHostLobby(code, room){
  if (hostDetailGameId) {
    const game = GAMES_LIST.find(g => g.id === hostDetailGameId);
    document.getElementById('stage').innerHTML = gameDetailHtml(game, room, code, null, true);
    return;
  }

  const players = room.players || {};
  const votes = room.votes || {};
  const tally = {};
  Object.values(votes).forEach(g => tally[g] = (tally[g]||0)+1);

  const cardsHtml = GAMES_LIST.map(g => {
    if (!g.available) {
      return `<div class="game-card disabled">
        <div class="game-icon-badge">${g.icon}</div>
        <div class="game-title">${g.title}</div>
        <div class="coming-soon">قريبًا</div>
      </div>`;
    }
    return `<div class="game-card" onclick="showHostGameDetail('${g.id}')">
      <div class="game-icon-badge">${g.icon}</div>
      <div class="game-title">${g.title}</div>
      <div class="vote-badge">${tally[g.id]||0} جاهز</div>
    </div>`;
  }).join('');

  // عرض اللاعبين وفرقهم
  const playersListHtml = Object.values(players).map(p => {
    const tClass = p.team ? `team-${p.team}` : '';
    const tText = p.team ? ` [فريق ${p.team}]` : '';
    return `<span class="chip ${tClass}">${escapeHtml(p.name)}${tText}</span>`;
  }).join('');

  document.getElementById('stage').innerHTML = `
    <p style="margin:0; color:var(--text-dim);">رمز الغرفة</p>
    <div class="code-box"><p class="room-code">${code}</p></div>
    <div class="join-row">
      <div id="qr"></div>
      <div>
        <div class="link-text">${joinUrl(code)}</div>
        <button class="btn btn-ghost" id="copyBtn">نسخ الرابط</button>
      </div>
    </div>
    <div class="players-box">
      <h3 style="font-family:'Cairo';">اللاعبون (${Object.keys(players).length})</h3>
      <div>${playersListHtml || '<span class="muted">بانتظار انضمام اللاعبين…</span>'}</div>
    </div>
    <div class="players-box">
      <h3 style="font-family:'Cairo';">اختر لعبة لعرض شرحها والبدء</h3>
      <div class="games-grid">${cardsHtml}</div>
    </div>
  `;
  new QRCode(document.getElementById('qr'), { text: joinUrl(code), width:120, height:120 });
  document.getElementById('copyBtn').onclick = () => {
    navigator.clipboard.writeText(joinUrl(code)).then(()=>{
      document.getElementById('copyBtn').textContent = 'تم النسخ ✓';
    });
  };
}

function renderHostGenericPlaceholder(code, room){
  const g = GAMES_LIST.find(x=>x.id===room.activeGame);
  document.getElementById('stage').innerHTML = `
    <h2 style="font-family:'Cairo'; color:var(--accent);">🎮 ${g ? g.title : ''}</h2>
    <p class="muted">هذه اللعبة قيد التطوير حاليًا.</p>
    <button class="btn btn-danger" onclick="resetToLobby('${code}')">🛑 إنهاء اللعبة والعودة للرئيسية</button>
  `;
}

window.startGame = function(gameId, code){
  hostDetailGameId = null;
  if (gameId === 'mafia') { startMafiaGame(code); return; }
  if (gameId === 'silentdraw') { startSilentDrawGame(code); return; }
  db.ref('rooms/'+code).update({ status:'in_game', activeGame: gameId });
};

window.resetToLobby = function(code){
  db.ref('rooms/'+code).update({ status:'voting', activeGame:null, votes:{}, mafia:null, silentdraw:null });
  db.ref('strokes/'+code+'_A').set(null);
  db.ref('strokes/'+code+'_B').set(null);
};
