/* =====================================================================
   SECTION 8 — PLAYER CONTROLLER
   ===================================================================== */
let CURRENT_PLAYER_NAME = '';
let ACTIVE_ROOM_CODE = null;
let ACTIVE_PLAYER_ID = null;
let lastPlayerRoom = null;
let playerDetailGameId = null;

function renderPlayer(code){
  const roomRef = db.ref('rooms/' + code);
  let myId = localStorage.getItem('player_id_' + code);

  function attach(id, name){
    CURRENT_PLAYER_NAME = name;
    ACTIVE_ROOM_CODE = code;
    ACTIVE_PLAYER_ID = id;
    roomRef.on('value', snap => {
      const room = snap.val();
      if (!room) { app.innerHTML = `<div class="phone"><div class="card"><h2 style="font-family:'Cairo';">انتهت الغرفة</h2><p class="muted">اطلب رابطًا جديدًا من المضيف.</p></div></div>`; return; }
      dispatchPlayerRender(code, id, name, room);
    });
  }

  if (!myId) {
    app.innerHTML = `<div class="phone"><div class="card">
      <h2 style="font-family:'Cairo';">انضم للغرفة</h2>
      <input type="text" id="nameInput" placeholder="اكتب اسمك" maxlength="15" autofocus />
      <button class="btn" id="joinBtn" style="width:100%; margin-top:15px;">دخول</button>
    </div></div>`;
    document.getElementById('joinBtn').onclick = () => {
      const name = document.getElementById('nameInput').value.trim();
      if (!name) return;
      const newId = roomRef.child('players').push().key;
      roomRef.child('players/' + newId).set({ name });
      localStorage.setItem('player_id_' + code, newId);
      attach(newId, name);
    };
  } else {
    roomRef.child('players/' + myId).once('value', snap => {
      if (snap.exists()) attach(myId, snap.val().name);
      else { localStorage.removeItem('player_id_' + code); renderPlayer(code); }
    });
  }
}

function dispatchPlayerRender(code, myId, name, room){
  lastPlayerRoom = room;
  if (room.status === 'voting') renderPlayerVoting(code, myId, name, room);
  else if (room.status === 'in_game' && room.activeGame === 'mafia') renderMafiaPlayer(code, myId, name, room);
  else if (room.status === 'in_game' && room.activeGame === 'silentdraw') renderSilentDrawPlayer(code, myId, name, room);
  else app.innerHTML = `<div class="phone"><div class="card"><h2 style="font-family:'Cairo';">🎮 اللعبة قيد التطوير</h2><p class="muted">انظر شاشة المضيف.</p></div></div>`;
}

window.showGameDetail = function(gameId){ playerDetailGameId = gameId; if (lastPlayerRoom) renderPlayerVoting(ACTIVE_ROOM_CODE, ACTIVE_PLAYER_ID, CURRENT_PLAYER_NAME, lastPlayerRoom); };
window.hideGameDetail = function(){ playerDetailGameId = null; if (lastPlayerRoom) renderPlayerVoting(ACTIVE_ROOM_CODE, ACTIVE_PLAYER_ID, CURRENT_PLAYER_NAME, lastPlayerRoom); };

function renderPlayerVoting(code, myId, name, room){
  if (playerDetailGameId){
    const game = GAMES_LIST.find(g => g.id === playerDetailGameId);
    app.innerHTML = gameDetailHtml(game, room, code, myId, false);
    return;
  }

  const votes = room.votes || {};
  const myPlayer = room.players && room.players[myId];
  const myTeam = myPlayer ? myPlayer.team : null;

  const cardsHtml = GAMES_LIST.map(g => {
    if (!g.available) return `<div class="game-card disabled"><div class="game-icon-badge">${g.icon}</div><div class="game-title">${g.title}</div><div class="coming-soon">قريبًا</div></div>`;
    const isReady = votes[myId] === g.id;
    return `<div class="game-card ${isReady?'selected':''}" onclick="showGameDetail('${g.id}')">
      <div class="game-icon-badge">${g.icon}</div><div class="game-title">${g.title}</div>
      ${isReady ? '<div class="vote-badge" style="background:var(--green);">أنت جاهز ✓</div>' : '<div class="vote-badge">التفاصيل</div>'}
    </div>`;
  }).join('');

  app.innerHTML = `<div class="phone"><div class="card" style="max-width:520px;">
    <h2 style="font-family:'Cairo';">أهلاً ${escapeHtml(name)} 👋</h2>

    <!-- خيار اختيار الفريق للألعاب الجماعية -->
    <div class="team-selector-box">
      <p style="margin:0 0 10px 0; font-weight:700; font-size:14px; color:var(--text);">انضم لأحد الفريقين (اختياري):</p>
      <button class="btn-team ${myTeam==='A'?'selected-a':''}" onclick="setPlayerTeam('${code}','${myId}','A')">🔵 فريق A</button>
      <button class="btn-team ${myTeam==='B'?'selected-b':''}" onclick="setPlayerTeam('${code}','${myId}','B')">🔴 فريق B</button>
      ${myTeam ? `<div style="font-size:12px; margin-top:6px; color:var(--text-dim);">أنت حالياً في <b>فريق ${myTeam}</b></div>` : '<div style="font-size:12px; margin-top:6px; color:var(--text-dim);">لم تختار فريقًا (سيتم توزيعك تلقائيًا)</div>'}
    </div>

    <p class="muted">اختر لعبة لعرض شرحها والاستعداد لها:</p>
    <div class="games-grid">${cardsHtml}</div>
    <p class="muted">بانتظار المضيف لبدء اللعبة…</p>
  </div></div>`;
}

/* ================= ENTRY POINT ================= */
function renderEntryChoice(){
  app.innerHTML = `<div class="phone"><div class="card">
    <h2 style="font-family:'Cairo';">🎮 منصة الألعاب</h2>
    <p class="muted">اكتب رمز الغرفة الظاهر على شاشة المضيف للانضمام:</p>
    <input type="text" id="codeInput" placeholder="مثال: 4821" maxlength="4" inputmode="numeric" autofocus />
    <button class="btn" id="joinCodeBtn" style="width:100%; margin-top:12px;">دخول</button>
    <p class="muted" id="codeError" style="color:var(--accent-2);"></p>
    <div style="margin-top:26px; border-top:1px solid #3a3650; padding-top:16px;">
      <button class="btn btn-ghost" id="hostStartBtn">أنا المضيف — ابدأ جلسة جديدة</button>
    </div>
  </div></div>`;

  const tryJoin = () => {
    const code = document.getElementById('codeInput').value.trim();
    const errEl = document.getElementById('codeError');
    if (!/^\d{4}$/.test(code)) { errEl.textContent = 'اكتب رمزًا من 4 أرقام'; return; }
    db.ref('rooms/' + code).once('value', snap => {
      if (!snap.exists()) { errEl.textContent = 'لا توجد غرفة بهذا الرمز'; return; }
      renderPlayer(code);
    });
  };
  document.getElementById('joinCodeBtn').onclick = tryJoin;
  document.getElementById('codeInput').addEventListener('keydown', e => { if (e.key === 'Enter') tryJoin(); });
  document.getElementById('hostStartBtn').onclick = () => renderHost();
}

const params = new URLSearchParams(location.search);
const roomParam = params.get('room');
if (roomParam) {
  renderPlayer(roomParam.trim());
} else if (localStorage.getItem('hostRoomCode')) {
  renderHost();
} else {
  renderEntryChoice();
}
