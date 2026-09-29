/* =====================================================================
   SECTION 5 — HOST CONTROLLER
   ===================================================================== */
let ACTIVE_HOST_CODE = null;
let lastHostRoom = null;
let hostDetailGameId = null;

function renderHost(){
  if (typeof setVersionFooterVisibility === 'function') setVersionFooterVisibility(false);
  const savedCode = localStorage.getItem('hostSessionCode');
  if (savedCode) {
    db.ref('rooms/' + savedCode).once('value', snap => {
      if (snap.exists()) initHostRoom(savedCode, false);
      else { localStorage.removeItem('hostSessionCode'); initHostRoom(makeRoomCode(), true); }
    });
  } else {
    initHostRoom(makeRoomCode(), true);
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

  roomRef.on('value', snap => dispatchHostRender(code, snap.val()));
}

function dispatchHostRender(code, room){
  if (!room) return;
  lastHostRoom = room;
  if (!(room.status === 'in_tool' && room.activeTool === 'buzzer') && window.closeBuzzerRtcHost) closeBuzzerRtcHost();
  if (room.status === 'voting') renderHostLobby(code, room);
  else if (room.status === 'trivia_setup' && room.activeGame === 'trivia') renderTriviaHost(code, room);
  else if (room.status === 'in_tool' && room.activeTool === 'buzzer') renderBuzzerHost(code, room);
  else if (room.status === 'in_game' && room.activeGame === 'trivia') renderTriviaHost(code, room);
  else if (room.status === 'in_game' && room.activeGame === 'mafia') renderMafiaHost(code, room);
  else if (room.status === 'in_game' && room.activeGame === 'silentdraw') renderSilentDrawHost(code, room);
  else renderHostGenericPlaceholder(code, room);
}

window.showHostGameDetail = function(gameId){
  hostDetailGameId = gameId;
  db.ref('rooms/' + ACTIVE_HOST_CODE).update({ selectedGame:gameId, players:{}, votes:{} });
};
window.hideHostGameDetail = function(){ hostDetailGameId = null; if (lastHostRoom) renderHostLobby(ACTIVE_HOST_CODE, lastHostRoom); };
window.toggleAccountInfo = function(){ document.getElementById('accountModal')?.classList.toggle('is-open'); };
window.signOut = function(){
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
    document.getElementById('stage').innerHTML = gameDetailHtml(game, room, code, null, true) + (game.minPlayers > 1 ? `<section class="players-box" style="text-align:center;"><h3 style="font-family:'Cairo';">انضمام اللاعبين</h3><div id="gameInviteQr" style="display:inline-block; background:#fff; padding:8px;"></div><p class="muted">امسح الرمز أو افتح <a href="${joinGameUrl(code, game.id)}" target="_blank" rel="noopener">رابط اللعبة</a></p></section>` : '');
    if (game.minPlayers > 1) new QRCode(document.getElementById('gameInviteQr'), { text:joinGameUrl(code, game.id), width:120, height:120 });
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
    <div class="host-dashboard">
      <main class="host-games-main">
        <header class="host-games-header host-page-header">
          <div>
            <span class="host-section-kicker">لوحة التحكم</span>
            <h1>اختر لعبة</h1>
            <p>اختر بطاقة لقراءة التعليمات وبدء اللعبة وعرضها للاعبين.</p>
          </div>
          ${accountInfoHtml()}
        </header>
        <div class="games-grid host-games-grid">${cardsHtml}</div>
        <section class="host-tools-section" aria-labelledby="host-tools-heading">
          <div class="host-games-header"><span class="host-section-kicker">أدوات مساندة</span><h2 id="host-tools-heading">الأدوات</h2><p>أدوات تفاعلية تستخدمها أثناء الجلسة.</p></div>
          <button type="button" class="game-card host-tool-card" onclick="startBuzzerTool('${code}')"><span class="game-icon-badge">${iconImageHtml('assets/icons/answer-buzzer.svg')}</span><span class="game-title">جرس الإجابة</span><span class="vote-badge">أسرع ضغطة</span></button>
        </section>
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
  db.ref('rooms/'+code).update({ status:'in_game', activeGame: gameId });
};

window.startBuzzerTool = function(code){
  hostDetailGameId = null;
  if (window.buzzerUnlockAudio) window.buzzerUnlockAudio();
  const session=Date.now()+'_'+Math.random().toString(36).slice(2,8);
  db.ref('rooms/'+code).update({ status:'in_tool', activeTool:'buzzer', players:{}, buzzerTransport:'firebase', buzzerSession:session, buzzerRtc:null, buzzer:{ winner:null, locked:false, timer:null, round:0 } });
};

window.resetToLobby = function(code){
  db.ref('rooms/'+code).update({ status:'voting', activeGame:null, activeTool:null, buzzerTransport:null, buzzerSession:null, buzzerRtc:null, votes:{}, mafia:null, silentdraw:null, buzzer:null });
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
