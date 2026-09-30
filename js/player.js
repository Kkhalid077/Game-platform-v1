/* =====================================================================
   SECTION 8 — PLAYER CONTROLLER
   ===================================================================== */
let CURRENT_PLAYER_NAME = '';
let ACTIVE_ROOM_CODE = null;
let ACTIVE_PLAYER_ID = null;
let lastPlayerRoom = null;
let playerDetailGameId = null;
let playerRoomRef = null;
let playerInviteGameId = null;
let activeGuestInvite = null;
let landingCarouselTimers = [];
function detachPlayerRoom(){ if (playerRoomRef){ playerRoomRef.off('value'); playerRoomRef = null; } }
function stopLandingCarousels(){
  landingCarouselTimers.forEach(timer => clearInterval(timer));
  landingCarouselTimers = [];
}
async function registerPlayerPresence(playerRef, record){
  await playerRef.onDisconnect().remove();
  await playerRef.set(record);
}
function setGuestExitButton(visible){
  let button = document.getElementById('guestExitButton');
  if (!visible) {
    button?.remove();
    return;
  }
  if (!button) {
    button = document.createElement('button');
    button.id = 'guestExitButton';
    button.className = 'guest-exit-button';
    button.type = 'button';
    button.textContent = 'خروج وتغيير الاسم';
    button.setAttribute('aria-label', 'الخروج وتغيير الاسم');
    button.onclick = () => window.exitInvitedPlayer();
    document.body.appendChild(button);
  }
  button.disabled = false;
  button.textContent = 'خروج وتغيير الاسم';
}
function showSessionEnded(){
  detachPlayerRoom();
  activeGuestInvite = null;
  setGuestExitButton(false);
  if (window.stopQataraPlayerWatch) stopQataraPlayerWatch();
  app.innerHTML = `<div class="phone"><div class="card"><h2>انتهت الجلسة</h2><p class="muted">لم تعد هذه اللعبة متاحة. اطلب من المنظّم رابطًا جديدًا.</p></div></div>`;
}

function renderPlayer(code, invitedGameId){
  setVersionFooterVisibility(false);
  setActivityBackdrop(invitedGameId);
  playerInviteGameId = invitedGameId || null;
  if (invitedGameId) setGuestExitButton(false);
  const roomRef = db.ref('rooms/' + code);
  const signedInUser = firebase.auth().currentUser;
  const guestNameKey = `guestPlayerName_${code}_${invitedGameId || 'default'}`;
  const guestIdKey = `guestPlayerId_${code}_${invitedGameId || 'default'}`;

  function attach(id, name, record){
    CURRENT_PLAYER_NAME = name;
    ACTIVE_ROOM_CODE = code;
    ACTIVE_PLAYER_ID = id;
    detachPlayerRoom();
    playerRoomRef = roomRef;
    let presenceWritePending = false;
    let lastRenderedRoom = null;
    roomRef.on('value', snap => {
      const room = snap.val();
      if (!room || !room.status) { showSessionEnded(); return; }
      if (isSilentDrawStrokesOnlyChange(lastRenderedRoom, room)) {
        lastRenderedRoom = room;
        return;
      }
      lastRenderedRoom = room;
      // إن مسح المنظّم قائمة اللاعبين (فتح لعبة/أداة جديدة) نعيد تسجيل اللاعب تلقائيًا
      const inviteOpen = !invitedGameId || room.selectedGame === invitedGameId || room.activeGame === invitedGameId || (invitedGameId === 'buzzer' && room.activeTool === 'buzzer');
      if (invitedGameId) {
        const currentRecord = room.players?.[id];
        if (inviteOpen && !currentRecord && !presenceWritePending) {
          presenceWritePending = true;
          registerPlayerPresence(roomRef.child('players/' + id), record).catch(error => {
            console.error('Could not restore invited player presence:', error);
          }).finally(() => { presenceWritePending = false; });
        }
        else if (!inviteOpen && currentRecord?.guest && currentRecord.gameId === invitedGameId) roomRef.child('players/' + id).remove();
      } else if (!(room.players && room.players[id])) {
        if (!presenceWritePending) {
          presenceWritePending = true;
          registerPlayerPresence(roomRef.child('players/' + id), record).catch(error => {
            console.error('Could not restore player presence:', error);
          }).finally(() => { presenceWritePending = false; });
        }
      }
      const currentName = room.players?.[id]?.name || name;
      CURRENT_PLAYER_NAME = currentName;
      dispatchPlayerRender(code, id, currentName, room, invitedGameId);
    });
  }

  if (invitedGameId) {
    const savedName = localStorage.getItem(guestNameKey);
    if (!savedName) {
      detachPlayerRoom();
      activeGuestInvite = null;
      setGuestExitButton(false);
      const gameTitle = GAMES_LIST.find(game => game.id === invitedGameId)?.title || (invitedGameId === 'buzzer' ? 'جرس الإجابة' : 'اللعبة');
      app.innerHTML = `<div class="phone"><div class="card"><h2 style="font-family:'Cairo';">${escapeHtml(gameTitle)}</h2><p class="muted">اكتب اسمك للانضمام إلى اللعبة.</p><form id="guestJoinForm"><input type="text" id="guestNameInput" maxlength="30" minlength="2" placeholder="اسمك" autocomplete="nickname" autofocus required><button class="btn" type="submit" style="width:100%; margin-top:12px;">دخول اللعبة</button></form><p class="muted" id="guestJoinStatus" role="status"></p></div></div>`;
      document.getElementById('guestJoinForm').onsubmit = event => {
        event.preventDefault();
        const name = document.getElementById('guestNameInput').value.trim();
        if (name.length < 2) {
          document.getElementById('guestJoinStatus').textContent = 'اكتب اسمًا من حرفين على الأقل.';
          return;
        }
        localStorage.setItem(guestNameKey, name);
        renderPlayer(code, invitedGameId);
      };
      return;
    }
    // لا نُنشئ غرفة وهمية إذا كان الرابط قديمًا أو الرمز خاطئًا
    roomRef.once('value').then(async snap => {
      if (!snap.exists() || !snap.val().status) { showSessionEnded(); return; }
      const myId = localStorage.getItem(guestIdKey) || `guest_${roomRef.child('players').push().key}`;
      localStorage.setItem(guestIdKey, myId);
      const record = { name:savedName, gameId:invitedGameId, guest:true };
      activeGuestInvite = { code, gameId:invitedGameId, playerId:myId, nameKey:guestNameKey };
      const room = snap.val();
      const inviteOpen = room.selectedGame === invitedGameId || room.activeGame === invitedGameId || (invitedGameId === 'buzzer' && room.activeTool === 'buzzer');
      if (inviteOpen) await registerPlayerPresence(roomRef.child('players/' + myId), record);
      attach(myId, savedName, record);
    }).catch(error => {
      activeGuestInvite = null;
      setGuestExitButton(false);
      console.error('Could not join the invited game:', error);
      app.innerHTML = `<div class="phone"><div class="card"><h2>تعذر الانضمام</h2><p class="muted">تحقق من الاتصال ثم أعد تحميل الصفحة للمحاولة مجددًا.</p></div></div>`;
    });
    return;
  }

  if (!signedInUser) { renderGoogleSignIn(); return; }
  const myId = signedInUser.uid;
  const name = (signedInUser.displayName || signedInUser.email || 'لاعب').slice(0, 30);
  const record = { name, gameId:null, uid:myId, photoURL:signedInUser.photoURL || null };
  registerPlayerPresence(roomRef.child('players/' + myId), record).then(() => {
    attach(myId, name, record);
  }).catch(error => {
    console.error('Could not register player presence:', error);
    app.innerHTML = `<div class="phone"><div class="card"><h2>تعذر الانضمام</h2><p class="muted">تعذر تسجيلك في الغرفة. تحقق من الاتصال والصلاحيات ثم أعد المحاولة.</p></div></div>`;
  });
}

window.exitInvitedPlayer = async function(){
  const invite = activeGuestInvite;
  const button = document.getElementById('guestExitButton');
  if (!invite || !button || button.disabled) return;
  button.disabled = true;
  button.textContent = 'جارٍ الخروج…';
  detachPlayerRoom();
  if (window.closeBuzzerRtcPlayer) closeBuzzerRtcPlayer();
  if (window.cleanupSilentCanvas) cleanupSilentCanvas();
  if (window.stopQataraPlayerWatch) stopQataraPlayerWatch();
  try {
    const playerRef = db.ref(`rooms/${invite.code}/players/${invite.playerId}`);
    await playerRef.onDisconnect().cancel();
    await playerRef.remove();
    localStorage.removeItem(invite.nameKey);
    activeGuestInvite = null;
    CURRENT_PLAYER_NAME = '';
    ACTIVE_PLAYER_ID = null;
    ACTIVE_ROOM_CODE = null;
    lastPlayerRoom = null;
    setGuestExitButton(false);
    renderPlayer(invite.code, invite.gameId);
  } catch (error) {
    console.error('Could not leave the invited game:', error);
    button.disabled = false;
    button.textContent = 'تعذر الخروج — حاول مجددًا';
  }
};

function dispatchPlayerRender(code, myId, name, room, invitedGameId){
  const activityId = invitedGameId || (room.status === 'in_tool' ? room.activeTool : (room.activeGame || room.selectedGame));
  setActivityBackdrop(activityId);
  room = roomForGame(room, activityId);
  lastPlayerRoom = room;
  setGuestExitButton(!!invitedGameId && !!activeGuestInvite);
  if (!(room.status === 'in_tool' && room.activeTool === 'buzzer') && window.closeBuzzerRtcPlayer) closeBuzzerRtcPlayer();
  if (!(room.status === 'in_game' && room.activeGame === 'silentdraw') && window.cleanupSilentCanvas) window.cleanupSilentCanvas();
  if (!(room.status === 'in_game' && room.activeGame === 'qatara') && window.stopQataraPlayerWatch) stopQataraPlayerWatch();
  if (invitedGameId) {
    renderInvitedGame(code, myId, name, room, invitedGameId);
    return;
  }
  if (room.status === 'in_tool' && room.activeTool === 'buzzer') {
    renderBuzzerPlayer(code, myId, name, room);
    return;
  }
  if (room.status === 'in_game' && room.activeGame === 'qatara') {
    renderQataraPlayer(code, myId, name, room);
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
  if ((room.status === 'in_game' || room.status === 'trivia_setup') && room.activeGame === gameId) {
    if (gameId === 'mafia') return renderMafiaPlayer(code, myId, name, room);
    if (gameId === 'silentdraw') return renderSilentDrawPlayer(code, myId, name, room);
    if (gameId === 'trivia') return renderTriviaPlayer(code, myId, name, room);
    if (gameId === 'qatara') return renderQataraPlayer(code, myId, name, room);
  }
  app.innerHTML = `<div class="player-join-screen">${gameDetailHtml(game, room, code, myId, false)}<p class="muted" style="text-align:center;">بانتظار المنظّم لبدء ${escapeHtml(game.title)}.</p></div>`;
}

window.showGameDetail = function(gameId){ playerDetailGameId = gameId; if (lastPlayerRoom) renderPlayerVoting(ACTIVE_ROOM_CODE, ACTIVE_PLAYER_ID, CURRENT_PLAYER_NAME, lastPlayerRoom); };
window.hideGameDetail = function(){ playerDetailGameId = null; if (lastPlayerRoom) renderPlayerVoting(ACTIVE_ROOM_CODE, ACTIVE_PLAYER_ID, CURRENT_PLAYER_NAME, lastPlayerRoom); };

function playerProfileHtml(code, myId, name){
  return `<section class="player-profile-panel" aria-labelledby="player-profile-heading">
    <div class="player-profile-heading"><span class="player-profile-avatar" aria-hidden="true">${escapeHtml(name.charAt(0) || 'ل')}</span><div><span class="host-section-kicker">ملف اللاعب</span><h3 id="player-profile-heading">${escapeHtml(name)}</h3></div></div>
    <form class="player-name-form" onsubmit="event.preventDefault();savePlayerDisplayName('${code}','${myId}')">
      <label for="playerDisplayName">اسم المستخدم</label>
      <div class="player-name-controls"><input id="playerDisplayName" type="text" maxlength="30" minlength="2" value="${escapeHtml(name)}" autocomplete="nickname" required><button class="btn" type="submit">حفظ الاسم</button></div>
      <p class="player-profile-status" id="playerNameStatus" role="status">غيّر الاسم الذي سيظهر للاعبين.</p>
    </form>
  </section>`;
}

window.savePlayerDisplayName = async function(code, playerId){
  const input = document.getElementById('playerDisplayName');
  const submit = input?.form?.querySelector('[type="submit"]');
  const name = input?.value.trim() || '';
  const updateStatus = message => {
    const status = document.getElementById('playerNameStatus');
    if (status) status.textContent = message;
  };
  if (name.length < 2 || name.length > 30) {
    updateStatus('اكتب اسمًا يتراوح بين حرفين و30 حرفًا.');
    return;
  }
  if (submit) submit.disabled = true;
  let roomNameSaved = false;
  const user = firebase.auth().currentUser;
  const isAccountPlayer = user?.uid === playerId;
  try {
    await db.ref(`rooms/${code}/players/${playerId}/name`).set(name);
    roomNameSaved = true;
    if (isAccountPlayer && user.displayName !== name) await user.updateProfile({ displayName:name });
    if (!isAccountPlayer) localStorage.setItem(`guestPlayerName_${code}_${playerInviteGameId || 'default'}`, name);
    CURRENT_PLAYER_NAME = name;
    updateStatus('تم حفظ الاسم. سيظهر للاعبين بهذا الاسم.');
  } catch (error) {
    console.error('Player display name update failed:', error);
    updateStatus(roomNameSaved
      ? isAccountPlayer ? 'حُفظ الاسم في الجلسة، لكن تعذر تحديث ملف Google.' : 'حُفظ الاسم في الجلسة، لكن تعذر تذكره على هذا الجهاز.'
      : 'تعذر حفظ الاسم. تحقق من الاتصال وحاول مرة أخرى.');
  } finally {
    const currentSubmit = document.getElementById('playerDisplayName')?.form?.querySelector('[type="submit"]');
    if (currentSubmit) currentSubmit.disabled = false;
  }
};

function renderPlayerVoting(code, myId, name, room){
  setActivityBackdrop(playerDetailGameId);
  if (playerDetailGameId){
    const game = GAMES_LIST.find(g => g.id === playerDetailGameId);
    app.innerHTML = `<div class="player-join-screen">${playerProfileHtml(code, myId, name)}${gameDetailHtml(game, room, code, myId, false)}</div>`;
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
    ${playerProfileHtml(code, myId, name)}
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
    ${playerProfileHtml(code, myId, name)}
    <div class="detail-icon">${game ? gameIconHtml(game, 'detail-icon-image') : iconImageHtml('assets/icons/answer-buzzer.svg', 'detail-icon-image')}</div>
    <h2 style="font-family:'Cairo';">${escapeHtml(title)}</h2>
    <p class="muted">اللعبة بدأت. المنظّم هو من يعرض اللعبة ويتحكم بها من شاشته؛ تابعوا الشاشة الرئيسية وشاركوا معه.</p>
    ${teamHtml}
    <p class="muted">أهلاً ${escapeHtml(name)}</p>
  </div></div>`;
}

function setVersionFooterVisibility(visible, dashboard = false){
  const footer = document.querySelector('.site-footer');
  if (footer) footer.classList.toggle('is-entry-visible', visible);
  document.body.classList.toggle('has-version-footer', visible);
  document.body.classList.toggle('has-dashboard-footer', visible && dashboard);
}

function landingShowcaseMarkup(id, label, items, type){
  const renderItem = (item, index) => type === 'game'
    ? `<div class="landing-showcase-visual-content"><span class="landing-showcase-index">${String(index + 1).padStart(2,'0')}</span><span class="landing-showcase-icon">${iconImageHtml(item.icon,'landing-showcase-image')}</span><h3>${escapeHtml(item.title)}</h3></div>`
    : `<div class="landing-showcase-visual-content"><span class="landing-showcase-index">${String(index + 1).padStart(2,'0')}</span><span class="landing-showcase-icon">${iconImageHtml(item.icon,'landing-showcase-image')}</span><h3>${escapeHtml(item.title)}</h3><span class="landing-showcase-status ${item.available ? 'is-available' : 'is-upcoming'}">${item.available ? 'متاحة' : 'قيد التطوير'}</span></div>`;
  const indicators = items.map((_, index) => `<button type="button" class="landing-showcase-dot ${index === 0 ? 'is-active' : ''}" data-showcase-index="${index}" aria-label="${label} ${index + 1}" aria-pressed="${index === 0}"></button>`).join('');
  return `<div class="landing-showcase" data-showcase="${id}" data-index="0" data-count="${items.length}" aria-label="${label}" role="region">
    <div class="landing-showcase-panel">
      <div class="landing-showcase-visual" aria-hidden="true">${renderItem(items[0],0)}</div>
      <div class="landing-showcase-copy">
        <span class="landing-showcase-kicker">${type === 'game' ? 'ضمن ألعاب المنصة' : ''}</span>
        <p>${escapeHtml(items[0].desc)}</p>
        <span class="landing-showcase-position">${String(1).padStart(2,'0')} <i>/</i> ${String(items.length).padStart(2,'0')}</span>
      </div>
    </div>
    <div class="landing-showcase-controls">
      <div class="landing-showcase-dots">${indicators}</div>
    </div>
  </div>`;
}

function initLandingCarousels(){
  stopLandingCarousels();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  app.querySelectorAll('.landing-showcase').forEach(root => {
    const type = root.dataset.showcase;
    const items = type === 'games'
      ? GAMES_LIST.filter(game => game.available)
      : [
          { title:'جرس الإجابة', icon:'assets/icons/answer-buzzer.svg', available:true, desc:'جرس رقمي لتحديد أسرع إجابة في ألعاب الأسئلة والتحديات الخارجية.' },
          { title:'لوح رسم مشترك', icon:'assets/icons/signal-sketch.svg', available:false, desc:'أداة للرسم والتخمين لدعم الأنشطة والألعاب الخارجية.' }
        ];
    let paused = false;
    const show = index => {
      const nextIndex = (index + items.length) % items.length;
      const item = items[nextIndex];
      root.dataset.index = String(nextIndex);
      const visual = root.querySelector('.landing-showcase-visual');
      const copy = root.querySelector('.landing-showcase-copy');
      visual.innerHTML = type === 'games'
        ? `<div class="landing-showcase-visual-content"><span class="landing-showcase-index">${String(nextIndex + 1).padStart(2,'0')}</span><span class="landing-showcase-icon">${gameIconHtml(item,'landing-showcase-image')}</span><h3>${escapeHtml(item.title)}</h3></div>`
        : `<div class="landing-showcase-visual-content"><span class="landing-showcase-index">${String(nextIndex + 1).padStart(2,'0')}</span><span class="landing-showcase-icon">${iconImageHtml(item.icon,'landing-showcase-image')}</span><h3>${escapeHtml(item.title)}</h3><span class="landing-showcase-status ${item.available ? 'is-available' : 'is-upcoming'}">${item.available ? 'متاحة' : 'قيد التطوير'}</span></div>`;
      copy.querySelector('.landing-showcase-kicker').textContent = type === 'game' ? 'ضمن ألعاب المنصة' : '';
      copy.querySelector('p').textContent = item.desc;
      copy.querySelector('.landing-showcase-position').innerHTML = `${String(nextIndex + 1).padStart(2,'0')} <i>/</i> ${String(items.length).padStart(2,'0')}`;
      root.querySelectorAll('.landing-showcase-dot').forEach((dot, dotIndex) => {
        const active = dotIndex === nextIndex;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-pressed', String(active));
      });
      if (!reduceMotion) {
        [visual,copy].forEach(element => element.animate(
          [{ opacity:0, transform:'translate3d(0,8px,0)' },{ opacity:1, transform:'translate3d(0,0,0)' }],
          { duration:320, easing:'ease-out' }
        ));
      }
    };
    root.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.hasAttribute('data-showcase-index')) show(Number(button.dataset.showcaseIndex));
    });
    let touchStartX = null;
    root.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch') return;
      touchStartX = event.clientX;
      paused = true;
    });
    root.addEventListener('pointerup', event => {
      if (touchStartX === null) return;
      const distance = event.clientX - touchStartX;
      if (Math.abs(distance) > 45) show(Number(root.dataset.index) + (distance < 0 ? 1 : -1));
      touchStartX = null;
      paused = false;
    });
    root.addEventListener('pointercancel', () => {
      touchStartX = null;
      paused = false;
    });
    root.addEventListener('pointerenter', () => { paused = true; });
    root.addEventListener('pointerleave', () => { paused = false; });
    root.addEventListener('focusin', () => { paused = true; });
    root.addEventListener('focusout', event => {
      if (!root.contains(event.relatedTarget)) paused = false;
    });
    if (!reduceMotion && items.length > 1) {
      landingCarouselTimers.push(setInterval(() => {
        if (!paused && !document.hidden && root.isConnected) show(Number(root.dataset.index) + 1);
      }, 5500));
    }
  });
}

function renderGoogleSignIn(){
  stopLandingCarousels();
  if (typeof detachHostRoom === 'function') detachHostRoom();
  detachPlayerRoom();
  setActivityBackdrop(null);
  setVersionFooterVisibility(true);
  const games = GAMES_LIST.filter(game => game.available);
  const tools = [
    { title:'جرس الإجابة', icon:'assets/icons/answer-buzzer.svg', available:true, desc:'جرس رقمي لتحديد أسرع إجابة في ألعاب الأسئلة والتحديات الخارجية.' },
    { title:'لوح رسم مشترك', icon:'assets/icons/signal-sketch.svg', available:false, desc:'أداة للرسم والتخمين لدعم الأنشطة والألعاب الخارجية.' }
  ];
  app.innerHTML = `
    <div class="landing-page">
      <header class="landing-nav">
        ${platformBrandHtml()}
        <nav class="landing-nav-links" aria-label="التنقل الرئيسي">
          <a href="#landing-games">الألعاب</a>
          <a href="#landing-tools">الأدوات</a>
          <a href="#landing-about">عن لَمّة</a>
        </nav>
        <div class="landing-nav-actions">
          <button class="landing-login" type="button" data-auth-action="login">دخول</button>
          <button class="landing-register" type="button" data-auth-action="register">إنشاء حساب</button>
        </div>
      </header>

      <main>
        <section class="landing-hero">
          <div class="landing-hero-copy">
            <span class="landing-eyebrow"><i></i> ألعاب جماعية وأدوات تفاعلية</span>
            <h1>منصة <span>لَمّة</span></h1>
            <p class="landing-lead">منصة لتنظيم الألعاب الجماعية واستخدام الأدوات المساندة، مع إدارة الجلسات ومشاركة الدعوات بسهولة.</p>
            <div class="landing-hero-actions">
              <button class="landing-primary-cta" type="button" data-auth-action="register">ابدأ الآن <span aria-hidden="true">←</span></button>
            </div>
            <p class="landing-auth-hint">تسجيل الدخول وإنشاء الحساب عبر Google.</p>
            <p class="landing-auth-error" id="authError" role="status" aria-live="polite"></p>
          </div>

          <div class="landing-hero-art" role="img" aria-label="الهوية البصرية لمنصة لَمّة وألعابها">
            <div class="landing-art-orbit landing-art-orbit-one"></div>
            <div class="landing-art-orbit landing-art-orbit-two"></div>
            <div class="landing-art-spark landing-spark-one">✦</div>
            <div class="landing-art-spark landing-spark-two">✧</div>
            <div class="landing-art-center"><span>لَمّة</span><small>ألعاب وأدوات جماعية</small></div>
            <div class="landing-art-chip landing-chip-mafia"><span>01</span><b>ليلة المافيا</b></div>
            <div class="landing-art-chip landing-chip-draw"><span>02</span><b>إشارة ورسمة</b></div>
            <div class="landing-art-chip landing-chip-trivia"><span>03</span><b>تحدي المعرفة</b></div>
            <div class="landing-art-chip landing-chip-qatara"><span>04</span><b>سؤال القَطّارة</b></div>
          </div>
        </section>

        <section class="landing-about" id="landing-about" aria-labelledby="landing-about-title">
          <div class="landing-section-heading">
            <span class="landing-eyebrow">عن لَمّة</span>
            <h2 id="landing-about-title">الألعاب والأدوات في مكان واحد</h2>
            <p>توفر لَمّة جلسات منظمة للألعاب الجماعية، وأدوات تفاعلية يمكن استخدامها مع ألعاب أخرى.</p>
          </div>
          <div class="landing-features">
            <article class="landing-feature">
              <span class="landing-feature-icon">١</span>
              <h3>إدارة الجلسات</h3>
              <p>أنشئ غرفة وشارك رابط الدعوة لتمكين المشاركين من الانضمام من أجهزتهم.</p>
            </article>
            <article class="landing-feature">
              <span class="landing-feature-icon">٢</span>
              <h3>ألعاب جماعية</h3>
              <p>اختر من مجموعة ألعاب مصممة للمشاركة الفردية أو التنافس بين الفرق.</p>
            </article>
            <article class="landing-feature">
              <span class="landing-feature-icon">٣</span>
              <h3>أدوات مساندة</h3>
              <p>استخدم أدوات المنصة لدعم الألعاب الخارجية، مع إمكانية إضافة أدوات جديدة مستقبلًا.</p>
            </article>
          </div>
        </section>

        <section class="landing-games" id="landing-games" aria-labelledby="landing-games-title">
          <div class="landing-section-heading landing-games-heading">
            <div class="landing-games-title-group"><span class="landing-eyebrow">المحتوى</span><h2 id="landing-games-title">الألعاب المتاحة</h2></div>
            <span class="landing-games-note">ألعاب جماعية ضمن المنصة</span>
          </div>
          ${landingShowcaseMarkup('games','استعراض الألعاب',games,'game')}
        </section>

        <section class="landing-tools" id="landing-tools" aria-labelledby="landing-tools-title">
          <div class="landing-section-heading landing-tools-heading">
            <span class="landing-eyebrow">أدوات المنصة</span>
            <h2 id="landing-tools-title">أدوات للألعاب الخارجية</h2>
            <p>أدوات تفاعلية تدعم الألعاب التي تُمارس خارج المنصة، ويجري تطوير المزيد منها.</p>
          </div>
          ${landingShowcaseMarkup('tools','استعراض الأدوات',tools,'tool')}
        </section>

      </main>

      <footer class="landing-footer">
        <span>صنع بواسطة kkhalid07</span>
        <button class="landing-admin-link" id="adminGuestBtn" type="button">دخول المشرف</button>
      </footer>
    </div>`;
  initLandingCarousels();
  const signIn = async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await firebase.auth().signInWithPopup(provider);
    }
    catch (error) {
      if (error.code === 'auth/popup-blocked') { try { await firebase.auth().signInWithRedirect(provider); return; } catch (_) {} }
      const messages = {
        'auth/operation-not-allowed': 'تسجيل الدخول عبر Google غير مفعّل في Firebase. فعّله من Authentication ← Sign-in method ← Google.',
        'auth/unauthorized-domain': 'نطاق الموقع الحالي غير مسموح في Firebase. أضفه في Authentication ← Settings ← Authorized domains.',
        'auth/popup-blocked': 'المتصفح حجب نافذة Google. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.',
        'auth/popup-closed-by-user': 'أُغلقت نافذة تسجيل الدخول قبل إكمال العملية.'
      };
      console.error('Google sign-in failed:', error.code, error);
      const authError = document.getElementById('authError');
      if (authError) authError.textContent = messages[error.code] || `تعذر تسجيل الدخول (${error.code || 'خطأ غير معروف'}).`;
    }
  };
  app.querySelectorAll('[data-auth-action]').forEach(button => { button.onclick = signIn; });
  document.getElementById('adminGuestBtn').onclick = renderAdminNameEntry;
}

function renderAdminNameEntry(){
  stopLandingCarousels();
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
  const params = new URLSearchParams(location.search);
  const sessionParam = params.get('session');
  const gameParam = params.get('game');
  if (sessionParam && gameParam) renderPlayer(sessionParam.trim(), gameParam.trim());
  else if (!user) { if (localStorage.getItem('adminGuestName')) renderHost(); else renderGoogleSignIn(); }
  else renderHost();
});
