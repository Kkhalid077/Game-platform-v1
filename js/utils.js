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
  const teamRef = db.ref(`rooms/${code}/players/${myId}/team`);
  teamRef.transaction(current => current === team ? null : team)
    .catch(error => console.error('Could not update player team:', error));
};

/* =====================================================================
   SECTION 4 — GAME DETAIL / READY PANEL
   ===================================================================== */
function teamSelectorHtml(game, room, code, myId, isHost){
  if (!game.needsTeams) return '';
  const players = room.players || {};
  const teamMemberHtml = (player, id, currentPlayerId = null) => {
    const name = player.name || 'لاعب';
    const initial = escapeHtml(name.trim().charAt(0) || 'ل');
    const isCurrentPlayer = id === currentPlayerId;
    return `<span class="team-member ${isCurrentPlayer ? 'is-you' : ''}">
      <span class="team-member-avatar" aria-hidden="true">${initial}</span>
      <span class="team-member-name">${escapeHtml(name)}${isCurrentPlayer ? ' · أنت' : ''}</span>
    </span>`;
  };
  if (isHost) {
    const teamRoster = team => Object.values(players).filter(p=>p.team===team);
    return `
      <div class="team-selector-box team-picker">
        <div class="team-picker-heading"><div><span class="host-section-kicker">توزيع اللاعبين</span><h3>الفرق</h3></div><span class="team-picker-note">يمكن للاعبين تغيير فرقهم قبل البدء</span></div>
        <div class="team-options team-options-readonly">
          ${['A','B'].map(team => {
            const roster = teamRoster(team);
            return `<section class="team-option team-option-${team.toLowerCase()}">
              <div class="team-option-header"><span class="team-option-indicator"></span><div><strong>الفريق ${team}</strong><small>${roster.length} ${roster.length === 1 ? 'لاعب' : 'لاعبين'}</small></div></div>
              <div class="team-roster">${roster.map(player => teamMemberHtml(player)).join('') || '<span class="team-empty">بانتظار الانضمام</span>'}</div>
            </section>`;
          }).join('')}
        </div>
        <p class="team-picker-note">اللاعبون الذين لم يختاروا فريقًا سيُوزَّعون تلقائيًا عند بدء اللعبة.</p>
      </div>`;
  }
  const myTeam = players[myId]?.team || null;
  const roster = team => Object.entries(players).filter(([, player]) => player.team === team);
  return `
    <div class="team-selector-box team-picker">
      <div class="team-picker-heading"><div><span class="host-section-kicker">انضم إلى مجموعتك</span><h3>اختر فريقك</h3></div><span class="team-picker-note">${myTeam ? `أنت في الفريق ${myTeam}` : 'اختيارك اختياري ويمكن تغييره'}</span></div>
      <div class="team-options">
        ${['A','B'].map(team => {
          const members = roster(team);
          const selected = myTeam === team;
          return `<button type="button" class="team-option team-option-${team.toLowerCase()} ${selected ? 'is-selected' : ''}" aria-pressed="${selected}" onclick="setPlayerTeam('${code}','${myId}','${team}')">
            <span class="team-option-header"><span class="team-option-indicator"></span><span class="team-option-label"><strong>الفريق ${team}</strong><small>${members.length} ${members.length === 1 ? 'لاعب' : 'لاعبين'}</small></span><span class="team-option-check" aria-hidden="true">${selected ? '✓' : '+'}</span></span>
            <span class="team-roster">${members.map(([id, player]) => teamMemberHtml(player, id, myId)).join('') || '<span class="team-empty">كن أول المنضمين</span>'}</span>
          </button>`;
        }).join('')}
      </div>
      <p class="team-picker-note">${myTeam ? `اضغط على فريقك مرة أخرى لإلغاء الانضمام، أو اختر الفريق الآخر للتبديل.` : 'لم تختر فريقًا بعد؛ يمكنك الانضمام إلى أي فريق.'}</p>
    </div>`;
}

function gameDetailHtml(game, room, code, myId, isHost, inviteHtml=''){
  const players = room.players || {};
  const totalPlayers = Object.keys(players).length;

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
      ${isHost ? `<div class="players-box"><h3 style="font-family:'Cairo'; font-size:14px; color:var(--text-dim);">اللاعبون (${totalPlayers})</h3><div>${Object.values(players).map(p => `<span class="chip">${escapeHtml(p.name)}</span>`).join('') || '<span class="muted">بانتظار اللاعبين</span>'}</div></div>` : `<p class="muted" style="text-align:center;">عند بدء اللعبة، يعرضها المنظّم ويتحكم بها من شاشته.</p>`}
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
