/* =====================================================================
   SECTION 5 — HOST CONTROLLER
   ===================================================================== */
let ACTIVE_HOST_CODE = null;
let lastHostRoom = null;
let hostDetailGameId = null;
let hostRoomRef = null;
let hostDashboardTab = 'games';
function detachHostRoom(){ if (hostRoomRef){ hostRoomRef.off('value'); hostRoomRef = null; } }
function allocateRoomCode(attempt = 0){
  const code = makeRoomCode();
  return db.ref('rooms/' + code).once('value').then(s => (s.exists() && attempt < 20) ? allocateRoomCode(attempt + 1) : code);
}

function renderHost(){
  if (typeof setVersionFooterVisibility === 'function') setVersionFooterVisibility(false);
  if (typeof detachPlayerRoom === 'function') detachPlayerRoom();
  const savedCode = localStorage.getItem('hostSessionCode');
  if (savedCode) {
    db.ref('rooms/' + savedCode).once('value', snap => {
      if (snap.exists()) initHostRoom(savedCode, false);
      else { localStorage.removeItem('hostSessionCode'); allocateRoomCode().then(c => initHostRoom(c, true)); }
    });
  } else {
    allocateRoomCode().then(c => initHostRoom(c, true));
  }
}

function initHostRoom(code, isNew){
  ACTIVE_HOST_CODE = code;
  localStorage.setItem('hostSessionCode', code);
  const roomRef = db.ref('rooms/' + code);
  if (isNew) roomRef.set({ status:'voting', players:{}, votes:{}, activeGame:null });

  app.innerHTML = `
    <div class="stage" id="stage"></div>
  `;

  detachHostRoom();
  hostRoomRef = roomRef;
  roomRef.on('value', snap => dispatchHostRender(code, snap.val()));
}

function dispatchHostRender(code, room){
  if (!room) {
    if (window.stopQataraHostWatch) stopQataraHostWatch();
    return;
  }
  const previousRoom = lastHostRoom;
  const activityId = room.status === 'in_tool'
    ? room.activeTool
    : room.status === 'voting'
      ? hostDetailGameId
      : room.activeGame;
  setActivityBackdrop(activityId);
  room = roomForGame(room, activityId);
  lastHostRoom = room;
  stopHostTimerWatch();
  if (!(room.status === 'in_game' && room.activeGame === 'silentdraw')) stopMirrorCanvases();
  if (!(room.status === 'in_game' && room.activeGame === 'qatara') && window.stopQataraHostWatch) stopQataraHostWatch();
  if (room.status === 'voting' && previousRoom?.status === 'voting' && !hostDetailGameId && document.querySelector('.host-dashboard')) return;
  // لا نعيد رسم الردهة أثناء فتح نافذة الحساب حتى لا تُغلق أو يضيع ما كُتب فيها
  if (room.status === 'voting' && document.getElementById('accountModal')?.classList.contains('is-open')) return;
  if (!(room.status === 'in_tool' && room.activeTool === 'buzzer') && window.closeBuzzerRtcHost) closeBuzzerRtcHost();
  if (room.status === 'voting') renderHostLobby(code, room);
  else if (room.status === 'trivia_setup' && room.activeGame === 'trivia') renderTriviaHost(code, room);
  else if (room.status === 'in_tool' && room.activeTool === 'buzzer') renderBuzzerHost(code, room);
  else if (room.status === 'in_game' && room.activeGame === 'trivia') renderTriviaHost(code, room);
  else if (room.status === 'in_game' && room.activeGame === 'mafia') renderMafiaHost(code, room);
  else if (room.status === 'in_game' && room.activeGame === 'silentdraw') renderSilentDrawHost(code, room);
  else if (room.status === 'in_game' && room.activeGame === 'qatara') renderQataraHost(code, room);
  else renderHostGenericPlaceholder(code, room);
}

window.showHostGameDetail = function(gameId){
  hostDetailGameId = gameId;
  db.ref('rooms/' + ACTIVE_HOST_CODE).update({ selectedGame:gameId, players:{}, votes:{} });
};
window.hideHostGameDetail = function(){ hostDetailGameId = null; if (lastHostRoom) renderHostLobby(ACTIVE_HOST_CODE, lastHostRoom); };
window.setHostDashboardTab = function(tab){
  if (tab !== 'games' && tab !== 'tools') return;
  hostDashboardTab = tab;
  if (lastHostRoom) renderHostLobby(ACTIVE_HOST_CODE, lastHostRoom);
};
window.toggleAccountInfo = function(){ document.getElementById('accountModal')?.classList.toggle('is-open'); };
window.signOut = function(){
  detachHostRoom();
  if (firebase.auth().currentUser) firebase.auth().signOut();
  else { localStorage.removeItem('adminGuestName'); renderGoogleSignIn(); }
};
window.saveGameUsername = async function(){
  const user = firebase.auth().currentUser;
  const input = document.getElementById('gameUsernameInput');
  const status = document.getElementById('usernameStatus');
  const name = input?.value.trim();
  if (!user || !name || name.length < 2) { status.textContent = 'اكتب اسمًا من حرفين على الأقل.'; return; }
  try {
    await user.updateProfile({ displayName:name });
    if (ACTIVE_ROOM_CODE && ACTIVE_PLAYER_ID) await db.ref(`rooms/${ACTIVE_ROOM_CODE}/players/${ACTIVE_PLAYER_ID}/name`).set(name);
    status.textContent = 'تم حفظ الاسم. سيظهر في الألعاب.';
    if (lastHostRoom) renderHostLobby(ACTIVE_HOST_CODE, lastHostRoom);
  } catch (error) {
    console.error('Username update failed:', error);
    status.textContent = 'تعذر حفظ الاسم. حاول مرة أخرى.';
  }
};

function accountInfoHtml(){
  const user = firebase.auth().currentUser;
  const isAdminGuest = !user && !!localStorage.getItem('adminGuestName');
  const name = escapeHtml(user?.displayName || localStorage.getItem('adminGuestName') || 'المستخدم');
  const email = escapeHtml(user?.email || '');
  const accountType = isAdminGuest ? 'Admin' : 'حساب Google';
  const photo = user?.photoURL ? `<img src="${escapeHtml(user.photoURL)}" alt="صورة ${name}">` : `<span>${escapeHtml(name.charAt(0))}</span>`;
  return `<div class="account-menu">
    <button type="button" class="account-avatar-button" onclick="toggleAccountInfo()" aria-label="إظهار معلومات الحساب">${photo}</button>
    <div class="account-modal" id="accountModal" role="dialog" aria-modal="true" aria-label="معلومات الحساب">
      <article class="account-card">
        <button type="button" class="account-close" onclick="toggleAccountInfo()" aria-label="إغلاق">×</button>
        <div class="account-profile-image">${photo}</div>
        <span class="host-section-kicker">${accountType}</span>
        <h2>${name}</h2>
        ${email ? `<p class="account-email">${email}</p>` : ''}
        ${isAdminGuest ? `<section class="account-game-name"><span>الاسم المستخدم في لوحة التحكم</span><strong>${name}</strong></section>` : `<section class="account-game-name"><label for="gameUsernameInput">اسم المستخدم في الألعاب</label><input id="gameUsernameInput" type="text" maxlength="30" value="${name}" autocomplete="nickname"><small>سيظهر هذا الاسم للاعبين أثناء المشاركة.</small><button type="button" class="btn account-save-name" onclick="saveGameUsername()">حفظ الاسم</button><small id="usernameStatus"></small></section>`}
        <button type="button" class="btn btn-ghost account-signout" onclick="signOut()">تسجيل الخروج</button>
      </article>
    </div>
  </div>`;
}

function renderHostLobby(code, room){
  if (hostDetailGameId) {
    const game = GAMES_LIST.find(g => g.id === hostDetailGameId);
    const inviteUrl = joinGameUrl(code, game.id);
    const invite = game.minPlayers > 1 ? joinCardHtml('gameInvite', inviteUrl) : '';
    document.getElementById('stage').innerHTML = gameDetailHtml(game, room, code, null, true, invite);
    if (game.minPlayers > 1) initJoinCard('gameInvite', inviteUrl);
    return;
  }

  const players = room.players || {};

  const cardsHtml = GAMES_LIST.map(g => {
    if (!g.available) {
      return `<div class="game-card disabled">
        <div class="game-icon-badge">${gameIconHtml(g)}</div>
        <div class="game-title">${g.title}</div>
        <div class="coming-soon">قريبًا</div>
      </div>`;
    }
    return `<div class="game-card" onclick="showHostGameDetail('${g.id}')">
      <div class="game-icon-badge">${gameIconHtml(g)}</div>
      <div class="game-title">${g.title}</div>
      <div class="vote-badge">الحد الأدنى ${g.minPlayers}</div>
    </div>`;
  }).join('');
  const toolsHtml = `<section class="host-tools-section" aria-labelledby="host-tools-heading">
    <div class="host-games-header"><span class="host-section-kicker">أدوات مساندة</span><h2 id="host-tools-heading">أدوات الجلسة</h2></div>
    <button type="button" class="game-card host-tool-card" onclick="startBuzzerTool('${code}')"><span class="game-icon-badge">${iconImageHtml('assets/icons/answer-buzzer.svg')}</span><span class="game-title">جرس الإجابة</span><span class="vote-badge">أسرع ضغطة</span></button>
  </section>`;
  const dashboardContent = hostDashboardTab === 'tools'
    ? toolsHtml
    : `<section class="host-games-section" aria-labelledby="host-games-heading"><div class="host-games-header"><span class="host-section-kicker">الألعاب المتاحة</span><h2 id="host-games-heading">اختر لعبة</h2></div><div class="games-grid host-games-grid">${cardsHtml}</div></section>`;

  document.getElementById('stage').innerHTML = `
    <div class="host-dashboard">
      <main class="host-games-main">
        <header class="host-games-header host-page-header">
          <div>
            <span class="host-section-kicker">لوحة التحكم</span>
            <h1>${hostDashboardTab === 'tools' ? 'الأدوات' : 'الألعاب'}</h1>
          </div>
          ${accountInfoHtml()}
        </header>
        <nav class="dashboard-tabs" aria-label="صفحات لوحة التحكم">
          <button type="button" class="dashboard-tab ${hostDashboardTab === 'games' ? 'is-active' : ''}" aria-current="${hostDashboardTab === 'games' ? 'page' : 'false'}" onclick="setHostDashboardTab('games')">الألعاب</button>
          <button type="button" class="dashboard-tab ${hostDashboardTab === 'tools' ? 'is-active' : ''}" aria-current="${hostDashboardTab === 'tools' ? 'page' : 'false'}" onclick="setHostDashboardTab('tools')">الأدوات</button>
        </nav>
        ${dashboardContent}
      </main>
    </div>
  `;
}

function renderHostGenericPlaceholder(code, room){
  const g = GAMES_LIST.find(x=>x.id===room.activeGame);
  document.getElementById('stage').innerHTML = `
    <h2 style="font-family:'Cairo'; color:var(--accent);"> ${g ? g.title : ''}</h2>
    <p class="muted">هذه اللعبة قيد التطوير حاليًا.</p>
    <button class="btn btn-danger" onclick="resetToLobby('${code}')"> إنهاء اللعبة والعودة للرئيسية</button>
  `;
}

window.startGame = function(gameId, code){
  hostDetailGameId = null;
  if (gameId === 'mafia') { startMafiaGame(code); return; }
  if (gameId === 'silentdraw') { startSilentDrawGame(code); return; }
  if (gameId === 'trivia') { startTriviaSetup(code); return; }
  if (gameId === 'qatara') { startQataraGame(code); return; }
  db.ref('rooms/'+code).update({ status:'in_game', activeGame: gameId });
};

window.startBuzzerTool = function(code){
  hostDetailGameId = null;
  if (window.buzzerUnlockAudio) window.buzzerUnlockAudio();
  const session=Date.now()+'_'+Math.random().toString(36).slice(2,8);
  db.ref('rooms/'+code).update({ status:'in_tool', activeTool:'buzzer', players:{}, buzzerTransport:window.RTCPeerConnection?'rtc':'firebase', buzzerSession:session, buzzerRtc:null, buzzerFallback:null, buzzer:{ winner:null, pressedAt:null, presses:{}, locked:false, timer:null, round:0 } });
};

window.resetToLobby = function(code){
  db.ref('rooms/'+code).update({ status:'voting', activeGame:null, activeTool:null, buzzerTransport:null, buzzerSession:null, buzzerRtc:null, buzzerFallback:null, selectedGame:null, votes:{}, mafia:null, silentdraw:null, trivia:null, buzzer:null });
  db.ref('strokes/'+code+'_A').set(null);
  db.ref('strokes/'+code+'_B').set(null);
};

window.hostLeaveRoom = function(code){
  db.ref('rooms/'+code).remove();
  db.ref('strokes/'+code+'_A').remove();
  db.ref('strokes/'+code+'_B').remove();
  localStorage.removeItem('hostSessionCode');
  renderHost();
};
