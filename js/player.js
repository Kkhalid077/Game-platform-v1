/* =====================================================================
   SECTION 8 — PLAYER CONTROLLER
   ===================================================================== */
let CURRENT_PLAYER_NAME = '';
let ACTIVE_ROOM_CODE = null;
let ACTIVE_PLAYER_ID = null;
let lastPlayerRoom = null;
let playerDetailGameId = null;

function renderPlayer(code){
  setVersionFooterVisibility(false);
  const roomRef = db.ref('rooms/' + code);
  let myId = localStorage.getItem('player_id_' + code);

  function attach(id, name){
    CURRENT_PLAYER_NAME = name;
    ACTIVE_ROOM_CODE = code;
    ACTIVE_PLAYER_ID = id;
    roomRef.on('value', snap => {
      const room = snap.val();
      if (!room) { app.innerHTML = `<div class="phone"><div class="card"><h2 style="font-family:'Cairo';">انتهت الغرفة</h2><p class="muted">أغلق المضيف الغرفة أو انتهت صلاحيتها.</p><button class="btn" style="margin-top:14px;" onclick="renderEntryChoice()">رجوع للرئيسية</button></div></div>`; return; }
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
  if (!(room.status === 'in_tool' && room.activeTool === 'buzzer') && window.closeBuzzerRtcPlayer) closeBuzzerRtcPlayer();
  if (window.cleanupSilentCanvas) window.cleanupSilentCanvas();
  if (room.status === 'in_game' || room.status === 'trivia_setup' || room.status === 'in_tool') {
    renderPlayerGameNotice(code, myId, name, room);
    return;
  }
  renderPlayerVoting(code, myId, name, room);
}

window.showGameDetail = function(gameId){ playerDetailGameId = gameId; if (lastPlayerRoom) renderPlayerVoting(ACTIVE_ROOM_CODE, ACTIVE_PLAYER_ID, CURRENT_PLAYER_NAME, lastPlayerRoom); };
window.hideGameDetail = function(){ playerDetailGameId = null; if (lastPlayerRoom) renderPlayerVoting(ACTIVE_ROOM_CODE, ACTIVE_PLAYER_ID, CURRENT_PLAYER_NAME, lastPlayerRoom); };

function renderPlayerVoting(code, myId, name, room){
  if (playerDetailGameId){
    const game = GAMES_LIST.find(g => g.id === playerDetailGameId);
    app.innerHTML = gameDetailHtml(game, room, code, myId, false);
    return;
  }

  const cardsHtml = GAMES_LIST.map(g => {
    if (!g.available) return `<div class="game-card disabled"><div class="game-icon-badge">${gameIconHtml(g)}</div><div class="game-title">${g.title}</div><div class="coming-soon">قريبًا</div></div>`;
    return `<div class="game-card" onclick="showGameDetail('${g.id}')">
      <div class="game-icon-badge">${gameIconHtml(g)}</div><div class="game-title">${g.title}</div>
      <div class="vote-badge">${g.needsTeams ? 'انضم إلى فريق' : 'التفاصيل'}</div>
    </div>`;
  }).join('');

  app.innerHTML = `<div class="phone"><div class="card" style="max-width:520px;">
    <button class="btn btn-ghost" style="border-color:var(--accent-2); color:var(--accent-2);" onclick="leaveRoomAsPlayer('${code}','${myId}')">مغادرة الغرفة</button>
    <h2 style="font-family:'Cairo';">أهلاً ${escapeHtml(name)} </h2>
    <p class="muted">تصفّح الألعاب وانضم إلى فريق في الألعاب الجماعية. المنظّم يبدأ اللعبة ويعرضها على شاشته.</p>
    <div class="games-grid">${cardsHtml}</div>
    <p class="muted">بانتظار المنظّم لبدء اللعبة…</p>
  </div></div>`;
}

function renderPlayerGameNotice(code, myId, name, room){
  const game = GAMES_LIST.find(g => g.id === room.activeGame);
  const title = game ? game.title : (room.activeTool === 'buzzer' ? 'جرس الإجابة' : 'اللعبة');
  const teamHtml = game?.needsTeams ? teamSelectorHtml(game, room, code, myId, false) : '';
  app.innerHTML = `<div class="phone"><div class="card" style="max-width:520px;">
    <button class="btn btn-ghost" onclick="hideGameDetail()">عرض الألعاب</button>
    <div class="detail-icon">${game ? gameIconHtml(game, 'detail-icon-image') : iconImageHtml('assets/icons/answer-buzzer.svg', 'detail-icon-image')}</div>
    <h2 style="font-family:'Cairo';">${escapeHtml(title)}</h2>
    <p class="muted">اللعبة بدأت. المنظّم هو من يعرض اللعبة ويتحكم بها من شاشته؛ تابعوا الشاشة الرئيسية وشاركوا معه.</p>
    ${teamHtml}
    <p class="muted">أهلاً ${escapeHtml(name)}</p>
  </div></div>`;
}

/* ================= ENTRY POINT ================= */
function renderEntryChoice(){
  setVersionFooterVisibility(true);
  app.innerHTML = `<div class="phone"><div class="card">
    <h2 style="font-family:'Cairo';">منصة الألعاب</h2>
    <p class="muted">ابدأ جلسة اللعب أو انضم إلى غرفة موجودة.</p>
    <button class="btn" style="width:100%;" id="chooseHostBtn">إنشاء غرفة</button>
    <button class="btn btn-ghost" style="width:100%; margin-top:10px;" id="choosePlayerBtn">الدخول إلى غرفة</button>
  </div></div>`;
  document.getElementById('chooseHostBtn').onclick = () => renderHost();
  document.getElementById('choosePlayerBtn').onclick = () => renderJoinScreen();
}

function setVersionFooterVisibility(visible){
  const footer = document.querySelector('.site-footer');
  if (footer) footer.classList.toggle('is-entry-visible', visible);
  document.body.classList.toggle('has-version-footer', visible);
}

function renderJoinScreen(){
  app.innerHTML = `<div class="phone"><div class="card">
    <button class="btn btn-ghost" onclick="renderEntryChoice()">→ رجوع</button>
    <h2 style="font-family:'Cairo';">الانضمام كلاعب</h2>
    <p class="muted">اكتب رمز الغرفة الظاهر على شاشة المضيف:</p>
    <input type="text" id="codeInput" placeholder="مثال: 4821" maxlength="4" inputmode="numeric" autofocus />
    <button class="btn" id="joinCodeBtn" style="width:100%; margin-top:12px;">دخول</button>
    <p class="muted" id="codeError" style="color:var(--accent-2);"></p>
    <div style="margin-top:18px; border-top:1px solid #3a3650; padding-top:14px;">
      <button class="btn btn-ghost" id="qrScanBtn" style="width:100%;"> أو امسح رمز QR</button>
      <div id="qrArea" style="margin-top:12px; display:none;">
        <video id="qrVideo" style="width:100%; border-radius:12px;" playsinline muted></video>
        <p class="muted" id="qrError"></p>
      </div>
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
  document.getElementById('qrScanBtn').onclick = startQrScan;
}

let qrScanStream = null;
function stopQrScan(){
  if (qrScanStream) { qrScanStream.getTracks().forEach(t => t.stop()); qrScanStream = null; }
}
function startQrScan(){
  const area = document.getElementById('qrArea');
  const video = document.getElementById('qrVideo');
  const errEl = document.getElementById('qrError');
  area.style.display = 'block';
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(stream => {
    qrScanStream = stream;
    video.srcObject = stream;
    video.play();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const scanFrame = () => {
      if (!qrScanStream) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = window.jsQR && jsQR(imageData.data, imageData.width, imageData.height);
        if (result) {
          let roomCode = null;
          try { roomCode = new URL(result.data).searchParams.get('room'); } catch(e) {}
          if (roomCode) { stopQrScan(); renderPlayer(roomCode); return; }
        }
      }
      requestAnimationFrame(scanFrame);
    };
    requestAnimationFrame(scanFrame);
  }).catch(() => { errEl.textContent = 'تعذر الوصول إلى الكاميرا'; });
}

window.leaveRoomAsPlayer = function(code, myId){
  const roomRef = db.ref('rooms/'+code);
  roomRef.off();
  roomRef.child('players/'+myId).remove();
  localStorage.removeItem('player_id_'+code);
  renderEntryChoice();
};

const params = new URLSearchParams(location.search);
const roomParam = params.get('room');
if (roomParam) {
  renderPlayer(roomParam.trim());
} else if (localStorage.getItem('hostRoomCode')) {
  renderHost();
} else {
  renderEntryChoice();
}
