/* =====================================================================
   SECTION 7 — SILENT DRAW MODULE WITH TEAM SELECTION
   ===================================================================== */
window.startSilentDrawGame = function(code){
  const roomRef = db.ref('rooms/'+code);
  roomRef.child('players').once('value', snap => {
    const players = snap.val() || {};
    const ids = Object.keys(players);
    if (ids.length < 4) { alert('تحتاج 4 لاعبين على الأقل (فريقين) لبدء الرسم الصامت'); return; }

    // توزيع اللاعبين بناءً على اختيارهم، مع موازنة متبقي اللاعبين تلقائياً
    let teamA = ids.filter(id => players[id].team === 'A');
    let teamB = ids.filter(id => players[id].team === 'B');
    let unassigned = shuffle(ids.filter(id => players[id].team !== 'A' && players[id].team !== 'B'));

    unassigned.forEach(id => {
      if (teamA.length <= teamB.length) teamA.push(id);
      else teamB.push(id);
    });

    teamA = shuffle(teamA);
    teamB = shuffle(teamB);

    db.ref('strokes/'+code+'_A').set(null);
    db.ref('strokes/'+code+'_B').set(null);
    roomRef.update({
      status:'in_game', activeGame:'silentdraw',
      silentdraw:{
        phase:'round_start', round:1,
        teams:{ A:teamA, B:teamB },
        guideOf:{ A:teamA[0], B:teamB[0] },
        drawerOf:{ A:teamA[1], B:teamB[1] },
        words:{ A: pickRandomWordPair().w, B: pickRandomWordPair().w },
        undosLeft:{ A:3, B:3 },
        correctCount:{ A:0, B:0 },
        results:{ A:null, B:null },
        timerEnd:null, winner:null
      }
    });
  });
};

window.silentDrawBeginDrawing = function(code){
  db.ref('rooms/'+code+'/silentdraw').update({ phase:'drawing', timerEnd: Date.now()+90000, results:{A:null,B:null} });
};

window.silentDrawFinishRound = function(code){
  const sdRef = db.ref('rooms/'+code+'/silentdraw');
  sdRef.once('value', snap => {
    const sd = snap.val(); if (!sd) return;
    const results = { A: sd.results.A || 'wrong', B: sd.results.B || 'wrong' };
    const correctCount = {...sd.correctCount};
    ['A','B'].forEach(t => { if (results[t]==='correct') correctCount[t] = (correctCount[t]||0)+1; });
    const winner = correctCount.A>=3 ? 'A' : (correctCount.B>=3 ? 'B' : null);
    sdRef.update({ results, correctCount, phase: winner ? 'ended' : 'round_result', winner });
  });
};

window.silentDrawMarkCorrect = function(code, team){
  const sdRef = db.ref('rooms/'+code+'/silentdraw');
  sdRef.child('results/'+team).set('correct').then(() => {
    sdRef.once('value', snap => {
      const sd = snap.val(); if (!sd) return;
      const other = team === 'A' ? 'B' : 'A';
      if (sd.results[other] === 'correct') window.silentDrawFinishRound(code);
    });
  });
};

window.submitSilentGuess = function(code, team, actualWord){
  const input = document.getElementById('guessInput');
  if (!input) return;
  const guess = input.value.trim();
  if (!guess) return;
  const fb = document.getElementById('guessFeedback');
  if (normalizeAr(guess) === normalizeAr(actualWord)){
    if (fb) fb.innerHTML = '<span style="color:var(--green); font-weight:700;">🎉 صحيح! أحسنت</span>';
    window.silentDrawMarkCorrect(code, team);
  } else {
    if (fb) fb.innerHTML = '<span style="color:var(--accent-2);">❌ ليست الكلمة، حاول مرة أخرى</span>';
  }
  input.value = '';
};

window.silentDrawNextRound = function(code){
  const sdRef = db.ref('rooms/'+code+'/silentdraw');
  sdRef.once('value', snap => {
    const sd = snap.val(); if (!sd) return;
    db.ref('strokes/'+code+'_A').set(null);
    db.ref('strokes/'+code+'_B').set(null);
    sdRef.update({
      phase:'round_start', round:(sd.round||1)+1,
      guideOf:{ A: sd.drawerOf.A, B: sd.drawerOf.B },
      drawerOf:{ A: sd.guideOf.A, B: sd.guideOf.B },
      words:{ A: pickRandomWordPair().w, B: pickRandomWordPair().w },
      undosLeft:{ A:3, B:3 }, results:{ A:null, B:null }, timerEnd:null
    });
  });
};

window.silentDrawUndo = function(code, team){
  const sdRef = db.ref('rooms/'+code+'/silentdraw');
  sdRef.once('value', snap => {
    const sd = snap.val(); if (!sd || sd.phase!=='drawing') return;
    if ((sd.undosLeft[team]||0) <= 0) return;
    const strokesRef = db.ref('strokes/'+code+'_'+team);
    strokesRef.limitToLast(1).once('value', s2 => {
      s2.forEach(child => strokesRef.child(child.key).remove());
      sdRef.child('undosLeft/'+team).set(sd.undosLeft[team]-1);
    });
  });
};

function setupSilentCanvas(code, team){
  const canvas = document.getElementById('drawCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const strokesRef = db.ref('strokes/'+code+'_'+team);

  strokesRef.once('value', snap => {
    Object.values(snap.val()||{}).forEach(s => drawSegment(ctx, canvas, s));
  });

  let drawing = false, pts = [];
  function getPos(e){
    const r = canvas.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    return { x: cx/r.width, y: cy/r.height };
  }
  function start(e){
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    drawing = true;
    pts = [getPos(e)];
    canvas.setPointerCapture(e.pointerId);
  }
  function move(e){
    if (!drawing) return; e.preventDefault();
    const p = getPos(e); const prev = pts[pts.length-1] || p;
    pts.push(p);
    drawSegment(ctx, canvas, { points:[prev,p], color:currentColor, size:4 });
  }
  function end(){
    if (!drawing) return; drawing=false;
    if (pts.length > 1) {
      strokesRef.push({ points: pts.slice(), color: currentColor, size:4 })
        .catch(error => console.error('تعذر حفظ الرسم:', error));
    }
    pts=[];
  }
  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}

function silentDrawRankingHtml(sd, players){
  const teamLabel = t => sd.teams[t].map(id => players[id]?.name || '').join(' و ');
  const ranked = ['A','B'].sort((a,b) => sd.correctCount[b] - sd.correctCount[a]);
  return ranked.map((t,i) => `<div class="chip team-${t}">${i+1}. فريق ${t} (${escapeHtml(teamLabel(t))}) — ${sd.correctCount[t]} نقطة</div>`).join('');
}

function renderSilentDrawHost(code, room){
  const sd = room.silentdraw; if (!sd) return;
  const players = room.players || {};
  const teamLabel = t => sd.teams[t].map(id=>players[id]?.name||'').join(' و ');
  let narrator = '', control = '', boards = '';
  const showBoards = ['drawing','round_result','ended'].includes(sd.phase);

  if (sd.phase==='round_start'){
    narrator = `الجولة ${sd.round} — الموجّهون يشاهدون صور أشكالهم الآن سرًا.`;
    control = `<button class="btn" onclick="silentDrawBeginDrawing('${code}')">ابدأ الرسم 🎨</button>`;
  } else if (sd.phase==='drawing'){
    narrator = `⏱️ <span id="timerText">--</span> ثانية — ممنوع الكلام! فقط إشارات.`;
    control = `<button class="btn" onclick="silentDrawFinishRound('${code}')">إنهاء الجولة والتقييم</button>`;
  } else if (sd.phase==='round_result'){
    narrator = `نتيجة الجولة: فريق A ${sd.results.A==='correct'?'✅':'❌'} — فريق B ${sd.results.B==='correct'?'✅':'❌'}`;
    control = `<button class="btn" onclick="silentDrawNextRound('${code}')">الجولة التالية 🔁</button>`;
  } else if (sd.phase==='ended'){
    narrator = `🏆 فاز الفريق ${sd.winner}!`;
    control = `<button class="btn" onclick="resetToLobby('${code}')">لعبة جديدة 🔁</button>`;
  }

  if (showBoards){
    boards = `<div class="draw-layout">${['A','B'].map(t => `
      <div class="team-board">
        <h4 style="font-family:'Cairo';">لوحة الرسام — فريق ${t}: ${escapeHtml(teamLabel(t))}</h4>
        <div class="canvas-wrap"><canvas id="canvas${t}" width="340" height="300"></canvas></div>
        <p class="muted">الكلمة: <b>${escapeHtml(sd.words[t])}</b> — تراجعات متبقية: ${sd.undosLeft[t]}</p>
        <p class="muted">${sd.results[t]==='correct' ? '✅ خمّنوا الكلمة بنجاح' : (sd.phase==='drawing' ? '⏳ ينتظرون التخمين' : '❌ لم يخمّنوا')}</p>
      </div>`).join('')}</div>`;
  }

  document.getElementById('stage').innerHTML = `
    <div style="margin-bottom:15px;">
      <button class="btn btn-danger" onclick="resetToLobby('${code}')">🛑 إنهاء اللعبة والعودة للوحة التحكم</button>
    </div>
    <h2 style="font-family:'Cairo'; color:var(--accent);">الرسم الصامت 🤫</h2>
    <p class="narrator">${narrator}</p>
    <div class="players-box"><h3 style="font-family:'Cairo'; font-size:14px; color:var(--text-dim);">الترتيب (الفوز عند 3 نقاط)</h3>${silentDrawRankingHtml(sd, players)}</div>
    ${boards}
    ${control}
  `;

  if (showBoards){
    mirrorCanvasFrom(code+'_A', 'canvasA');
    mirrorCanvasFrom(code+'_B', 'canvasB');
  }
  if (sd.phase==='drawing') startHostTimerWatch(sd.timerEnd);
}

function renderSilentDrawPlayer(code, myId, name, room){
  const sd = room.silentdraw; if (!sd) return;
  const players = room.players || {};
  const myTeam = sd.teams.A.includes(myId) ? 'A' : (sd.teams.B.includes(myId) ? 'B' : null);

  if (!myTeam){
    app.innerHTML = `<div class="phone"><div class="card"><h2 style="font-family:'Cairo';">👀 أنت متفرج</h2><p class="muted">انضممت بعد بدء اللعبة، شاهد شاشة الحكم.</p></div></div>`;
    return;
  }

  const isGuide = sd.guideOf[myTeam] === myId;
  const isDrawer = sd.drawerOf[myTeam] === myId;
  const teammateId = sd.teams[myTeam].find(id => id !== myId);
  const teammateName = players[teammateId]?.name || '';

  if (sd.phase==='round_start'){
    app.innerHTML = isGuide
      ? `<div class="phone"><div class="card">
          <h2 style="font-family:'Cairo';">أنت الموجّه 🤫</h2>
          ${renderIllustration(sd.words[myTeam])}
          <p style="font-family:'Cairo'; font-size:26px; color:var(--accent);">${escapeHtml(sd.words[myTeam])}</p>
          <p class="muted">وضّح لـ ${escapeHtml(teammateName)} بالإشارة فقط، بدون أي كلام!</p>
        </div></div>`
      : `<div class="phone"><div class="card">
          <h2 style="font-family:'Cairo';">أنت الرسام 🎨</h2>
          <p class="muted">${escapeHtml(teammateName)} يعرف الشكل وسيوجهك بالإشارة فقط. راقبه جيدًا وحاول تكتشف ماذا ترسم!</p>
        </div></div>`;
    return;
  }

  if (sd.phase==='drawing'){
    if (isGuide){
      app.innerHTML = `<div class="phone"><div class="card">
        <h2 style="font-family:'Cairo';">تذكير بالمطلوب</h2>
        ${renderIllustration(sd.words[myTeam])}
        <p style="font-family:'Cairo'; font-size:26px; color:var(--accent);">${escapeHtml(sd.words[myTeam])}</p>
        <p class="muted">بدون كلام! فقط إشارات لصديقك.</p>
        <p class="muted">${sd.results[myTeam]==='correct' ? '🎉 صديقك خمّن الكلمة!' : ''}</p>
      </div></div>`;
    } else if (!isDrawer) {
      app.innerHTML = `<div class="phone"><div class="card"><p class="muted">انتظر دورك في الرسم.</p></div></div>`;
    } else if (sd.results[myTeam] === 'correct') {
      app.innerHTML = `<div class="phone"><div class="card">
        <h2 style="font-family:'Cairo'; color:var(--green);">🎉 أحسنت! خمّنت صح</h2>
        <p class="muted">بانتظار الفريق الآخر أو انتهاء الجولة…</p>
      </div></div>`;
    } else {
      app.innerHTML = `<div class="phone" style="padding:10px;">
        <div class="card" style="max-width:100%;">
          <canvas id="drawCanvas" width="320" height="320" style="width:100%; touch-action:none; background:#fff; border-radius:12px;"></canvas>
          <div class="color-row" style="display:flex; gap:8px; justify-content:center; margin-top:10px;">
            ${['#000000','#e74c3c','#3b82f6','#00b894','#f4c542'].map(c=>`<button onclick="setDrawColor('${c}')" style="width:28px; height:28px; border-radius:50%; background:${c}; border:2px solid #fff;"></button>`).join('')}
          </div>
          <button class="btn btn-ghost" ${sd.undosLeft[myTeam]<=0?'disabled':''} onclick="silentDrawUndo('${code}','${myTeam}')" style="margin-top:10px;">تراجع (${sd.undosLeft[myTeam]} متبقية)</button>
          <input type="text" id="guessInput" placeholder="ماذا ترسم؟ اكتب تخمينك" style="margin-top:14px;" />
          <button class="btn" style="width:100%; margin-top:8px;" onclick="submitSilentGuess('${code}','${myTeam}','${escapeHtml(sd.words[myTeam])}')">تحقق ✅</button>
          <div id="guessFeedback" class="muted" style="margin-top:8px;"></div>
        </div>
      </div>`;
      setupSilentCanvas(code, myTeam);
    }
    return;
  }

  if (sd.phase==='round_result'){
    app.innerHTML = `<div class="phone"><div class="card">
      <h2 style="font-family:'Cairo';">نتيجة الجولة</h2>
      <p class="muted">فريق A: ${sd.results.A==='correct'?'✅ صحيح':'❌ لم يخمّنوا'} — الكلمة: ${escapeHtml(sd.words.A)}</p>
      <p class="muted">فريق B: ${sd.results.B==='correct'?'✅ صحيح':'❌ لم يخمّنوا'} — الكلمة: ${escapeHtml(sd.words.B)}</p>
      <div class="players-box">${silentDrawRankingHtml(sd, players)}</div>
      <p class="muted">الجولة التالية تبدأ قريبًا…</p>
    </div></div>`;
    return;
  }

  if (sd.phase==='ended'){
    app.innerHTML = `<div class="phone"><div class="card">
      <h2 style="font-family:'Cairo';">🏆 فاز الفريق ${sd.winner}!</h2>
      <div class="players-box">${silentDrawRankingHtml(sd, players)}</div>
    </div></div>`;
  }
}
