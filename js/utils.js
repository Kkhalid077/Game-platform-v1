/* =====================================================================
   SECTION 3 — SHARED UTILITIES
   ===================================================================== */
function shuffle(a){ const r=[...a]; for(let i=r.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [r[i],r[j]]=[r[j],r[i]]; } return r; }
function makeRoomCode(){ return String(Math.floor(1000 + Math.random()*9000)); }
function joinUrl(code){ return location.origin + location.pathname + '?room=' + code; }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function pickRandomWordPair(){ return shuffle(WORD_BANK)[0]; }

function renderIllustration(wordText){
  const found = WORD_BANK.find(x => x.w === wordText);
  if (found && found.img) {
    return `<img src="${found.img}" class="illustration-img" alt="${escapeHtml(wordText)}" />`;
  }
  return `<div style="font-size:70px;">${found ? found.e : '❓'}</div>`;
}

function normalizeAr(s){
  return String(s).trim().toLowerCase()
    .replace(/[\u064B-\u065F\u0610-\u061A\u06D6-\u06ED]/g,'')
    .replace(/[إأآا]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي')
    .replace(/\s+/g,'');
}
function drawSegment(ctx, canvas, s){
  if (!s || !s.points || s.points.length < 2) return;
  ctx.strokeStyle = s.color; ctx.lineWidth = s.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  s.points.forEach((p,i) => {
    const x = p.x*canvas.width, y = p.y*canvas.height;
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();
}
function mirrorCanvasFrom(strokeKey, canvasId){
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const sRef = db.ref('strokes/'+strokeKey);
  sRef.off('child_added');
  sRef.on('child_added', snap => drawSegment(ctx, canvas, snap.val()));
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
        <div class="chip team-A">🔵 فريق A: ${teamAName.join('، ') || 'لا أحد بعد'}</div>
        <div class="chip team-B">🔴 فريق B: ${teamBName.join('، ') || 'لا أحد بعد'}</div>
        <div class="muted">من لم يختر فريقًا سيُوزَّع تلقائيًا عند البدء</div>
      </div>`;
  }
  const myTeam = players[myId]?.team || null;
  return `
    <div class="team-selector-box">
      <p style="margin:0 0 10px 0; font-weight:700; font-size:14px;">اختر فريقك (اختياري):</p>
      <button class="btn-team ${myTeam==='A'?'selected-a':''}" onclick="setPlayerTeam('${code}','${myId}','A')">🔵 فريق A</button>
      <button class="btn-team ${myTeam==='B'?'selected-b':''}" onclick="setPlayerTeam('${code}','${myId}','B')">🔴 فريق B</button>
      <div style="font-size:12px; margin-top:6px; color:var(--text-dim);">${myTeam ? `أنت حاليًا في فريق ${myTeam}` : 'لم تختر فريقًا (سيتم توزيعك تلقائيًا)'}</div>
    </div>`;
}

function gameDetailHtml(game, room, code, myId, isHost){
  const votes = room.votes || {};
  const players = room.players || {};
  const readyIds = Object.keys(votes).filter(id => votes[id] === game.id);
  const readyNames = readyIds.map(id => players[id]?.name).filter(Boolean);
  const iAmReady = myId && votes[myId] === game.id;
  const totalPlayers = Object.keys(players).length;

  return `
    <div class="game-detail">
      <button class="btn btn-ghost" onclick="${isHost ? 'hideHostGameDetail()' : 'hideGameDetail()'}">→ رجوع</button>
      <div class="detail-icon">${game.icon}</div>
      <h2 style="font-family:'Cairo'; text-align:center;">${game.title}</h2>
      <p class="narrator">${game.desc}</p>
      <ol class="rules-list">${game.rules.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ol>
      <p class="muted">الحد الأدنى للاعبين: ${game.minPlayers}</p>
      ${teamSelectorHtml(game, room, code, myId, isHost)}
      <div class="players-box">
        <h3 style="font-family:'Cairo'; font-size:14px; color:var(--text-dim);">جاهزون (${readyNames.length})</h3>
        <div>${readyNames.map(n => `<span class="chip">${escapeHtml(n)}</span>`).join('') || '<span class="muted">لا أحد جاهز بعد</span>'}</div>
      </div>
      <div style="text-align:center; margin-top:10px;">
        ${isHost
          ? `<button class="btn" ${totalPlayers < game.minPlayers ? 'disabled' : ''} onclick="startGame('${game.id}','${code}')">ابدأ اللعبة</button>`
          : `<button class="btn ${iAmReady ? 'btn-ghost' : ''}" onclick="toggleReady('${code}','${myId}','${game.id}')">${iAmReady ? 'إلغاء الجهوزية' : 'أنا جاهز ✅'}</button>`}
      </div>
    </div>
  `;
}
window.toggleReady = function(code, myId, gameId){
  const ref = db.ref('rooms/'+code+'/votes/'+myId);
  ref.once('value', snap => { snap.val() === gameId ? ref.remove() : ref.set(gameId); });
};
