/* =====================================================================
   SECTION 8 — PLAYER CONTROLLER
   ===================================================================== */
let CURRENT_PLAYER_NAME = '';
let ACTIVE_ROOM_CODE = null;
let ACTIVE_PLAYER_ID = null;
let lastPlayerRoom = null;
let playerDetailGameId = null;

function renderPlayer(code, invitedGameId){
  setVersionFooterVisibility(false);
  const roomRef = db.ref('rooms/' + code);
  const signedInUser = firebase.auth().currentUser;
  const myId = signedInUser.uid;

  function attach(id, name){
    CURRENT_PLAYER_NAME = name;
    ACTIVE_ROOM_CODE = code;
    ACTIVE_PLAYER_ID = id;
    roomRef.on('value', snap => {
      const room = snap.val();
      if (!room) { app.innerHTML = `<div class="phone"><div class="card"><h2 style="font-family:'Cairo';">انتهت الجلسة</h2><p class="muted">لم تعد هذه اللعبة متاحة.</p><button class="btn" style="margin-top:14px;" onclick="renderHost()">الرئيسية</button></div></div>`; return; }
      dispatchPlayerRender(code, id, name, room, invitedGameId);
    });
  }

  const name = (signedInUser.displayName || signedInUser.email || 'لاعب').slice(0, 30);
  roomRef.child('players/' + myId).set({ name, gameId: invitedGameId || null, uid: myId });
  attach(myId, name);
}

function dispatchPlayerRender(code, myId, name, room, invitedGameId){
  lastPlayerRoom = room;
  if (!(room.status === 'in_tool' && room.activeTool === 'buzzer') && window.closeBuzzerRtcPlayer) closeBuzzerRtcPlayer();
  if (window.cleanupSilentCanvas) window.cleanupSilentCanvas();
  if (invitedGameId) {
    renderInvitedGame(code, myId, name, room, invitedGameId);
    return;
  }
  if (room.status === 'in_tool' && room.activeTool === 'buzzer') {
    renderBuzzerPlayer(code, myId, name, room);
    return;
  }
  if (room.status === 'in_game' || room.status === 'trivia_setup' || room.status === 'in_tool') {
    renderPlayerGameNotice(code, myId, name, room);
    return;
  }
  renderPlayerVoting(code, myId, name, room);
}

function renderInvitedGame(code, myId, name, room, gameId){
  if (gameId === 'buzzer') {
    if (room.status === 'in_tool' && room.activeTool === 'buzzer') return renderBuzzerPlayer(code, myId, name, room);
    app.innerHTML = `<div class="phone"><div class="card"><h2 style="font-family:'Cairo';">جرس الإجابة</h2><p class="muted">بانتظار المنظّم لفتح أداة الجرس.</p></div></div>`;
    return;
  }
  const game = GAMES_LIST.find(g => g.id === gameId);
  if (!game) { app.innerHTML = `<div class="phone"><div class="card"><h2>رابط لعبة غير صالح</h2></div></div>`; return; }
  if (room.status === 'in_game' && room.activeGame === gameId) {
    if (gameId === 'mafia') return renderMafiaPlayer(code, myId, name, room);
    if (gameId === 'silentdraw') return renderSilentDrawPlayer(code, myId, name, room);
    if (gameId === 'trivia') return renderTriviaPlayer(code, myId, name, room);
  }
  app.innerHTML = gameDetailHtml(game, room, code, myId, false) + `<p class="muted" style="text-align:center;">بانتظار المنظّم لبدء ${escapeHtml(game.title)}.</p>`;
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
    <button class="btn btn-ghost" style="border-color:var(--accent-2); color:var(--accent-2);" onclick="renderHost()">الرئيسية</button>
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

function setVersionFooterVisibility(visible){
  const footer = document.querySelector('.site-footer');
  if (footer) footer.classList.toggle('is-entry-visible', visible);
  document.body.classList.toggle('has-version-footer', visible);
}

function renderGoogleSignIn(){
  setVersionFooterVisibility(true);
  app.innerHTML = `<div class="phone"><div class="card"><h2 style="font-family:'Cairo';">منصة الألعاب</h2><p class="muted">سجّل الدخول بحساب Google للمتابعة.</p><button class="btn" id="googleSignInBtn" style="width:100%;">المتابعة مع Google</button><button class="btn btn-ghost" id="adminGuestBtn" style="width:100%; margin-top:10px;">دخول Admin</button><p class="muted" id="authError" style="color:var(--accent-2);"></p></div></div>`;
  const signIn = async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await firebase.auth().signInWithPopup(provider);
    }
    catch (error) {
      const messages = {
        'auth/operation-not-allowed': 'تسجيل الدخول عبر Google غير مفعّل في Firebase. فعّله من Authentication ← Sign-in method ← Google.',
        'auth/unauthorized-domain': 'نطاق الموقع الحالي غير مسموح في Firebase. أضفه في Authentication ← Settings ← Authorized domains.',
        'auth/popup-blocked': 'المتصفح حجب نافذة Google. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.',
        'auth/popup-closed-by-user': 'أُغلقت نافذة تسجيل الدخول قبل إكمال العملية.'
      };
      console.error('Google sign-in failed:', error.code, error);
      document.getElementById('authError').textContent = messages[error.code] || `تعذر تسجيل الدخول (${error.code || 'خطأ غير معروف'}).`;
    }
  };
  document.getElementById('googleSignInBtn').onclick = signIn;
  document.getElementById('adminGuestBtn').onclick = renderAdminNameEntry;
}

function renderAdminNameEntry(){
  app.innerHTML = `<div class="phone"><div class="card"><h2 style="font-family:'Cairo';">دخول Admin</h2><p class="muted">اكتب الاسم الذي سيظهر في لوحة التحكم.</p><input type="text" id="adminNameInput" maxlength="30" placeholder="الاسم" autofocus><button class="btn" id="adminEnterBtn" style="width:100%; margin-top:12px;">دخول</button><button class="btn btn-ghost" id="adminBackBtn" style="width:100%; margin-top:10px;">رجوع</button></div></div>`;
  const enter = () => {
    const name = document.getElementById('adminNameInput').value.trim();
    if (!name) return;
    localStorage.setItem('adminGuestName', name);
    renderHost();
  };
  document.getElementById('adminEnterBtn').onclick = enter;
  document.getElementById('adminNameInput').addEventListener('keydown', event => { if (event.key === 'Enter') enter(); });
  document.getElementById('adminBackBtn').onclick = renderGoogleSignIn;
}

firebase.auth().onAuthStateChanged(user => {
  if (!user) { if (localStorage.getItem('adminGuestName')) renderHost(); else renderGoogleSignIn(); return; }
  const params = new URLSearchParams(location.search);
  const sessionParam = params.get('session');
  const gameParam = params.get('game');
  if (sessionParam && gameParam) renderPlayer(sessionParam.trim(), gameParam.trim());
  else renderHost();
});
