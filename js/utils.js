/* =====================================================================
   SECTION 3 — SHARED UTILITIES
   ===================================================================== */
function shuffle(a){ const r=[...a]; for(let i=r.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [r[i],r[j]]=[r[j],r[i]]; } return r; }
function makeRoomCode(){ return String(Math.floor(1000 + Math.random()*9000)); }
function joinGameUrl(code, gameId){ return location.origin + location.pathname + '?session=' + encodeURIComponent(code) + '&game=' + encodeURIComponent(gameId); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function iconImageHtml(src, className='game-icon-image'){
  return `<img class="${className}" src="${escapeHtml(src)}" alt="" aria-hidden="true" loading="lazy" decoding="async" />`;
}
function gameIconHtml(game, className='game-icon-image'){
  return iconImageHtml(game.icon, className);
}
function transitionAppView(update){
  const appRoot = document.getElementById('app');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!appRoot || reduceMotion) {
    update();
    return;
  }
  if (typeof document.startViewTransition === 'function') {
    appRoot.style.viewTransitionName = 'platform-page';
    document.startViewTransition(update);
    return;
  }
  update();
  const nextView = appRoot.querySelector('.host-shell, .phone, .landing-page') || appRoot.firstElementChild;
  if (nextView?.animate) {
    nextView.animate(
      [{opacity:0, transform:'translate3d(0,12px,0) scale(.99)'},{opacity:1, transform:'translate3d(0,0,0) scale(1)'}],
      {duration:160, easing:'cubic-bezier(.2,.75,.25,1)'}
    );
  }
}
function platformBrandHtml(className=''){
  return `<a class="landing-brand ${className}" href="#" aria-label="لَمّة — الصفحة الرئيسية">
      <span class="landing-brand-name">لَمّة</span>
  </a>`;
}
function pickRandomWordPair(){ return shuffle(WORD_BANK)[0]; }

const PLATFORM_FONT_STORAGE_KEY = 'gamePlatformFont';
function getPlatformFont(){
  try {
    return localStorage.getItem(PLATFORM_FONT_STORAGE_KEY) === 'thmanyah' ? 'thmanyah' : 'ibm-plex';
  } catch (error) {
    console.error('Could not read platform font preference:', error);
    return 'ibm-plex';
  }
}
function applyPlatformFontPreference(){
  document.body.dataset.platformFont = getPlatformFont();
}
window.setPlatformFont = function(font){
  if (font !== 'ibm-plex' && font !== 'thmanyah') return;
  document.body.dataset.platformFont = font;
  const status = document.getElementById('platformFontStatus');
  try {
    localStorage.setItem(PLATFORM_FONT_STORAGE_KEY, font);
    if (status) status.textContent = 'تم حفظ تفضيل الخط على هذا الجهاز.';
  } catch (error) {
    console.error('Could not save platform font preference:', error);
    if (status) status.textContent = 'طُبق الخط لهذه الجلسة، لكن تعذر حفظه على هذا الجهاز.';
  }
};
applyPlatformFontPreference();

function renderIllustration(wordText){
  const found = WORD_BANK.find(x => x.w === wordText);
  if (found && found.img) {
    return `<img src="${found.img}" class="illustration-img" alt="${escapeHtml(wordText)}" onerror="const d=document.createElement('div');d.className='illustration-fallback';d.textContent=this.alt;this.replaceWith(d)" />`;
  }
  return `<div class="illustration-fallback">${escapeHtml(found ? found.e : wordText)}</div>`;
}

function normalizeAr(s){
  return String(s).trim().toLowerCase()
    .replace(/[\u064B-\u065F\u0610-\u061A\u06D6-\u06ED]/g,'')
    .replace(/[إأآا]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي')
    .replace(/\s+/g,'');
}
function drawSegment(ctx, canvas, s){
  if (!s || !Array.isArray(s.points) || !s.points.length) return;
  const points = s.points.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!points.length) return;
  const lineWidth = Math.max(1, Number(s.size) || 5);
  ctx.strokeStyle = s.color || '#000000';
  ctx.fillStyle = s.color || '#000000';
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x * canvas.width, points[0].y * canvas.height, lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  points.forEach((p,i) => {
    const x = p.x * canvas.width, y = p.y * canvas.height;
    if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();
}
function isSilentDrawStrokesOnlyChange(previousRoom, nextRoom){
  if (!previousRoom || previousRoom.status !== 'in_game' || previousRoom.activeGame !== 'silentdraw' ||
      nextRoom?.status !== 'in_game' || nextRoom.activeGame !== 'silentdraw') return false;
  const {strokes:previousStrokes, ...previousRoomData} = previousRoom;
  const {strokes:nextStrokes, ...nextRoomData} = nextRoom;
  if (JSON.stringify(previousStrokes || null) === JSON.stringify(nextStrokes || null)) return false;
  return JSON.stringify(previousRoomData) === JSON.stringify(nextRoomData);
}
function isDrawBoardLiveChangeOnly(previousRoom,nextRoom){
  if(!previousRoom||previousRoom.status!=='in_tool'||previousRoom.activeTool!=='drawboard'||
     nextRoom?.status!=='in_tool'||nextRoom.activeTool!=='drawboard')return false;
  const {drawingBoards:previousBoards,...previousRoomData}=previousRoom;
  const {drawingBoards:nextBoards,...nextRoomData}=nextRoom;
  if(JSON.stringify(previousRoomData)!==JSON.stringify(nextRoomData))return false;
  const stripLiveData=boards=>Object.fromEntries(Object.entries(boards||{}).map(([id,board])=>{
    const {strokes,cursor,organizerCursor,...metadata}=board||{};
    return [id,metadata];
  }).filter(([,metadata])=>Object.keys(metadata).length));
  const previousMetadata=stripLiveData(previousBoards);
  const nextMetadata=stripLiveData(nextBoards);
  return JSON.stringify(previousMetadata)===JSON.stringify(nextMetadata)&&
    JSON.stringify(previousBoards||null)!==JSON.stringify(nextBoards||null);
}
function isDrawBoardRosterOnlyChange(previousRoom,nextRoom){
  if(!previousRoom||previousRoom.status!=='in_tool'||previousRoom.activeTool!=='drawboard'||
     nextRoom?.status!=='in_tool'||nextRoom.activeTool!=='drawboard')return false;
  const {players:previousPlayers,...previousData}=previousRoom;
  const {players:nextPlayers,...nextData}=nextRoom;
  return JSON.stringify(previousData)===JSON.stringify(nextData)&&
    JSON.stringify(previousPlayers||{})!==JSON.stringify(nextPlayers||{});
}
function isTeamNamesOnlyChange(previousRoom, nextRoom){
  if (!previousRoom || previousRoom.status !== 'voting' || nextRoom?.status !== 'voting') return false;
  const {teamNames:previousNames, ...previousRoomData} = previousRoom;
  const {teamNames:nextNames, ...nextRoomData} = nextRoom;
  if (JSON.stringify(previousNames || null) === JSON.stringify(nextNames || null)) return false;
  return JSON.stringify(previousRoomData) === JSON.stringify(nextRoomData);
}
function isPlayerTeamOnlyChange(previousRoom, nextRoom){
  if (!previousRoom || !nextRoom) return false;
  const {players:previousPlayers, ...previousRoomData} = previousRoom;
  const {players:nextPlayers, ...nextRoomData} = nextRoom;
  if (JSON.stringify(previousRoomData) !== JSON.stringify(nextRoomData)) return false;
  const previousEntries = Object.entries(previousPlayers || {});
  const nextEntries = Object.entries(nextPlayers || {});
  if (previousEntries.length !== nextEntries.length) return false;
  let teamChanged = false;
  for (const [id, previousPlayer] of previousEntries) {
    const nextPlayer = nextPlayers?.[id];
    if (!nextPlayer) return false;
    const {team:previousTeam, ...previousPlayerData} = previousPlayer;
    const {team:nextTeam, ...nextPlayerData} = nextPlayer;
    if (JSON.stringify(previousPlayerData) !== JSON.stringify(nextPlayerData)) return false;
    if (previousTeam !== nextTeam) teamChanged = true;
  }
  return teamChanged;
}
const mirrorRefs = {};
function stopMirrorCanvases(){
  Object.values(mirrorRefs).forEach(({ref,handler}) => ref.off('value',handler));
  Object.keys(mirrorRefs).forEach(k => delete mirrorRefs[k]);
}
function stopHostTimerWatch(){ if (hostTimerInterval){ clearInterval(hostTimerInterval); hostTimerInterval = null; } }
function mirrorCanvasFrom(strokeKey, canvasId){
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const existing = mirrorRefs[canvasId];
  if (existing?.canvas === canvas) return;
  if (existing) existing.ref.off('value',existing.handler);
  const sRef = db.ref(strokeKey);
  const handler = snap => {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    Object.values(snap.val() || {}).forEach(stroke => drawSegment(ctx, canvas, stroke));
  };
  const cancel = error => {
    console.error(`Unable to mirror strokes for ${canvasId}:`,error);
    const status = document.getElementById(`${canvasId}Status`);
    if (status) status.textContent = `تعذر تحميل الرسم المباشر (${error.code || 'خطأ اتصال'}).`;
  };
  mirrorRefs[canvasId] = {ref:sRef,handler,canvas};
  sRef.on('value',handler,cancel);
}
let hostTimerInterval = null;
function startHostTimerWatch(timerEnd){
  if (hostTimerInterval) clearInterval(hostTimerInterval);
  hostTimerInterval = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((timerEnd - Date.now())/1000));
    const el = document.getElementById('timerText');
    if (el) el.textContent = remaining;
  }, 500);
}
let currentColor = '#000000';
window.setDrawColor = function(c){ currentColor = c; };

// تغيير الفريق
window.setPlayerTeam = function(code, myId, team){
  if (team !== 'A' && team !== 'B') return;
  const playersRef = db.ref(`rooms/${code}/players`);
  playersRef.transaction(players => {
    if (!players || !players[myId]) return;
    const currentTeam = players[myId].team;
    if (currentTeam === team) {
      delete players[myId].team;
      return players;
    }
    const teamSize = Object.entries(players).filter(([id, player]) => id !== myId && player.team === team).length;
    if (teamSize >= 2) return;
    players[myId].team = team;
    return players;
  }).then(result => {
    if (!result.committed) {
      alert('اكتمل هذا الفريق. اختر الفريق الآخر أو انتظر توفر مقعد.');
    }
  }).catch(error => {
    console.error('Could not update player team:', error);
    alert('تعذر تغيير الفريق. تحقق من الاتصال وحاول مرة أخرى.');
  });
};

let teamNamesSaveTimer = null;
const DEFAULT_TEAM_NAMES = {A:'الفريق الأخضر',B:'الفريق البرتقالي'};
function updateTeamNameDisplays(names){
  for (const team of ['A','B']) {
    const name = names?.[team];
    if (typeof name !== 'string') continue;
    const displayName = name || DEFAULT_TEAM_NAMES[team];
    document.querySelectorAll(`[data-team-name="${team}"]`).forEach(display => {
      display.textContent = displayName;
    });
    const input = document.getElementById(`teamName${team}`);
    if (input && document.activeElement !== input && input.value !== name) input.value = name;
  }
}
window.queueTeamNamesSave = function(code, immediate=false){
  if (teamNamesSaveTimer) clearTimeout(teamNamesSaveTimer);
  const status = document.getElementById('teamNamesStatus');
  const nameA = document.getElementById('teamNameA')?.value.trim() || '';
  const nameB = document.getElementById('teamNameB')?.value.trim() || '';
  updateTeamNameDisplays({A:nameA,B:nameB});
  if (nameA.length > 24 || nameB.length > 24) {
    if (status) status.textContent = 'استخدم 24 حرفًا كحد أقصى لكل اسم.';
    return;
  }
  const names = {A:nameA,B:nameB};
  if (immediate) {
    teamNamesSaveTimer = null;
    window.saveTeamNames(code,names);
    return;
  }
  if (status) status.textContent = 'سيُحفظ التعديل تلقائيًا…';
  teamNamesSaveTimer = setTimeout(() => {
    teamNamesSaveTimer = null;
    window.saveTeamNames(code,names);
  }, 500);
};

window.saveTeamNames = async function(code, names=null){
  const nameA = names?.A ?? document.getElementById('teamNameA')?.value.trim() ?? '';
  const nameB = names?.B ?? document.getElementById('teamNameB')?.value.trim() ?? '';
  const status = document.getElementById('teamNamesStatus');
  if (nameA.length > 24 || nameB.length > 24) {
    if (status) status.textContent = 'استخدم 24 حرفًا كحد أقصى لكل اسم.';
    return;
  }
  const savedNames = {
    A:nameA || DEFAULT_TEAM_NAMES.A,
    B:nameB || DEFAULT_TEAM_NAMES.B
  };
  try {
    await db.ref(`rooms/${code}/teamNames`).set(savedNames);
    if (status) status.textContent = 'تم الحفظ تلقائيًا.';
  } catch (error) {
    console.error('Could not save team names:', error);
    if (status) status.textContent = 'تعذر حفظ الأسماء. تحقق من الاتصال وحاول مرة أخرى.';
  }
};
window.toggleTeamNameEdit = function(team){
  if (team !== 'A' && team !== 'B') return;
  const input = document.getElementById(`teamName${team}`);
  const button = document.querySelector(`[data-team-name-toggle="${team}"]`);
  if (!input || !button) return;
  const isEditing = !input.closest('.team-name-field').hidden;
  if (isEditing) {
    input.blur();
    input.closest('.team-name-field').hidden = true;
    button.textContent = 'تعديل';
    button.setAttribute('aria-label', `تعديل اسم الفريق ${team}`);
    return;
  }
  input.closest('.team-name-field').hidden = false;
  button.textContent = 'تم';
  button.setAttribute('aria-label', `إنهاء تعديل اسم الفريق ${team}`);
  input.focus();
  input.select();
};

/* =====================================================================
   SECTION 4 — GAME DETAIL / READY PANEL
   ===================================================================== */
function teamSelectorHtml(game, room, code, myId, isHost){
  if (!game.needsTeams) return '';
  const players = room.players || {};
  const teamNames = {
    A:room.teamNames?.A || 'الفريق الأخضر',
    B:room.teamNames?.B || 'الفريق البرتقالي'
  };
  const teamMemberHtml = player => {
    const name = player.name || 'لاعب';
    const initial = escapeHtml(name.trim().charAt(0) || 'ل');
    return `<span class="team-member">
      <span class="team-member-avatar" aria-hidden="true">${player.photoURL ? `<img src="${escapeHtml(player.photoURL)}" alt="">` : initial}</span>
      <span class="team-member-name">${escapeHtml(name)}</span>
    </span>`;
  };
  const teamCardHtml = (team, isHost) => {
    const members = Object.entries(players).filter(([,player]) => player.team === team).slice(0,2);
    const availableSeats = Array.from({length:2}, (_,index) => {
      const member = members[index];
      if (!member) return `<span class="team-seat team-seat-empty" aria-hidden="true"><span>+</span></span>`;
      return `<span class="team-seat">${teamMemberHtml(member[1])}</span>`;
    }).join('');
    const contents = `<div class="team-name-display"><span class="team-card-title" data-team-name="${team}">${escapeHtml(teamNames[team])}</span>
        ${isHost ? `<button type="button" class="team-name-edit" data-team-name-toggle="${team}" aria-label="تعديل اسم الفريق ${team}" onclick="toggleTeamNameEdit('${team}')">تعديل</button>` : ''}
      </div>
      ${isHost
        ? `<label class="team-name-field" hidden><input id="teamName${team}" type="text" maxlength="24" value="${escapeHtml(teamNames[team])}" aria-label="اسم الفريق ${team}" oninput="queueTeamNamesSave('${code}')" onblur="queueTeamNamesSave('${code}',true)"></label>`
        : `<span class="team-card-count">${members.length} / 2 لاعبين</span>`}
      <span class="team-seats">${availableSeats}</span>`;
    if (isHost) {
      return `<section class="team-option team-option-${team.toLowerCase()} team-card team-card-readonly">${contents}</section>`;
    }
    const selected = players[myId]?.team === team;
    const full = members.length === 2 && !selected;
    return `<button type="button" class="team-option team-option-${team.toLowerCase()} team-card ${selected ? 'is-selected' : ''}" aria-pressed="${selected}" ${full ? 'disabled' : ''} onclick="setPlayerTeam('${code}','${myId}','${team}')">
      ${contents}<span class="team-card-action">${selected ? 'فريقك' : full ? 'مكتمل' : 'انضم للفريق'}</span>
    </button>`;
  };
  if (isHost) {
    return `
      <div class="team-selector-box team-picker">
        <div class="team-picker-heading"><div><h3>الفرق</h3></div></div>
        <div class="team-options team-options-readonly">${['A','B'].map(team => teamCardHtml(team,true)).join('')}</div>
        <div class="team-name-save"><span id="teamNamesStatus" class="team-picker-note" role="status"></span></div>
      </div>`;
  }
  return `
    <div class="team-selector-box team-picker">
      <div class="team-picker-heading"><div><h3>اختر فريقك</h3></div></div>
      <div class="team-options">${['A','B'].map(team => teamCardHtml(team,false)).join('')}</div>
    </div>`;
}

function gameDetailHtml(game, room, code, myId, isHost, inviteHtml=''){
  const players = roomPlayersForGame(room, game.id);
  const totalPlayers = Object.keys(players).length;
  const playerCards = Object.values(players).map(player => playerAvatarCardHtml(player)).join('');
  const triviaGame = game.id === 'trivia';
  const hostControlledTrivia = isHost && triviaGame;
  const xoGame = game.id === 'xo';
  const hostControlledXo = isHost && xoGame;
  const hostXoModes = xoGame && isHost
    ? `<div class="xo-mode-picker" aria-label="اختر طريقة اللعب">
        <button type="button" class="btn" onclick="startXoGame('${code}','local')">اللعب على جهازي</button>
        <button type="button" class="btn" onclick="startXoGame('${code}','network')">اللعب عن طريق الشبكة</button>
        <button type="button" class="btn" onclick="startXoGame('${code}','computer')">اللعب مع الكمبيوتر</button>
      </div>`
    : '';

  return `
    <div class="game-detail-shell" data-activity="${escapeHtml(game.id)}">
      <div class="game-detail">
      ${isHost ? '<button class="btn btn-ghost back-btn" onclick="hideHostGameDetail()">→ رجوع</button>' : ''}
      <div class="detail-icon">${gameIconHtml(game, 'detail-icon-image')}</div>
      <h2 style="font-family:'Cairo'; text-align:center;">${game.title}</h2>
      <p class="narrator">${game.desc}</p>
      <ol class="rules-list">${game.rules.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ol>
      ${triviaGame || xoGame ? '' : `<p class="muted">الحد الأدنى للاعبين: ${game.minPlayers}</p>`}
      ${xoGame ? '' : inviteHtml}
      ${triviaGame ? '' : teamSelectorHtml(game, room, code, myId, isHost)}
      ${hostControlledTrivia || hostControlledXo ? '' : isHost ? `<div class="players-box lobby-players-box"><h3>اللاعبون (${totalPlayers})</h3><div class="lobby-player-grid">${playerCards || '<span class="muted">بانتظار اللاعبين</span>'}</div></div>` : `<p class="muted" style="text-align:center;">عند بدء اللعبة، يعرضها المنظّم ويتحكم بها من شاشته.</p>`}
      <div style="text-align:center; margin-top:10px;">
        ${isHost && !xoGame
          ? `<button class="btn" ${!hostControlledTrivia && totalPlayers < game.minPlayers ? 'disabled' : ''} onclick="startGame('${game.id}','${code}')">${hostControlledTrivia ? 'إعداد الفريقين' : 'ابدأ اللعبة'}</button>`
          : ''}
      </div>
      ${hostXoModes}
      </div>
    </div>
  `;
}

function playerAvatarCardHtml(player, extraHtml=''){
  const name = player.name || 'لاعب';
  const initial = escapeHtml(name.trim().charAt(0) || 'ل');
  const avatar = player.photoURL
    ? `<img src="${escapeHtml(player.photoURL)}" alt="" loading="lazy" onerror="this.hidden=true"><span>${initial}</span>`
    : `<span>${initial}</span>`;
  return `<div class="lobby-player-card" title="${escapeHtml(name)}"><span class="lobby-player-avatar">${avatar}</span><strong>${escapeHtml(name)}</strong>${extraHtml}</div>`;
}

function roomPlayersForGame(room, gameId){
  if (!gameId) return room.players || {};
  return Object.fromEntries(Object.entries(room.players || {}).filter(([, player]) =>
    !player.guest || player.gameId === gameId
  ));
}

function roomForGame(room, gameId){
  return gameId ? {...room, players:roomPlayersForGame(room, gameId)} : room;
}

function setActivityBackdrop(activityId){
  const appRoot = document.getElementById('app');
  if (!appRoot) return;
  if (['mafia','silentdraw','trivia','qatara','buzzer','drawboard'].includes(activityId)) {
    appRoot.dataset.activity = activityId;
  } else {
    delete appRoot.dataset.activity;
  }
}

function winnerCelebrationHtml(){
  return `<div class="winner-celebration" aria-hidden="true"><span class="winner-trophy">${iconImageHtml('assets/icons/knowledge-challenge.svg','winner-trophy-sticker')}</span><i>✦</i><i>✧</i><i>✦</i><i>✧</i></div>`;
}
window.toggleReady = function(code, myId, gameId){
  const ref = db.ref('rooms/'+code+'/votes/'+myId);
  ref.once('value', snap => { snap.val() === gameId ? ref.remove() : ref.set(gameId); });
};

/* =====================================================================
   بطاقة دعوة اللاعبين: رمز QR + زر نسخ الرابط (+ مشاركة على الجوال)
   ===================================================================== */
function joinCardHtml(id, url){
  const share = navigator.share ? `<button type="button" class="btn btn-ghost" data-share>مشاركة</button>` : '';
  return `<section class="invite-card" id="${id}">
    <div class="invite-qr" id="${id}Qr" role="img" aria-label="رمز QR للانضمام"></div>
    <div class="invite-body">
      <h2>دعوة اللاعبين</h2>
      <p>امسح الرمز بالجوال، أو انسخ الرابط وأرسله في مجموعتكم.</p>
      <div class="invite-link" dir="ltr" title="${escapeHtml(url)}">${escapeHtml(url)}</div>
      <div class="invite-actions"><button type="button" class="btn" data-copy>نسخ الرابط</button>${share}</div>
    </div>
  </section>`;
}
async function copyText(text){
  try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
  const t = document.createElement('textarea');
  t.value = text; t.setAttribute('readonly',''); t.style.cssText = 'position:fixed;top:0;opacity:0';
  document.body.appendChild(t); t.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
  t.remove(); return ok;
}
function initJoinCard(id, url){
  const root = document.getElementById(id); if (!root) return;
  const qr = document.getElementById(id + 'Qr');
  if (qr && !qr.firstChild && window.QRCode) new QRCode(qr, { text:url, width:132, height:132, correctLevel:QRCode.CorrectLevel.M });
  const copy = root.querySelector('[data-copy]');
  copy.onclick = async () => {
    const ok = await copyText(url);
    copy.textContent = ok ? 'تم نسخ الرابط ✓' : 'تعذّر النسخ، انسخه يدويًا';
    copy.classList.toggle('is-done', ok);
    clearTimeout(copy._t);
    copy._t = setTimeout(() => { copy.textContent = 'نسخ الرابط'; copy.classList.remove('is-done'); }, 2200);
  };
  const share = root.querySelector('[data-share]');
  if (share) share.onclick = () => navigator.share({ title:'انضم إلى اللعبة', url }).catch(() => {});
}
