/* =====================================================================
   SECTION 7 — SILENT DRAW MODULE WITH TEAM SELECTION
   ===================================================================== */
function silentDrawTeamIds(sd, team){
  const members = sd && sd.teams && sd.teams[team];
  if (Array.isArray(members)) return members;
  return Object.values(members || {});
}

window.startSilentDrawGame = function(code){
  const roomRef = db.ref('sessions/'+code);
  roomRef.child('players').once('value', snap => {
    const players = snap.val() || {};
    const ids = Object.keys(players);
    if (ids.length < 4) { alert('تحتاج 4 لاعبين على الأقل (فريقين) لبدء إشارة ورسمة'); return; }

    // توزيع اللاعبين بناءً على اختيارهم، مع موازنة متبقي اللاعبين تلقائياً
    let teamA = ids.filter(id => players[id].team === 'A');
    let teamB = ids.filter(id => players[id].team === 'B');
    let unassigned = shuffle(ids.filter(id => players[id].team !== 'A' && players[id].team !== 'B'));

    unassigned.forEach(id => {
      if (teamA.length <= teamB.length) teamA.push(id);
      else teamB.push(id);
    });

    while (teamA.length < 2 && teamB.length > 2) teamA.push(teamB.pop());
    while (teamB.length < 2 && teamA.length > 2) teamB.push(teamA.pop());

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
        results:{ A:null, B:null }, awarded:{ A:false, B:false },
        timerEnd:null, winner:null
      }
    });
  });
};

window.silentDrawBeginDrawing = async function(code){
  const roomRef = db.ref('sessions/'+code);
  const sdRef = roomRef.child('silentdraw');
  const button = document.getElementById('beginDrawingBtn');
  if (button){ button.disabled = true; button.textContent = 'جارٍ بدء الرسم…'; }
  try {
    await roomRef.update({
      'silentdraw/phase':'drawing',
      'silentdraw/timerEnd':Date.now()+90000,
      'silentdraw/results':{A:null,B:null},
      'silentdraw/awarded':{A:false,B:false}
    });
    const phaseSnap = await sdRef.child('phase').once('value');
    if (phaseSnap.val() !== 'drawing') throw new Error('تأكد الخادم من عدم بدء الجولة');
  } catch (error) {
    console.error('تعذر بدء الرسم:', error);
    if (button){ button.disabled = false; button.textContent = 'تعذر البدء، حاول مجددًا'; }
    alert('لم تبدأ الجولة: ' + (error.message || 'تحقق من اتصال المنظم وصلاحية الكتابة في Firebase.'));
  }
};

window.silentDrawFinishRound = function(code){
  const sdRef = db.ref('sessions/'+code+'/silentdraw');
  sdRef.once('value', snap => {
    const sd = snap.val(); if (!sd) return;
    const results = { A: sd.results.A || 'wrong', B: sd.results.B || 'wrong' };
    const correctCount = {...sd.correctCount};
    ['A','B'].forEach(t => { if (results[t]==='correct' && !(sd.awarded && sd.awarded[t])) correctCount[t] = (correctCount[t]||0)+1; });
    const winner = correctCount.A>=3 ? 'A' : (correctCount.B>=3 ? 'B' : null);
    sdRef.update({ results, correctCount, phase: winner ? 'ended' : 'round_result', winner });
  });
};

window.silentDrawAwardPoint = function(code, team){
  const sdRef = db.ref('sessions/'+code+'/silentdraw');
  sdRef.once('value', snap => {
    const sd = snap.val();
    if (!sd || sd.phase !== 'drawing' || (sd.awarded && sd.awarded[team])) return;
    const correctCount = {...sd.correctCount};
    correctCount[team] = (correctCount[team] || 0) + 1;
    const winner = correctCount[team] >= 3 ? team : null;
    sdRef.update({
      correctCount,
      results:{...sd.results, [team]:'correct'},
      awarded:{...(sd.awarded || {}), [team]:true},
      phase: winner ? 'ended' : 'drawing',
      winner
    });
  });
};

window.silentDrawMarkCorrect = function(code, team){
  const sdRef = db.ref('sessions/'+code+'/silentdraw');
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
    if (fb) fb.innerHTML = '<span style="color:var(--green); font-weight:700;"> صحيح! أحسنت</span>';
    window.silentDrawMarkCorrect(code, team);
  } else {
    if (fb) fb.innerHTML = '<span style="color:var(--accent-2);"> ليست الكلمة، حاول مرة أخرى</span>';
  }
  input.value = '';
};

window.silentDrawNextRound = function(code){
  const sdRef = db.ref('sessions/'+code+'/silentdraw');
  sdRef.once('value', snap => {
    const sd = snap.val(); if (!sd) return;
    db.ref('strokes/'+code+'_A').set(null);
    db.ref('strokes/'+code+'_B').set(null);
    sdRef.update({
      phase:'round_start', round:(sd.round||1)+1,
      guideOf:{ A: sd.drawerOf.A, B: sd.drawerOf.B },
      drawerOf:{ A: sd.guideOf.A, B: sd.guideOf.B },
      words:{ A: pickRandomWordPair().w, B: pickRandomWordPair().w },
      undosLeft:{ A:3, B:3 }, results:{ A:null, B:null }, awarded:{ A:false, B:false }, timerEnd:null
    });
  });
};

window.silentDrawUndo = function(code, team){
  const sdRef = db.ref('sessions/'+code+'/silentdraw');
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

let silentCanvasCleanup = null;
function cleanupSilentCanvas(){
  if (silentCanvasCleanup){ silentCanvasCleanup(); silentCanvasCleanup = null; }
}
window.cleanupSilentCanvas = cleanupSilentCanvas;

function setupSilentCanvas(code, team){
  cleanupSilentCanvas();
  const canvas = document.getElementById('drawCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const strokesRef = db.ref('strokes/'+code+'_'+team);
  canvas.style.touchAction = 'none';
  canvas.style.userSelect = 'none';
  canvas.style.webkitUserSelect = 'none';

  let drawing = false;
  let activePointerId = null;
  let points = [];
  let activeStrokeRef = null;
  let activeStrokeColor = currentColor;
  let disposed = false;

  function pointFromEvent(event){
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const touch = event.changedTouches && event.changedTouches[0];
    const clientX = touch ? touch.clientX : event.clientX;
    const clientY = touch ? touch.clientY : event.clientY;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    };
  }

  function persistStroke(){
    if (!activeStrokeRef || points.length === 0) return;
    const stroke = { points:points.slice(), color:activeStrokeColor, size:5 };
    activeStrokeRef.set(stroke).catch(error => console.error('تعذر بث الرسم:', error));
  }

  function begin(event){
    if (drawing || (event.button !== undefined && event.button !== 0)) return;
    if (event.cancelable) event.preventDefault();
    const point = pointFromEvent(event);
    if (!point) return;
    drawing = true;
    activePointerId = event.pointerId ?? 'touch-or-mouse';
    points = [point];
    activeStrokeColor = currentColor;
    activeStrokeRef = strokesRef.push();
    drawSegment(ctx, canvas, { points, color:activeStrokeColor, size:5 });
    persistStroke();
    if (event.pointerId !== undefined && canvas.setPointerCapture){
      try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
    }
  }

  function continueStroke(event){
    if (!drawing) return;
    if (event.pointerId !== undefined && activePointerId !== event.pointerId) return;
    if (event.cancelable) event.preventDefault();
    const point = pointFromEvent(event);
    if (!point) return;
    const previous = points[points.length - 1];
    points.push(point);
    drawSegment(ctx, canvas, { points:[previous,point], color:activeStrokeColor, size:5 });
    persistStroke();
  }

  function finish(event){
    if (!drawing) return;
    if (event && event.pointerId !== undefined && activePointerId !== event.pointerId) return;
    drawing = false;
    activePointerId = null;
    points = [];
    activeStrokeRef = null;
  }

  function preventCanvasMenu(event){ event.preventDefault(); }
  function redrawAfterUndo(){
    strokesRef.once('value').then(snapshot => {
      if (disposed || document.getElementById('drawCanvas') !== canvas) return;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      Object.values(snapshot.val() || {}).forEach(stroke => drawSegment(ctx, canvas, stroke));
    }).catch(error => console.error('تعذر تحديث اللوحة بعد التراجع:', error));
  }
  strokesRef.on('child_removed', redrawAfterUndo);
  const supportsPointerEvents = 'PointerEvent' in window;
  if (supportsPointerEvents){
    canvas.addEventListener('pointerdown', begin);
    window.addEventListener('pointermove', continueStroke, {passive:false});
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  } else {
    canvas.addEventListener('mousedown', begin);
    window.addEventListener('mousemove', continueStroke);
    window.addEventListener('mouseup', finish);
    canvas.addEventListener('touchstart', begin, {passive:false});
    window.addEventListener('touchmove', continueStroke, {passive:false});
    window.addEventListener('touchend', finish);
    window.addEventListener('touchcancel', finish);
  }
  canvas.addEventListener('contextmenu', preventCanvasMenu);

  strokesRef.once('value').then(snapshot => {
    if (disposed || document.getElementById('drawCanvas') !== canvas) return;
    Object.values(snapshot.val() || {}).forEach(stroke => drawSegment(ctx, canvas, stroke));
  }).catch(error => console.error('تعذر تحميل الرسم المحفوظ:', error));

  silentCanvasCleanup = () => {
    disposed = true;
    if (supportsPointerEvents){
      canvas.removeEventListener('pointerdown', begin);
      window.removeEventListener('pointermove', continueStroke);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    } else {
      canvas.removeEventListener('mousedown', begin);
      window.removeEventListener('mousemove', continueStroke);
      window.removeEventListener('mouseup', finish);
      canvas.removeEventListener('touchstart', begin);
      window.removeEventListener('touchmove', continueStroke);
      window.removeEventListener('touchend', finish);
      window.removeEventListener('touchcancel', finish);
    }
    canvas.removeEventListener('contextmenu', preventCanvasMenu);
    strokesRef.off('child_removed', redrawAfterUndo);
  };
}

function silentDrawRankingHtml(sd, players){
  const teamLabel = t => silentDrawTeamIds(sd,t).map(id => players[id]?.name || '').join(' و ');
  const ranked = ['A','B'].sort((a,b) => sd.correctCount[b] - sd.correctCount[a]);
  return ranked.map((t,i) => `<div class="chip team-${t}">${i+1}. فريق ${t} (${escapeHtml(teamLabel(t))}) — ${sd.correctCount[t]} نقطة</div>`).join('');
}

function renderSilentDrawHost(code, room){
  const sd = room.silentdraw; if (!sd) return;
  const players = room.players || {};
  const teamLabel = t => silentDrawTeamIds(sd,t).map(id=>players[id]?.name||'').join(' و ');
  let narrator = '', control = '', boards = '';
  const showBoards = ['drawing','round_result','ended'].includes(sd.phase);

  if (sd.phase==='round_start'){
    narrator = `الجولة ${sd.round} — الموجّهون يشاهدون صور أشكالهم الآن سرًا.`;
    control = `<button type="button" class="btn" id="beginDrawingBtn">ابدأ الرسم <span aria-hidden="true"></span></button>`;
  } else if (sd.phase==='drawing'){
    narrator = ` <span id="timerText">--</span> ثانية — ممنوع الكلام! فقط إشارات.`;
    control = `<div><button class="btn" ${sd.awarded && sd.awarded.A?'disabled':''} onclick="silentDrawAwardPoint('${code}','A')">احتساب نقطة لفريق A</button><button class="btn" ${sd.awarded && sd.awarded.B?'disabled':''} onclick="silentDrawAwardPoint('${code}','B')">احتساب نقطة لفريق B</button></div><button class="btn btn-ghost" onclick="silentDrawFinishRound('${code}')">إنهاء الجولة</button>`;
  } else if (sd.phase==='round_result'){
    narrator = `نتيجة الجولة: فريق A ${sd.results.A==='correct'?'':''} — فريق B ${sd.results.B==='correct'?'':''}`;
    control = `<button class="btn" onclick="silentDrawNextRound('${code}')">الجولة التالية </button>`;
  } else if (sd.phase==='ended'){
    narrator = ` فاز الفريق ${sd.winner}!`;
    control = `<button class="btn" onclick="resetToLobby('${code}')">لعبة جديدة </button>`;
  }

  if (showBoards){
    boards = `<div class="draw-layout">${['A','B'].map(t => `
      <div class="team-board">
        <h4 style="font-family:'Cairo';">لوحة الرسام — فريق ${t}: ${escapeHtml(teamLabel(t))}</h4>
        <div class="canvas-wrap"><canvas id="canvas${t}" width="340" height="300"></canvas></div>
        <p class="muted">الكلمة: <b>${escapeHtml(sd.words[t])}</b> — تراجعات متبقية: ${sd.undosLeft[t]}</p>
        <p class="muted">${sd.results[t]==='correct' ? ' خمّنوا الكلمة بنجاح' : (sd.phase==='drawing' ? ' ينتظرون التخمين' : ' لم يخمّنوا')}</p>
      </div>`).join('')}</div>`;
  }

  document.getElementById('stage').innerHTML = `
    <div style="margin-bottom:15px;">
      <button class="btn btn-danger" onclick="resetToLobby('${code}')"> إنهاء اللعبة والعودة للوحة التحكم</button>
    </div>
    <h2 style="font-family:'Cairo'; color:var(--accent);">إشارة ورسمة</h2>
    <p class="narrator">${narrator}</p>
    <div class="players-box"><h3 style="font-family:'Cairo'; font-size:14px; color:var(--text-dim);">الترتيب (الفوز عند 3 نقاط)</h3>${silentDrawRankingHtml(sd, players)}</div>
    ${boards}
    ${control}
  `;

  if (showBoards){
    mirrorCanvasFrom(code+'_A', 'canvasA');
    mirrorCanvasFrom(code+'_B', 'canvasB');
  }
  const beginDrawingBtn = document.getElementById('beginDrawingBtn');
  if (beginDrawingBtn) beginDrawingBtn.addEventListener('click', () => window.silentDrawBeginDrawing(code));
  if (sd.phase==='drawing') startHostTimerWatch(sd.timerEnd);
}

function renderSilentDrawPlayer(code, myId, name, room){
  const sd = room.silentdraw; if (!sd) return;
  if (sd.phase !== 'drawing') cleanupSilentCanvas();
  const players = room.players || {};
  const myTeam = silentDrawTeamIds(sd,'A').some(id => String(id) === String(myId))
    ? 'A'
    : (silentDrawTeamIds(sd,'B').some(id => String(id) === String(myId)) ? 'B' : null);

  if (!myTeam){
    cleanupSilentCanvas();
    app.innerHTML = `<div class="phone"><div class="card"><h2 style="font-family:'Cairo';"> أنت متفرج</h2><p class="muted">انضممت بعد بدء اللعبة، شاهد شاشة الحكم.</p></div></div>`;
    return;
  }

  const isGuide = sd.guideOf[myTeam] === myId;
  const teammateId = silentDrawTeamIds(sd,myTeam).find(id => String(id) !== String(myId));
  const teammateName = players[teammateId]?.name || '';

  if (sd.phase==='round_start'){
    app.innerHTML = isGuide
      ? `<div class="phone"><div class="card">
          <h2 style="font-family:'Cairo';">أنت الموجّه </h2>
          ${renderIllustration(sd.words[myTeam])}
          <p style="font-family:'Cairo'; font-size:26px; color:var(--accent);">${escapeHtml(sd.words[myTeam])}</p>
          <p class="muted">وضّح لـ ${escapeHtml(teammateName)} بالإشارة فقط، بدون أي كلام!</p>
        </div></div>`
      : `<div class="phone"><div class="card">
          <h2 style="font-family:'Cairo';">أنت الرسام </h2>
          <p class="muted">${escapeHtml(teammateName)} يعرف الشكل وسيوجهك بالإشارة فقط. راقبه جيدًا وحاول تكتشف ماذا ترسم!</p>
        </div></div>`;
    return;
  }

  if (sd.phase==='drawing'){
    if (isGuide){
      cleanupSilentCanvas();
      app.innerHTML = `<div class="phone"><div class="card">
        <h2 style="font-family:'Cairo';">تذكير بالمطلوب</h2>
        ${renderIllustration(sd.words[myTeam])}
        <p style="font-family:'Cairo'; font-size:26px; color:var(--accent);">${escapeHtml(sd.words[myTeam])}</p>
        <p class="muted">بدون كلام! فقط إشارات لصديقك.</p>
        <p class="muted">${sd.results[myTeam]==='correct' ? ' صديقك خمّن الكلمة!' : ''}</p>
      </div></div>`;
    } else if (sd.results[myTeam] === 'correct') {
      cleanupSilentCanvas();
      app.innerHTML = `<div class="phone"><div class="card">
        <h2 style="font-family:'Cairo'; color:var(--green);"> أحسنت! خمّنت صح</h2>
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
          <button class="btn" style="width:100%; margin-top:8px;" onclick="submitSilentGuess('${code}','${myTeam}','${escapeHtml(sd.words[myTeam])}')">تحقق </button>
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
      <p class="muted">فريق A: ${sd.results.A==='correct'?' صحيح':' لم يخمّنوا'} — الكلمة: ${escapeHtml(sd.words.A)}</p>
      <p class="muted">فريق B: ${sd.results.B==='correct'?' صحيح':' لم يخمّنوا'} — الكلمة: ${escapeHtml(sd.words.B)}</p>
      <div class="players-box">${silentDrawRankingHtml(sd, players)}</div>
      <p class="muted">الجولة التالية تبدأ قريبًا…</p>
    </div></div>`;
    return;
  }

  if (sd.phase==='ended'){
    app.innerHTML = `<div class="phone"><div class="card">
      <h2 style="font-family:'Cairo';"> فاز الفريق ${sd.winner}!</h2>
      <div class="players-box">${silentDrawRankingHtml(sd, players)}</div>
    </div></div>`;
  }
}
