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
    <div class="top-bar" style="display:flex; gap:8px;">
      <button class="btn btn-ghost" style="border-color:var(--accent-2); color:var(--accent-2);" id="leaveRoomBtn">مغادرة الغرفة</button>
    </div>
    <div class="brand">🎮 منصة <b>الألعاب</b></div>
    <div class="stage" id="stage"></div>
  `;
  document.getElementById('leaveRoomBtn').onclick = () => hostLeaveRoom(code);

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
  const playersListHtml = Object.entries(players).map(([id, p], index) => {
    const tClass = p.team ? `team-${p.team}` : '';
    const tText = p.team ? ` [فريق ${p.team}]` : '';
    const hue = (index * 67 + 195) % 360;
    const skinTones = ['#f4c7a1','#d99a72','#8d5b43','#f0b98d'];
    const skin = skinTones[index % skinTones.length];
    const hair = ['#302338','#171923','#60402d','#291c1b'][index % 4];
    return `<div class="host-player-card ${tClass}">
      <span class="host-player-avatar" style="--avatar-hue:${hue};--avatar-skin:${skin};--avatar-hair:${hair}" role="img" aria-label="صورة ${escapeHtml(p.name)}">
        <svg viewBox="0 0 64 64" aria-hidden="true"><path class="avatar-body" d="M9 64c1-15 9-23 23-23s22 8 23 23"/><path class="avatar-neck" d="M26 39h12v10H26z"/><ellipse class="avatar-face" cx="32" cy="27" rx="15" ry="18"/><path class="avatar-hair" d="M17 27c-2-14 5-22 16-22 12 0 17 9 14 22-3-2-5-7-6-10-5 5-13 8-24 8z"/><circle cx="26" cy="28" r="1.4" fill="#34221e"/><circle cx="38" cy="28" r="1.4" fill="#34221e"/><path d="M28 35q4 3 8 0" fill="none" stroke="#9b554c" stroke-width="1.5" stroke-linecap="round"/></svg>
      </span>
      <span class="host-player-info"><strong>${escapeHtml(p.name)}</strong>${tText ? `<small>${escapeHtml(tText.trim())}</small>` : ''}</span>
      <span class="host-player-online" title="متصل"></span>
    </div>`;
  }).join('');
  const playerCount = Object.keys(players).length;

  document.getElementById('stage').innerHTML = `
    <div class="host-lobby">
      <header class="host-welcome">
        <span class="host-eyebrow"><span class="host-live-dot"></span> مساحة المنظم</span>
        <h1>إدارة الغرفة</h1>
        <p>شارك رمز الدعوة، تابع اللاعبين، واختروا اللعبة.</p>
      </header>
      <section class="host-room-grid" aria-label="معلومات الغرفة والانضمام">
        <div class="host-room-card">
          <span class="host-section-kicker">رمز الغرفة</span>
          <p class="room-code">${code}</p>
          <div class="host-room-status"><span class="host-live-dot"></span> الغرفة نشطة <span class="host-status-separator">•</span> ${playerCount} لاعب</div>
        </div>
        <div class="join-row">
          <div class="join-info">
            <span class="join-kicker">انضم إلى اللعبة</span>
            <h3>امسح الرمز أو افتح الرابط</h3>
            <div class="link-text">${joinUrl(code)}</div>
            <button class="btn btn-ghost" id="copyBtn">نسخ رابط الانضمام</button>
          </div>
          <div class="join-qr"><span>امسح للانضمام</span><div id="qr"></div></div>
        </div>
      </section>

      <section class="host-panel">
        <div class="host-section-heading">
          <div><span class="host-section-kicker">الردهة</span><h2>اللاعبون</h2><p>الأصدقاء الموجودون في الغرفة الآن</p></div>
          <span class="host-count">${playerCount}</span>
        </div>
        <div class="host-player-list">${playersListHtml || '<div class="host-empty"><span>بانتظار أول لاعب</span><small>أرسل رمز الغرفة أو امسح رمز QR للانضمام</small></div>'}</div>
      </section>

      <section class="host-panel host-games-panel">
        <div class="host-section-heading">
          <div><span class="host-section-kicker">اختروا وجهتكم</span><h2>الألعاب</h2><p>اختر لعبة لعرض تفاصيلها والتحكم في بدايتها</p></div>
          <span class="host-game-mark" aria-hidden="true">✦</span>
        </div>
        <div class="games-grid">${cardsHtml}</div>
      </section>
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

window.hostLeaveRoom = function(code){
  if (!confirm('سيتم حذف الغرفة نهائيًا وطرد جميع اللاعبين منها. متابعة؟')) return;
  db.ref('rooms/'+code).remove();
  db.ref('strokes/'+code+'_A').remove();
  db.ref('strokes/'+code+'_B').remove();
  localStorage.removeItem('hostRoomCode');
  renderEntryChoice();
};
