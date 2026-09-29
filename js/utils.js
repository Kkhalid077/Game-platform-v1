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
  db.ref('rooms/'+code+'/players/'+myId+'/team').once('value', snap => {
    if (snap.val() === team) {
      db.ref('rooms/'+code+'/players/'+myId+'/team').remove();
    } else {
      db.ref('rooms/'+code+'/players/'+myId+'/team').set(team);
    }
  });
};

/* =====================================================================
   SECTION 4 — GAME DETAIL / READY PANEL
   ===================================================================== */
function teamSelectorHtml(game, room, code, myId, isHost){
  if (!game.needsTeams) return '';
  const players = room.players || {};
  if (isHost) {
    const teamAName = Object.values(players).filter(p=>p.team==='A').map(p=>escapeHtml(p.name));
    const teamBName = Object.values(players).filter(p=>p.team==='B').map(p=>escapeHtml(p.name));
    return `
      <div class="team-selector-box">
        <p style="margin:0 0 10px 0; font-weight:700; font-size:14px;">توزيع الفرق حتى الآن:</p>
        <div class="chip team-A"> فريق A: ${teamAName.join('، ') || 'لا أحد بعد'}</div>
        <div class="chip team-B"> فريق B: ${teamBName.join('، ') || 'لا أحد بعد'}</div>
        <div class="muted">من لم يختر فريقًا سيُوزَّع تلقائيًا عند البدء</div>
      </div>`;
  }
  const myTeam = players[myId]?.team || null;
  const roster = team => Object.values(players).filter(p => p.team === team).map(p => escapeHtml(p.name));
  return `
    <div class="team-selector-box">
      <p style="margin:0 0 10px 0; font-weight:700; font-size:14px;">اختر فريقك (اختياري):</p>
      <button class="btn-team ${myTeam==='A'?'selected-a':''}" onclick="setPlayerTeam('${code}','${myId}','A')">فريق A (${roster('A').length})</button>
      <button class="btn-team ${myTeam==='B'?'selected-b':''}" onclick="setPlayerTeam('${code}','${myId}','B')">فريق B (${roster('B').length})</button>
      <div class="muted">أعضاء فريق A: ${roster('A').join('، ') || 'لم ينضم أحد بعد'}</div>
      <div class="muted">أعضاء فريق B: ${roster('B').join('، ') || 'لم ينضم أحد بعد'}</div>
      <div style="font-size:12px; margin-top:6px; color:var(--text-dim);">${myTeam ? `أنت حاليًا في فريق ${myTeam}` : 'لم تختر فريقًا (سيتم توزيعك تلقائيًا)'}</div>
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
