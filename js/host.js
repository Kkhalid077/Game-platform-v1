/* =====================================================================
   SECTION 5 — HOST CONTROLLER
   ===================================================================== */
let ACTIVE_HOST_CODE = null;
let lastHostRoom = null;
let hostDetailGameId = null;
let hostRoomRef = null;
let hostDashboardTab = 'games';
let lastHostViewKey = null;
function detachHostRoom(){ if (hostRoomRef){ hostRoomRef.off('value'); hostRoomRef = null; } }
function allocateRoomCode(attempt = 0){
  const code = makeRoomCode();
  return db.ref('rooms/' + code).once('value').then(s => (s.exists() && attempt < 20) ? allocateRoomCode(attempt + 1) : code);
}

function renderHost(){
  if (typeof stopLandingCarousels === 'function') stopLandingCarousels();
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
  lastHostViewKey = null;
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
    window.stopXoNetworkPlayerWatch?.();
    stopDrawBoardHost();
    if (window.stopQataraHostWatch) stopQataraHostWatch();
    return;
  }
  if (room.status === 'in_game' && room.activeGame === 'xo' &&
      room.xo?.mode === 'network' && room.xo.phase === 'waiting') {
    window.ensureXoNetworkStarted?.(code);
  } else window.stopXoNetworkPlayerWatch?.();
  const isDashboard = room.status === 'voting' && !hostDetailGameId;
  if (typeof setVersionFooterVisibility === 'function') setVersionFooterVisibility(isDashboard, isDashboard);
  const previousRoom = lastHostRoom;
  const activityId = room.status === 'in_tool'
    ? room.activeTool
    : room.status === 'voting'
      ? hostDetailGameId
      : room.activeGame;
  setActivityBackdrop(activityId);
  room = roomForGame(room, activityId);
  if(isDrawBoardLiveChangeOnly(previousRoom,room)){
    lastHostRoom=room;
    return;
  }
  if (!(room.status === 'in_tool' && room.activeTool === 'drawboard')) stopDrawBoardHost();
  if (!(room.status === 'in_game' && room.activeGame === 'trivia' &&
        ['board','question','done'].includes(room.trivia?.phase))) {
    window.triviaRestorePortrait?.();
  }
  if (isTriviaQuestionTurnOnlyChange(previousRoom, room)) {
    lastHostRoom = room;
    updateTriviaQuestionTurnDisplays(code, room);
    return;
  }
  if (hostDetailGameId && isTeamNamesOnlyChange(previousRoom, room)) {
    lastHostRoom = room;
    updateTeamNameDisplays(room.teamNames || {});
    return;
  }
  if (hostDetailGameId && isPlayerTeamOnlyChange(previousRoom, room)) {
    lastHostRoom = room;
    updateHostGameDetailPlayers(code, room);
    return;
  }
  if (isSilentDrawStrokesOnlyChange(previousRoom, room)) {
    lastHostRoom = room;
    return;
  }
  lastHostRoom = room;
  stopHostTimerWatch();
  if (!(room.status === 'in_game' && room.activeGame === 'silentdraw')) stopMirrorCanvases();
  if (!(room.status === 'in_game' && room.activeGame === 'qatara') && window.stopQataraHostWatch) stopQataraHostWatch();
  if (room.status === 'voting' && previousRoom?.status === 'voting' && !hostDetailGameId && document.querySelector('.host-dashboard')) return;
  // لا نعيد رسم الردهة أثناء فتح نافذة الحساب حتى لا تُغلق أو يضيع ما كُتب فيها
  if (room.status === 'voting' && document.getElementById('accountModal')?.classList.contains('is-open')) return;
  if (!(room.status === 'in_tool' && room.activeTool === 'buzzer') && window.closeBuzzerRtcHost) closeBuzzerRtcHost();
  const viewKey = room.status === 'voting'
    ? `voting:${hostDetailGameId || 'dashboard'}:${hostDetailGameId ? '' : hostDashboardTab}`
    : `${room.status}:${room.activeTool || room.activeGame || ''}`;
  const renderView = () => {
    if (room.status === 'voting') renderHostLobby(code, room);
    else if (room.status === 'trivia_setup' && room.activeGame === 'trivia') renderTriviaHost(code, room);
    else if (room.status === 'in_tool' && room.activeTool === 'drawboard') renderDrawBoardHost(code, room);
    else if (room.status === 'in_tool' && room.activeTool === 'buzzer') renderBuzzerHost(code, room);
    else if (room.status === 'in_game' && room.activeGame === 'trivia') renderTriviaHost(code, room);
    else if (room.status === 'in_game' && room.activeGame === 'mafia') renderMafiaHost(code, room);
    else if (room.status === 'in_game' && room.activeGame === 'silentdraw') renderSilentDrawHost(code, room);
    else if (room.status === 'in_game' && room.activeGame === 'qatara') renderQataraHost(code, room);
    else if (room.status === 'in_game' && room.activeGame === 'xo') renderXoHost(code, room);
    else if (room.status === 'in_game' && room.activeGame === 'letter-cell') renderLetterCellHost(code, room);
    else renderHostGenericPlaceholder(code, room);
  };
  const shouldTransition = lastHostViewKey !== null && lastHostViewKey !== viewKey;
  lastHostViewKey = viewKey;
  if (shouldTransition) transitionAppView(renderView);
  else renderView();
}

function isTriviaQuestionTurnOnlyChange(previousRoom, room){
  const previousTrivia = previousRoom?.trivia;
  const trivia = room.trivia;
  if (previousRoom?.status !== 'in_game' || previousRoom.activeGame !== 'trivia' ||
      room.status !== 'in_game' || room.activeGame !== 'trivia' ||
      previousTrivia?.phase !== 'question' || trivia?.phase !== 'question' ||
      !previousTrivia.current || !trivia.current ||
      previousTrivia.current.team === trivia.current.team) return false;
  const withoutTurn = value => {
    const comparable = {...value, current: {...value.current}};
    delete comparable.current.team;
    return JSON.stringify(comparable);
  };
  return withoutTurn(previousTrivia) === withoutTurn(trivia);
}

function updateTriviaQuestionTurnDisplays(code, room){
  const current = room.trivia.current;
  const team = current.team || 'A';
  const label = document.querySelector('.trivia-question-turn > span');
  const switchButton = document.querySelector('.trivia-question-turn-switch');
  const sidebar = document.querySelector('.trivia-question-sidebar');
  if (label) label.textContent = `دور ${room.trivia.teams?.[team] || 'الفريق صاحب الدور'}`;
  if (switchButton) switchButton.setAttribute('onclick', `triviaSetQuestionTurn('${code}','${team==='A'?'B':'A'}')`);
  if (sidebar) sidebar.innerHTML = renderTriviaTeamAidCards(code, room.trivia, current);
}

function updateHostGameDetailPlayers(code, room){
  const game = GAMES_LIST.find(item => item.id === hostDetailGameId);
  if (!game?.needsTeams) return;
  const currentTeamOptions = document.querySelector('.team-options-readonly');
  const currentPlayersBox = document.querySelector('.lobby-players-box');
  if (!currentTeamOptions && !currentPlayersBox) return;
  const template = document.createElement('template');
  template.innerHTML = gameDetailHtml(game, room, code, null, true).trim();
  const nextTeamOptions = template.content.querySelector('.team-options-readonly');
  const nextPlayersBox = template.content.querySelector('.lobby-players-box');
  if (currentTeamOptions && nextTeamOptions) currentTeamOptions.replaceWith(nextTeamOptions);
  if (currentPlayersBox && nextPlayersBox) currentPlayersBox.replaceWith(nextPlayersBox);
}

window.showHostGameDetail = function(gameId){
  hostDetailGameId = gameId;
  if (lastHostRoom && document.getElementById('stage')) {
    transitionAppView(() => renderHostLobby(ACTIVE_HOST_CODE, lastHostRoom));
  }
  db.ref('rooms/' + ACTIVE_HOST_CODE).update({ selectedGame:gameId, players:{}, votes:{} });
};
window.hideHostGameDetail = function(){
  hostDetailGameId = null;
  lastHostViewKey = `voting:dashboard:${hostDashboardTab}`;
  if (lastHostRoom) transitionAppView(() => renderHostLobby(ACTIVE_HOST_CODE, lastHostRoom));
};
window.setHostDashboardTab = function(tab){
  if (tab !== 'games' && tab !== 'tools' && tab !== 'pricing') return;
  hostDashboardTab = tab;
  lastHostViewKey = `voting:dashboard:${hostDashboardTab}`;
  if (lastHostRoom) transitionAppView(() => renderHostLobby(ACTIVE_HOST_CODE, lastHostRoom));
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
        <section class="account-game-name account-font-setting">
          <span class="host-section-kicker">إعدادات المنصة</span>
          <label for="platformFontSelect">خط المنصة</label>
          <select id="platformFontSelect" onchange="setPlatformFont(this.value)">
            <option value="ibm-plex" ${getPlatformFont()==='ibm-plex'?'selected':''}>IBM Plex Sans Arabic</option>
            <option value="thmanyah" ${getPlatformFont()==='thmanyah'?'selected':''}>خط ثمانية</option>
          </select>
          <small id="platformFontStatus" role="status">يُحفظ اختيارك على هذا الجهاز.</small>
        </section>
        ${isAdminGuest ? `<section class="account-game-name"><span>الاسم المستخدم في لوحة التحكم</span><strong>${name}</strong></section>` : `<section class="account-game-name"><label for="gameUsernameInput">اسم المستخدم في الألعاب</label><input id="gameUsernameInput" type="text" maxlength="30" value="${name}" autocomplete="nickname"><small>سيظهر هذا الاسم للاعبين أثناء المشاركة.</small><button type="button" class="btn account-save-name" onclick="saveGameUsername()">حفظ الاسم</button><small id="usernameStatus"></small></section>`}
        <button type="button" class="btn btn-ghost account-signout" onclick="signOut()">تسجيل الخروج</button>
      </article>
    </div>
  </div>`;
}

function renderHostLobby(code, room){
  if (typeof setVersionFooterVisibility === 'function') setVersionFooterVisibility(!hostDetailGameId, !hostDetailGameId);
  const selectedGame = hostDetailGameId ? GAMES_LIST.find(g => g.id === hostDetailGameId) : null;
  const selectedInviteUrl = selectedGame?.id === 'trivia' ? null : selectedGame ? joinGameUrl(code, selectedGame.id) : null;
  const selectedInviteId = selectedGame?.id === 'xo' ? 'xoNetworkInviteCard' : 'gameInvite';
  const selectedInvite = selectedInviteUrl && selectedGame.minPlayers > 1 ? joinCardHtml(selectedInviteId, selectedInviteUrl) : '';
  const detailModal = selectedGame ? gameDetailHtml(selectedGame, room, code, null, true, selectedInvite) : '';

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
    </div>`;
  }).join('');
  const toolsHtml = `<section class="host-tools-section" aria-label="أدوات مساندة">
    <div class="host-games-header"><span class="host-section-kicker">أدوات مساندة</span></div>
    <div class="games-grid host-tools-grid">
      <button type="button" class="game-card host-tool-card" onclick="startBuzzerTool('${code}')"><span class="game-icon-badge">${iconImageHtml('assets/icons/answer-buzzer.svg')}</span><span class="game-title">جرس الإجابة</span><span class="vote-badge">أسرع ضغطة</span></button>
      <button type="button" class="game-card host-tool-card drawboard-tool-card" onclick="startDrawBoardTool('${code}')"><span class="game-icon-badge" aria-hidden="true">🖌️</span><span class="game-title">لوح الرسم المشترك</span><span class="vote-badge">ارسموا معًا مباشرة</span></button>
    </div>
  </section>`;
  const dashboardContent = hostDashboardTab === 'tools'
    ? toolsHtml
    : hostDashboardTab === 'pricing'
      ? `<section class="host-pricing-section" aria-labelledby="host-pricing-heading">
          <div class="host-games-header"><span class="host-section-kicker">باقات شهرية</span><h2 id="host-pricing-heading">التسعيرة المقترحة</h2>
            <p>أسعار مبدئية للمراجعة؛ الاشتراكات والدفع غير متاحين حاليًا.</p>
          </div>
          <div class="host-pricing-grid">
            <article class="host-pricing-card"><span class="host-section-kicker">للبداية</span><h3>مجانية</h3><p class="host-pricing-amount">٠ <span>ر.س / شهر</span></p><p>للتعرّف على الألعاب والأدوات واستخدامها.</p><span class="host-pricing-label">مقترح مبدئي</span></article>
            <article class="host-pricing-card is-featured"><span class="host-section-kicker">للاستخدام المنتظم</span><h3>أساسية</h3><p class="host-pricing-amount">١٩ <span>ر.س / شهر</span></p><p>للاستخدام المتكرر للمنصة في الجلسات.</p><span class="host-pricing-label">مقترح مبدئي</span></article>
            <article class="host-pricing-card"><span class="host-section-kicker">للمجموعات</span><h3>مميزة</h3><p class="host-pricing-amount">٤٩ <span>ر.س / شهر</span></p><p>للمجموعات والمنظمين ذوي الاستخدام المكثف.</p><span class="host-pricing-label">مقترح مبدئي</span></article>
          </div>
        </section>`
      : `<section class="host-games-section" aria-label="الألعاب المتاحة"><div class="host-games-header"><span class="host-section-kicker">الألعاب المتاحة</span></div><div class="games-grid host-games-grid">${cardsHtml}</div></section>`;

  document.getElementById('stage').innerHTML = `
    <div class="host-shell">
      <header class="host-topbar">
        ${platformBrandHtml('host-brand')}
        <nav class="host-topbar-nav" aria-label="التنقل">
          <button type="button" class="host-topbar-link ${hostDashboardTab === 'games' ? 'is-active' : ''}" aria-current="${hostDashboardTab === 'games' ? 'page' : 'false'}" onclick="setHostDashboardTab('games')">الألعاب</button>
          <button type="button" class="host-topbar-link ${hostDashboardTab === 'tools' ? 'is-active' : ''}" aria-current="${hostDashboardTab === 'tools' ? 'page' : 'false'}" onclick="setHostDashboardTab('tools')">الأدوات</button>
          <button type="button" class="host-topbar-link ${hostDashboardTab === 'pricing' ? 'is-active' : ''}" aria-current="${hostDashboardTab === 'pricing' ? 'page' : 'false'}" onclick="setHostDashboardTab('pricing')">التسعيرة</button>
        </nav>
        ${accountInfoHtml()}
      </header>
      <div class="host-dashboard">
        <main class="host-games-main">
          ${dashboardContent}
        </main>
      </div>
    </div>
    ${detailModal}
  `;
  if (selectedInvite) initJoinCard(selectedInviteId, selectedInviteUrl);
}

function renderHostGenericPlaceholder(code, room){
  const g = GAMES_LIST.find(x=>x.id===room.activeGame);
  document.getElementById('stage').innerHTML = `
    <h2 style="font-family:'Cairo'; color:var(--accent);"> ${g ? g.title : ''}</h2>
    <p class="muted">هذه اللعبة قيد التطوير حاليًا.</p>
    ${activityExitControlsHtml(code, room.activeGame)}
  `;
}

window.startGame = function(gameId, code){
  hostDetailGameId = null;
  if (gameId === 'mafia') { startMafiaGame(code); return; }
  if (gameId === 'silentdraw') { startSilentDrawGame(code); return; }
  if (gameId === 'trivia') { startTriviaSetup(code); return; }
  if (gameId === 'qatara') { startQataraGame(code); return; }
  if (gameId === 'xo') { startXoGame(code); return; }
  if (gameId === 'letter-cell') { startLetterCellGame(code); return; }
  db.ref('rooms/'+code).update({ status:'in_game', activeGame: gameId });
};

window.startBuzzerTool = function(code){
  hostDetailGameId = null;
  if (window.buzzerUnlockAudio) window.buzzerUnlockAudio();
  const session=Date.now()+'_'+Math.random().toString(36).slice(2,8);
  db.ref('rooms/'+code).update({ status:'in_tool', activeTool:'buzzer', players:{}, buzzerTransport:window.RTCPeerConnection?'rtc':'firebase', buzzerSession:session, buzzerRtc:null, buzzerFallback:null, buzzer:{ winner:null, pressedAt:null, presses:{}, locked:false, timer:null, round:0 } });
};

window.resetToLobby = async function(code){
  stopDrawBoardHost?.();
  try{
    await db.ref('rooms/'+code).update({ status:'voting', activeGame:null, activeTool:null, buzzerTransport:null, buzzerSession:null, buzzerRtc:null, buzzerFallback:null, selectedGame:null, votes:{}, mafia:null, silentdraw:null, trivia:null, qatara:null, xo:null, letterCell:null, buzzer:null, drawingBoards:null });
  }catch(error){
    console.error('Could not leave the active room tool:',error);
    alert('تعذر الخروج من الأداة. تحقق من الاتصال وحاول مرة أخرى.');
  }
};

function activityExitControlsHtml(code,gameId){
  return `<div class="activity-exit-controls">
    ${gameId === 'xo' ? '' : `<button type="button" class="btn btn-danger" onclick="resetToLobby('${code}')">خروج</button>`}
    <button type="button" class="btn activity-return-detail" onclick="returnToGameDetail('${code}','${gameId}')">إنهاء اللعبة</button>
  </div>`;
}

window.returnToGameDetail = async function(code,gameId){
  if(!GAMES_LIST.some(game=>game.id===gameId)){
    console.error('Cannot return to an unknown game detail page:',gameId);
    return;
  }
  hostDetailGameId = gameId;
  try{
    await db.ref('rooms/'+code).update({
      status:'voting',activeGame:null,activeTool:null,buzzerTransport:null,
      buzzerSession:null,buzzerRtc:null,buzzerFallback:null,selectedGame:gameId,
      votes:{},mafia:null,silentdraw:null,trivia:null,qatara:null,xo:null,letterCell:null,buzzer:null
    });
  }catch(error){
    hostDetailGameId = null;
    console.error('Could not return to game details:',error);
    alert('تعذر إنهاء اللعبة والعودة إلى تفاصيلها. تحقق من الاتصال وحاول مرة أخرى.');
  }
};

window.hostLeaveRoom = function(code){
  db.ref('rooms/'+code).remove();
  localStorage.removeItem('hostSessionCode');
  renderHost();
};
