/* =====================================================================
   SECTION 7 — SILENT DRAW MODULE WITH TEAM SELECTION
   ===================================================================== */
function silentDrawTeamIds(sd, team){
  const members = sd && sd.teams && sd.teams[team];
  if (Array.isArray(members)) return members;
  return Object.values(members || {});
}

window.startSilentDrawGame = function(code){
  const roomRef = db.ref('rooms/'+code);
  roomRef.child('players').once('value').then(async snap => {
    const players = snap.val() || {};
    const ids = Object.keys(players);
    if (ids.length < 4) { alert('تحتاج 4 لاعبين على الأقل (فريقين) لبدء إشارة ورسمة'); return; }

    let teamA = ids.filter(id => players[id].team === 'A').slice(0,2);
    let teamB = ids.filter(id => players[id].team === 'B').slice(0,2);
    const assigned = new Set([...teamA,...teamB]);
    const available = shuffle(ids.filter(id => !assigned.has(id)));
    while (teamA.length < 2 && available.length) teamA.push(available.pop());
    while (teamB.length < 2 && available.length) teamB.push(available.pop());
    if (teamA.length < 2 || teamB.length < 2) {
      alert('تحتاج إلى لاعبين اثنين في كل فريق لبدء إشارة ورسمة.');
      return;
    }

    teamA = shuffle(teamA);
    teamB = shuffle(teamB);
    const teamNamesSnap = await roomRef.child('teamNames').once('value');
    const savedTeamNames = teamNamesSnap.val() || {};

    db.ref('strokes/'+code+'_A').set(null);
    db.ref('strokes/'+code+'_B').set(null);
    roomRef.update({
      status:'in_game', activeGame:'silentdraw',
      silentdraw:{
        phase:'round_start', round:1,
        teamNames:{A:savedTeamNames.A||'الفريق الأخضر',B:savedTeamNames.B||'الفريق البرتقالي'},
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
  }).catch(error=>{
    console.error('Could not start Silent Draw:',error);
    alert('تعذر بدء اللعبة. تحقق من الاتصال وحاول مرة أخرى.');
  });
};

window.silentDrawBeginDrawing = async function(code){
  const roomRef = db.ref('rooms/'+code);
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
  const sdRef = db.ref('rooms/'+code+'/silentdraw');
  sdRef.once('value', snap => {
    const sd = snap.val(); if (!sd) return;
    const r0 = sd.results || {};
    const results = { A: r0.A || 'wrong', B: r0.B || 'wrong' };
    const correctCount = {...sd.correctCount};
    ['A','B'].forEach(t => { if (results[t]==='correct' && !(sd.awarded && sd.awarded[t])) correctCount[t] = (correctCount[t]||0)+1; });
    const winner = correctCount.A>=3 ? 'A' : (correctCount.B>=3 ? 'B' : null);
    sdRef.update({ results, correctCount, phase: winner ? 'ended' : 'round_result', winner });
  });
};

window.silentDrawAwardPoint = function(code, team){
  const sdRef = db.ref('rooms/'+code+'/silentdraw');
  sdRef.once('value', snap => {
    const sd = snap.val();
    if (!sd || sd.phase !== 'drawing' || (sd.awarded && sd.awarded[team])) return;
    const correctCount = {...sd.correctCount};
    correctCount[team] = (correctCount[team] || 0) + 1;
    const awarded = {...(sd.awarded || {}), [team]:true};
    const winner = correctCount[team] >= 3 ? team : null;
    sdRef.update({
      correctCount,
      results:{...(sd.results || {}), [team]:'correct'},
      awarded,
      phase: winner ? 'ended' : (awarded.A && awarded.B ? 'round_result' : 'drawing'),
      winner
    });
  });
};

// التخمين الصحيح من الرسام يمنح النقطة فورًا (كما في قواعد اللعبة)
window.silentDrawMarkCorrect = function(code, team){ window.silentDrawAwardPoint(code, team); };

window.submitSilentGuess = function(code, team){
  const actualWord = lastPlayerRoom?.silentdraw?.words?.[team];
  if (!actualWord) return;
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
      undosLeft:{ A:3, B:3 }, results:{ A:null, B:null }, awarded:{ A:false, B:false }, timerEnd:null
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
  const teamLabel = t => silentDrawTeamIds(sd,t).map(id => players[id]?.name || '').filter(Boolean).join(' و ');
  const teamName = t => escapeHtml(sd.teamNames?.[t] || `الفريق ${t}`);
  const ranked = ['A','B'].sort((a,b) => (Number(sd.correctCount?.[b])||0) - (Number(sd.correctCount?.[a])||0));
  const topScore = Number(sd.correctCount?.[ranked[0]]) || 0;
  return `<div class="team-ranking-grid">${ranked.map((t,i) => {
    const score = Number(sd.correctCount?.[t]) || 0;
    const rank = i > 0 && score === (Number(sd.correctCount?.[ranked[i-1]]) || 0) ? i : i+1;
    return `<article class="team-ranking-card team-${t.toLowerCase()} ${score===topScore?'is-leading':''}">
    <span class="team-ranking-place">${rank===1?'١':'٢'}</span>
    <div class="team-ranking-info"><strong>${teamName(t)}</strong><small>${escapeHtml(teamLabel(t)||'بانتظار اللاعبين')}</small></div>
    <div class="team-ranking-score"><b>${score}</b><span>نقاط</span></div>
  </article>`;
  }).join('')}</div>`;
}

function renderSilentDrawHost(code, room){
  const sd = room.silentdraw; if (!sd) return;
  const res = sd.results || {};
  const players = room.players || {};
  const teamLabel = t => silentDrawTeamIds(sd,t).map(id=>players[id]?.name||'').join(' و ');
  const teamName = t => escapeHtml(sd.teamNames?.[t] || `الفريق ${t}`);
  let narrator = '', control = '', boards = '';
  const showBoards = ['drawing','round_result','ended'].includes(sd.phase);

  if (sd.phase==='round_start'){
    narrator = `الجولة ${sd.round} — الموجّهون يشاهدون صور أشكالهم الآن سرًا.`;
    control = `<button type="button" class="btn" id="beginDrawingBtn">ابدأ الرسم <span aria-hidden="true"></span></button>`;
  } else if (sd.phase==='drawing'){
    narrator = ` <span id="timerText">--</span> ثانية — ممنوع الكلام! فقط إشارات.`;
    control = `<div><button class="btn" ${sd.awarded && sd.awarded.A?'disabled':''} onclick="silentDrawAwardPoint('${code}','A')">احتساب نقطة لـ ${teamName('A')}</button><button class="btn" ${sd.awarded && sd.awarded.B?'disabled':''} onclick="silentDrawAwardPoint('${code}','B')">احتساب نقطة لـ ${teamName('B')}</button></div><button class="btn btn-ghost" onclick="silentDrawFinishRound('${code}')">إنهاء الجولة</button>`;
  } else if (sd.phase==='round_result'){
    narrator = `نتيجة الجولة: ${teamName('A')} ${res.A==='correct'?'':''} — ${teamName('B')} ${res.B==='correct'?'':''}`;
    control = `<button class="btn" onclick="silentDrawNextRound('${code}')">الجولة التالية </button>`;
  } else if (sd.phase==='ended'){
    narrator = ` فاز ${teamName(sd.winner)}!`;
    control = `<button class="btn" onclick="resetToLobby('${code}')">لعبة جديدة </button>`;
  }

  if (showBoards){
    boards = `<div class="draw-layout">${['A','B'].map(t => `
      <div class="team-board">
        <h4 style="font-family:'Cairo';">لوحة الرسام — ${teamName(t)}: ${escapeHtml(teamLabel(t))}</h4>
        <div class="canvas-wrap"><canvas id="canvas${t}" width="320" height="320"></canvas></div>
        <p class="muted">الكلمة: <b>${escapeHtml(sd.words[t])}</b> — تراجعات متبقية: ${sd.undosLeft[t]}</p>
        <p class="muted">${res[t]==='correct' ? ' خمّنوا الكلمة بنجاح' : (sd.phase==='drawing' ? ' ينتظرون التخمين' : ' لم يخمّنوا')}</p>
      </div>`).join('')}</div>`;
  }

  document.getElementById('stage').innerHTML = `
    <button class="btn btn-danger activity-exit-control" onclick="resetToLobby('${code}')">إنهاء اللعبة</button>
    ${sd.phase==='ended' ? winnerCelebrationHtml() : ''}
    <h2 style="font-family:'Cairo'; color:var(--accent);">إشارة ورسمة</h2>
    <p class="narrator">${narrator}</p>
    <section class="players-box team-ranking-box"><h3>الترتيب <small>الفوز عند ٣ نقاط</small></h3>${silentDrawRankingHtml(sd, players)}</section>
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
  const res = sd.results || {};
  if (sd.phase !== 'drawing') { cleanupSilentCanvas(); app.dataset.sdKey = ''; }
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
  const isDrawer = sd.drawerOf[myTeam] === myId;
  const teammateId = isGuide ? sd.drawerOf[myTeam] : sd.guideOf[myTeam];
  const teammateName = players[teammateId]?.name || '';

  // فريق من 3 لاعبين: العضو الزائد يشجّع فقط
  if (!isGuide && !isDrawer && (sd.phase==='round_start' || sd.phase==='drawing')){
    cleanupSilentCanvas();
    app.innerHTML = `<div class="phone"><div class="card"><h2>أنت مشجّع الفريق</h2><p class="muted">في فريقكم موجّه ورسام. تابعوا اللوحة وشجّعوا بصمت!</p></div></div>`;
    return;
  }

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
        <p class="muted">${res[myTeam]==='correct' ? ' صديقك خمّن الكلمة!' : ''}</p>
      </div></div>`;
    } else if (res[myTeam] === 'correct') {
      cleanupSilentCanvas();
      app.innerHTML = `<div class="phone"><div class="card">
        <h2 style="font-family:'Cairo'; color:var(--green);"> أحسنت! خمّنت صح</h2>
        <p class="muted">بانتظار الفريق الآخر أو انتهاء الجولة…</p>
      </div></div>`;
    } else {
      // لا نعيد بناء اللوحة إلا إذا تغيّر شيء يخص هذا اللاعب (يحفظ الرسم وما كُتب في خانة التخمين)
      const key = `${sd.round}|${myTeam}|${res[myTeam]||''}|${sd.undosLeft[myTeam]}`;
      if (app.dataset.sdKey === key && document.getElementById('drawCanvas')) return;
      app.dataset.sdKey = key;
      app.innerHTML = `<div class="phone" style="padding:10px;">
        <div class="card" style="max-width:100%;">
          <canvas id="drawCanvas" width="320" height="320" style="width:100%; touch-action:none; background:#fff; border-radius:12px;"></canvas>
          <div class="color-row" style="display:flex; gap:8px; justify-content:center; margin-top:10px;">
            ${['#000000','#e74c3c','#3b82f6','#00b894','#f4c542'].map(c=>`<button onclick="setDrawColor('${c}')" style="width:28px; height:28px; border-radius:50%; background:${c}; border:2px solid #fff;"></button>`).join('')}
          </div>
          <button class="btn btn-ghost" ${sd.undosLeft[myTeam]<=0?'disabled':''} onclick="silentDrawUndo('${code}','${myTeam}')" style="margin-top:10px;">تراجع (${sd.undosLeft[myTeam]} متبقية)</button>
          <input type="text" id="guessInput" placeholder="ماذا ترسم؟ اكتب تخمينك" style="margin-top:14px;" />
          <button class="btn" style="width:100%; margin-top:8px;" onclick="submitSilentGuess('${code}','${myTeam}')">تحقق </button>
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
      <p class="muted">فريق A: ${res.A==='correct'?' صحيح':' لم يخمّنوا'} — الكلمة: ${escapeHtml(sd.words.A)}</p>
      <p class="muted">فريق B: ${res.B==='correct'?' صحيح':' لم يخمّنوا'} — الكلمة: ${escapeHtml(sd.words.B)}</p>
      <div class="players-box">${silentDrawRankingHtml(sd, players)}</div>
      <p class="muted">الجولة التالية تبدأ قريبًا…</p>
    </div></div>`;
    return;
  }

  if (sd.phase==='ended'){
    app.innerHTML = `<div class="phone"><div class="card">
      ${winnerCelebrationHtml()}
      <h2 style="font-family:'Cairo';"> فاز الفريق ${sd.winner}!</h2>
      <div class="players-box">${silentDrawRankingHtml(sd, players)}</div>
    </div></div>`;
  }
}
