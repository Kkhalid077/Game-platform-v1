/* =====================================================================
   SECTION 3 — SHARED UTILITIES
   ===================================================================== */
function shuffle(a){ const r=[...a]; for(let i=r.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [r[i],r[j]]=[r[j],r[i]]; } return r; }
function makeRoomCode(){ return String(Math.floor(1000 + Math.random()*9000)); }
function joinGameUrl(code, gameId){ return location.origin + location.pathname + '?session=' + encodeURIComponent(code) + '&game=' + encodeURIComponent(gameId); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function iconImageHtml(src, className='game-icon-image'){
  return `<img class="${className}" src="${escapeHtml(src)}" alt="" aria-hidden="true" />`;
}
function gameIconHtml(game, className='game-icon-image'){
  return iconImageHtml(game.icon, className);
}
function pickRandomWordPair(){ return shuffle(WORD_BANK)[0]; }

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
const mirrorRefs = {};
function stopMirrorCanvases(){ Object.values(mirrorRefs).forEach(r => r.off('value')); Object.keys(mirrorRefs).forEach(k => delete mirrorRefs[k]); }
function stopHostTimerWatch(){ if (hostTimerInterval){ clearInterval(hostTimerInterval); hostTimerInterval = null; } }
function mirrorCanvasFrom(strokeKey, canvasId){
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const sRef = db.ref('strokes/'+strokeKey);
  sRef.off('value');
  mirrorRefs[canvasId] = sRef;
  sRef.on('value', snap => {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    Object.values(snap.val() || {}).forEach(stroke => drawSegment(ctx, canvas, stroke));
  });
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

window.saveTeamNames = async function(code){
  const nameA = document.getElementById('teamNameA')?.value.trim();
  const nameB = document.getElementById('teamNameB')?.value.trim();
  const status = document.getElementById('teamNamesStatus');
  const button = document.getElementById('saveTeamNamesButton');
  if (!nameA || !nameB || nameA.length > 24 || nameB.length > 24) {
    if (status) status.textContent = 'اكتب اسمًا لكل فريق (24 حرفًا كحد أقصى).';
    return;
  }
  if (button) button.disabled = true;
  try {
    await db.ref(`rooms/${code}/teamNames`).set({A:nameA, B:nameB});
    if (status) status.textContent = 'تم حفظ اسمي الفريقين.';
  } catch (error) {
    console.error('Could not save team names:', error);
    if (status) status.textContent = 'تعذر حفظ الأسماء. تحقق من الاتصال وحاول مرة أخرى.';
  } finally {
    const currentButton = document.getElementById('saveTeamNamesButton');
    if (currentButton) currentButton.disabled = false;
  }
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
  const teamMemberHtml = (player, id, currentPlayerId = null) => {
    const name = player.name || 'لاعب';
    const initial = escapeHtml(name.trim().charAt(0) || 'ل');
    const isCurrentPlayer = id === currentPlayerId;
    return `<span class="team-member ${isCurrentPlayer ? 'is-you' : ''}">
      <span class="team-member-avatar" aria-hidden="true">${player.photoURL ? `<img src="${escapeHtml(player.photoURL)}" alt="">` : initial}</span>
      <span class="team-member-name">${escapeHtml(name)}${isCurrentPlayer ? ' · أنت' : ''}</span>
    </span>`;
  };
  const teamCardHtml = (team, isHost) => {
    const members = Object.entries(players).filter(([,player]) => player.team === team).slice(0,2);
    const availableSeats = Array.from({length:2}, (_,index) => {
      const member = members[index];
      if (!member) return `<span class="team-seat team-seat-empty" aria-hidden="true"><span>+</span></span>`;
      return `<span class="team-seat">${teamMemberHtml(member[1], member[0], myId)}</span>`;
    }).join('');
    const contents = `<span class="team-card-title">${escapeHtml(teamNames[team])}</span>
      ${isHost
        ? `<label class="team-name-field"><span>اسم الفريق</span><input id="teamName${team}" type="text" maxlength="24" value="${escapeHtml(teamNames[team])}" aria-label="اسم الفريق ${team}"></label>`
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
        <div class="team-picker-heading"><div><span class="host-section-kicker">توزيع اللاعبين</span><h3>الفرق</h3></div><span class="team-picker-note">مقعدان لكل فريق</span></div>
        <div class="team-options team-options-readonly">${['A','B'].map(team => teamCardHtml(team,true)).join('')}</div>
        <div class="team-name-save"><button class="btn btn-ghost" id="saveTeamNamesButton" type="button" onclick="saveTeamNames('${code}')">حفظ أسماء الفرق</button><span id="teamNamesStatus" class="team-picker-note" role="status">يمكنك تعديل الاسم الظاهر فوق كل فريق.</span></div>
      </div>`;
  }
  const myTeam = players[myId]?.team || null;
  return `
    <div class="team-selector-box team-picker">
      <div class="team-picker-heading"><div><span class="host-section-kicker">انضم إلى مجموعتك</span><h3>اختر فريقك</h3></div><span class="team-picker-note">${myTeam ? `أنت في ${escapeHtml(teamNames[myTeam])}` : 'مقعدان متاحان لكل فريق'}</span></div>
      <div class="team-options">${['A','B'].map(team => teamCardHtml(team,false)).join('')}</div>
      <p class="team-picker-note">${myTeam ? 'اضغط على فريقك لمغادرته، أو اختر الفريق الآخر للتبديل.' : 'اختر أحد الفريقين للانضمام؛ لكل فريق مقعدان.'}</p>
    </div>`;
}

function gameDetailHtml(game, room, code, myId, isHost, inviteHtml=''){
  const players = room.players || {};
  const totalPlayers = Object.keys(players).length;
  const playerCards = Object.entries(players).map(([id, player]) => {
    const name = player.name || 'لاعب';
    const initial = escapeHtml(name.trim().charAt(0) || 'ل');
    const avatar = player.photoURL
      ? `<img src="${escapeHtml(player.photoURL)}" alt="" loading="lazy" onerror="this.hidden=true"><span>${initial}</span>`
      : `<span>${initial}</span>`;
    return `<div class="lobby-player-card" title="${escapeHtml(name)}"><span class="lobby-player-avatar">${avatar}</span><strong>${escapeHtml(name)}</strong></div>`;
  }).join('');

  return `
    <div class="game-detail">
      ${isHost ? '<button class="btn btn-ghost back-btn" onclick="hideHostGameDetail()">→ رجوع</button>' : ''}
      <div class="detail-icon">${gameIconHtml(game, 'detail-icon-image')}</div>
      <h2 style="font-family:'Cairo'; text-align:center;">${game.title}</h2>
      <p class="narrator">${game.desc}</p>
      <ol class="rules-list">${game.rules.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ol>
      <p class="muted">الحد الأدنى للاعبين: ${game.minPlayers}</p>
      ${inviteHtml}
      ${teamSelectorHtml(game, room, code, myId, isHost)}
      ${isHost ? `<div class="players-box lobby-players-box"><h3>اللاعبون (${totalPlayers})</h3><div class="lobby-player-grid">${playerCards || '<span class="muted">بانتظار اللاعبين</span>'}</div></div>` : `<p class="muted" style="text-align:center;">عند بدء اللعبة، يعرضها المنظّم ويتحكم بها من شاشته.</p>`}
      <div style="text-align:center; margin-top:10px;">
        ${isHost
          ? `<button class="btn" ${totalPlayers < game.minPlayers ? 'disabled' : ''} onclick="startGame('${game.id}','${code}')">ابدأ اللعبة</button>`
          : ''}
      </div>
    </div>
  `;
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
