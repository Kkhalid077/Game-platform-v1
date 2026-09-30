const QATARA_BANK = [
  { id:'q1', question:'ما الحيوان الذي يُلقب بسفينة الصحراء؟', answer:'الجمل' },
  { id:'q2', question:'ما الكوكب المعروف بالكوكب الأحمر؟', answer:'المريخ' },
  { id:'q3', question:'ما عاصمة المملكة العربية السعودية؟', answer:'الرياض' },
  { id:'q4', question:'ما أسرع حيوان بري في العالم؟', answer:'الفهد' },
  { id:'q5', question:'ما الغاز الذي تمتصه النباتات في عملية البناء الضوئي؟', answer:'ثاني أكسيد الكربون' },
  { id:'q6', question:'كم عدد أضلاع الشكل السداسي؟', answer:'ستة', answers:['ستة','6','٦'] },
  { id:'q7', question:'ما أكبر محيط على سطح الأرض؟', answer:'المحيط الهادئ' },
  { id:'q8', question:'ما اسم صغير الضفدع قبل اكتمال نموه؟', answer:'شرغوف' },
  { id:'q9', question:'في أي دولة تقع مدينة البتراء الأثرية؟', answer:'الأردن' },
  { id:'q10', question:'ما المادة التي تتكون منها أقلام الرصاص من الداخل؟', answer:'الغرافيت' }
];

const QATARA_ANSWER_SECONDS = 10;
const QATARA_WRONG_PENALTY = 5;
let qataraHostInterval = null;
let qataraPlayerInterval = null;

function qataraQuestion(game){
  const questionId = game?.questionOrder?.[game.questionIndex];
  return QATARA_BANK.find(question => question.id === questionId) || null;
}

function qataraVisibleWords(game, question, now = Date.now()){
  if (!question) return [];
  const words = question.question.split(/\s+/);
  const elapsedSeconds = Math.floor(Math.max(0, now - (Number(game.startedAt) || now)) / 1000);
  const visibleCount = Math.min(words.length, Math.max(0, Number(game.baseWords) || 0) + elapsedSeconds);
  return words.slice(0, visibleCount);
}

function qataraPoints(elapsedMs){
  const seconds = elapsedMs / 1000;
  return seconds <= 3 ? 10 : seconds <= 7 ? 7 : 5;
}

window.startQataraGame = function(code){
  const roomRef = db.ref(`rooms/${code}`);
  roomRef.once('value').then(snapshot => {
    const room = snapshot.val();
    const participantIds = Object.keys(room?.players || {});
    if (participantIds.length < 2) {
      alert('تحتاج إلى لاعبين اثنين على الأقل لبدء سؤال القَطّارة.');
      return;
    }
    return roomRef.update({
      status:'in_game',
      activeGame:'qatara',
      qatara:{
        phase:'reading',
        questionOrder:shuffle(QATARA_BANK.map(question => question.id)),
        questionIndex:0,
        participantIds,
        scores:{},
        eliminated:{},
        baseWords:1,
        elapsedMs:0,
        startedAt:Date.now()
      }
    });
  }).catch(error => {
    console.error('Could not start Qatara:', error);
    alert('تعذر بدء اللعبة. تحقق من الاتصال ثم حاول مرة أخرى.');
  });
};

window.qataraBuzz = function(code, playerId, questionIndex, startedAt, baseWords, elapsedMs){
  const buzzAt = Date.now();
  const gameRef = db.ref(`rooms/${code}/qatara`);
  gameRef.transaction(game => {
    if (!game || game.phase !== 'reading' ||
        game.questionIndex !== questionIndex || game.startedAt !== startedAt ||
        !(game.participantIds || []).includes(playerId) ||
        (game.eliminated && game.eliminated[playerId])) return;
    const segmentElapsedMs = Math.max(0, buzzAt - startedAt);
    const totalElapsedMs = Math.max(0, Number(elapsedMs) || 0) + segmentElapsedMs;
    const now = Date.now();
    const question = qataraQuestion(game);
    if (!question) return;
    game.phase = 'answering';
    game.claim = {
      playerId,
      deadline:now + QATARA_ANSWER_SECONDS * 1000,
      elapsedMs:totalElapsedMs,
      visibleWords:Math.min(question.question.split(/\s+/).length, Math.max(0, Number(baseWords) || 0) + Math.floor(segmentElapsedMs / 1000)),
      points:qataraPoints(totalElapsedMs)
    };
    return game;
  }).catch(error => console.error('Could not claim the Qatara question:', error));
};

window.qataraSubmitAnswer = function(code, playerId){
  const input = document.getElementById('qataraAnswerInput');
  const answer = input?.value.trim();
  const status = document.getElementById('qataraAnswerStatus');
  const submitButton = document.getElementById('qataraSubmitButton');
  if (!answer) {
    if (status) status.textContent = 'اكتب إجابتك أولًا.';
    return;
  }
  if (input) input.disabled = true;
  if (submitButton) submitButton.disabled = true;
  db.ref(`rooms/${code}/qatara`).transaction(game => {
    if (!game || game.phase !== 'answering' || game.claim?.playerId !== playerId ||
        game.answerText || Date.now() > game.claim.deadline) return;
    game.answerText = answer.slice(0, 120);
    return game;
  }).then(result => {
    if (!result.committed && status) status.textContent = 'انتهى وقت الإجابة أو تم إغلاق السؤال.';
  }).catch(error => {
    console.error('Could not submit the Qatara answer:', error);
    if (status) status.textContent = 'تعذر إرسال الإجابة. تحقق من الاتصال.';
    if (input) input.disabled = false;
    if (submitButton) submitButton.disabled = false;
  });
};

function resolveQataraAnswer(code){
  const gameRef = db.ref(`rooms/${code}/qatara`);
  gameRef.transaction(current => {
    if (!current || current.phase !== 'answering' || !current.claim) return;
    const now = Date.now();
    const timedOut = !current.answerText && now >= current.claim.deadline;
    if (!current.answerText && !timedOut) return;
    const question = qataraQuestion(current);
    if (!question) return;
    const playerId = current.claim.playerId;
    const acceptedAnswers = question.answers || [question.answer];
    const correct = !timedOut && acceptedAnswers.some(answer => normalizeAr(current.answerText) === normalizeAr(answer));
    const scores = {...(current.scores || {})};
    const lastAttempt = {
      playerId,
      correct,
      timedOut,
      answerText:timedOut ? '' : current.answerText
    };
    if (correct) {
      scores[playerId] = (Number(scores[playerId]) || 0) + current.claim.points;
      current.scores = scores;
      current.phase = 'won';
      current.winner = playerId;
      current.lastAttempt = {...lastAttempt, points:current.claim.points};
      delete current.claim;
      delete current.answerText;
      return current;
    }

    scores[playerId] = (Number(scores[playerId]) || 0) - QATARA_WRONG_PENALTY;
    const eliminated = {...(current.eliminated || {}), [playerId]:true};
    const everyoneEliminated = (current.participantIds || []).every(id => eliminated[id]);
    current.scores = scores;
    current.eliminated = eliminated;
    current.lastAttempt = {...lastAttempt, points:-QATARA_WRONG_PENALTY};
    current.phase = everyoneEliminated ? 'revealed' : 'reading';
    current.baseWords = current.claim.visibleWords;
    current.elapsedMs = current.claim.elapsedMs;
    current.startedAt = now;
    delete current.claim;
    delete current.answerText;
    return current;
  }).catch(error => console.error('Could not resolve the Qatara answer:', error));
}

window.qataraRevealAnswer = function(code){
  db.ref(`rooms/${code}/qatara`).transaction(game => {
    const question = qataraQuestion(game);
    if (!game || !question || game.phase !== 'reading' ||
        qataraVisibleWords(game, question).length < question.question.split(/\s+/).length) return;
    game.phase = 'revealed';
    return game;
  }).catch(error => console.error('Could not reveal the Qatara answer:', error));
};

window.qataraNextQuestion = function(code){
  db.ref(`rooms/${code}/qatara`).transaction(game => {
    if (!game || !['won','revealed'].includes(game.phase)) return;
    const nextIndex = game.questionIndex + 1;
    if (nextIndex >= game.questionOrder.length) {
      game.phase = 'done';
      return game;
    }
    game.phase = 'reading';
    game.questionIndex = nextIndex;
    game.eliminated = {};
    game.lastAttempt = null;
    game.baseWords = 1;
    game.elapsedMs = 0;
    game.startedAt = Date.now();
    delete game.winner;
    return game;
  }).catch(error => console.error('Could not advance the Qatara game:', error));
};

window.stopQataraHostWatch = function(){
  if (qataraHostInterval) {
    clearInterval(qataraHostInterval);
    qataraHostInterval = null;
  }
};

window.stopQataraPlayerWatch = function(){
  if (qataraPlayerInterval) {
    clearInterval(qataraPlayerInterval);
    qataraPlayerInterval = null;
  }
};

function qataraLeaderboardHtml(room, game){
  const ranked = [...(game.participantIds || [])].sort((a,b) =>
    (Number(game.scores?.[b]) || 0) - (Number(game.scores?.[a]) || 0)
  );
  const topScore = Number(game.scores?.[ranked[0]]) || 0;
  let previousScore = null, previousRank = 0;
  const rows = ranked.map((id,index) => {
    const score = Number(game.scores?.[id]) || 0;
    const rank = score === previousScore ? previousRank : index+1;
    previousScore = score;
    previousRank = rank;
    return `<article class="qatara-rank-card ${score===topScore?'is-leading':''}">
      <span class="qatara-rank-number">${rank}</span>
      <strong>${escapeHtml(room.players?.[id]?.name || 'لاعب')}</strong>
      <span class="qatara-rank-score">${score}<small>نقطة</small></span>
    </article>`;
  }).join('');
  return `<section class="qatara-leaderboard"><h2>الترتيب</h2><div class="qatara-ranking-grid">${rows}</div></section>`;
}

function renderQataraHost(code, room){
  const game = room.qatara;
  if (!game) return;
  window.stopQataraHostWatch();
  const question = qataraQuestion(game);
  const questionNumber = game.questionIndex + 1;
  let content = '';

  if (game.phase === 'reading' && question) {
    const words = qataraVisibleWords(game, question);
    const complete = words.length === question.question.split(/\s+/).length;
    const attempt = game.lastAttempt;
    const attemptMessage = attempt
      ? `<p class="qatara-feedback is-wrong">${escapeHtml(room.players?.[attempt.playerId]?.name || 'لاعب')} ${attempt.timedOut ? 'انتهى وقته' : `أجاب «${escapeHtml(attempt.answerText)}» وهي إجابة خاطئة`} · خصم ${QATARA_WRONG_PENALTY} نقاط</p>`
      : '';
    content = `<div class="qatara-question-display" id="qataraQuestionWords" aria-live="polite">${words.map(escapeHtml).join(' ')}</div>
      ${attemptMessage}
      <button class="btn" id="qataraRevealButton" ${complete ? '' : 'disabled'} onclick="qataraRevealAnswer('${code}')">كشف الإجابة والانتقال</button>
      <p class="muted" id="qataraReadingHint">${complete ? 'اكتمل كشف السؤال.' : 'يُكشف السؤال تدريجيًا — اضغطوا من الجوال عند معرفة الإجابة.'}</p>`;
  } else if (game.phase === 'answering') {
    const playerName = escapeHtml(room.players?.[game.claim?.playerId]?.name || 'لاعب');
    const remaining = Math.max(0, Math.ceil(((game.claim?.deadline || Date.now()) - Date.now()) / 1000));
    const pausedQuestion = question?.question.split(/\s+/).slice(0, game.claim?.visibleWords || 0).map(escapeHtml).join(' ') || '';
    content = `<div class="qatara-question-display">${pausedQuestion}</div>
      <h2 class="qatara-status-title">${playerName} يكتب إجابته</h2>
      <div class="qatara-countdown" id="qataraHostCountdown">${remaining}</div>
      <p class="muted">${game.answerText ? 'وصلت الإجابة، جارٍ التحقق منها.' : 'المهلة 10 ثوانٍ فقط.'}</p>`;
  } else if (game.phase === 'won') {
    const playerName = escapeHtml(room.players?.[game.winner]?.name || 'لاعب');
    content = `${winnerCelebrationHtml()}<div class="qatara-question-display">${escapeHtml(question?.question || '')}</div>
      <p class="qatara-feedback is-correct">إجابة صحيحة! ${playerName} يكسب ${game.lastAttempt?.points || 0} نقاط.</p>
      <p class="qatara-answer-reveal">الإجابة: ${escapeHtml(question?.answer || '')}</p>
      <button class="btn" onclick="qataraNextQuestion('${code}')">السؤال التالي</button>`;
  } else if (game.phase === 'revealed') {
    const lastAttempt = game.lastAttempt;
    const attemptMessage = lastAttempt
      ? `<p class="qatara-feedback is-wrong">${escapeHtml(room.players?.[lastAttempt.playerId]?.name || 'لاعب')} ${lastAttempt.timedOut ? 'انتهى وقته' : 'أجاب إجابة خاطئة'} · خصم ${QATARA_WRONG_PENALTY} نقاط</p>`
      : '';
    content = `<div class="qatara-question-display">${escapeHtml(question?.question || '')}</div>
      ${attemptMessage}
      <p class="qatara-answer-reveal">الإجابة الصحيحة: ${escapeHtml(question?.answer || '')}</p>
      <button class="btn" onclick="qataraNextQuestion('${code}')">السؤال التالي</button>`;
  } else if (game.phase === 'done') {
    const ranking = [...(game.participantIds || [])].sort((a,b) => (Number(game.scores?.[b]) || 0) - (Number(game.scores?.[a]) || 0));
    const topScore = Number(game.scores?.[ranking[0]]) || 0;
    const winners = ranking.filter(id => (Number(game.scores?.[id]) || 0) === topScore);
    content = `${winners.length===1?winnerCelebrationHtml():''}<h2 class="qatara-status-title">انتهت الأسئلة!</h2>
      <p class="qatara-feedback is-correct">${winners.map(id => escapeHtml(room.players?.[id]?.name || 'لاعب')).join('، ')} ${winners.length > 1 ? 'يتعادلون' : 'يفوز'} بـ ${topScore} نقطة.</p>`;
  }

  const stage = document.getElementById('stage');
  if (!stage) return;
  stage.innerHTML = `<div class="qatara-wrap">
    ${activityExitControlsHtml(code,'qatara')}
    <header class="qatara-header"><span class="host-section-kicker">سؤال القَطّارة · السؤال ${Math.min(questionNumber, 10)} من 10</span></header>
    ${content}
    ${qataraLeaderboardHtml(room, game)}
  </div>`;

  qataraHostInterval = setInterval(() => {
    if (game.phase === 'answering') {
      if (game.answerText || Date.now() >= (game.claim?.deadline || 0)) {
        resolveQataraAnswer(code);
        return;
      }
      const countdown = document.getElementById('qataraHostCountdown');
      if (countdown) countdown.textContent = String(Math.max(0, Math.ceil((game.claim.deadline - Date.now()) / 1000)));
    } else if (game.phase === 'reading' && question) {
      const words = qataraVisibleWords(game, question);
      const complete = words.length === question.question.split(/\s+/).length;
      const display = document.getElementById('qataraQuestionWords');
      const revealButton = document.getElementById('qataraRevealButton');
      const hint = document.getElementById('qataraReadingHint');
      if (display) display.textContent = words.join(' ');
      if (revealButton) revealButton.disabled = !complete;
      if (hint) hint.textContent = complete ? 'اكتمل كشف السؤال.' : 'يُكشف السؤال تدريجيًا — اضغطوا من الجوال عند معرفة الإجابة.';
    }
  }, 200);
}

function renderQataraPlayer(code, playerId, name, room){
  const game = room.qatara;
  if (!game) return;
  window.stopQataraPlayerWatch();
  const isParticipant = (game.participantIds || []).includes(playerId);
  const eliminated = !!game.eliminated?.[playerId];
  const question = qataraQuestion(game);
  let content = '';

  if (!isParticipant) {
    content = `<h2>تابع شاشة المضيف</h2><p class="muted">بدأ السؤال قبل انضمامك؛ يمكنك متابعة الجولة.</p>`;
  } else if (game.phase === 'reading') {
    content = eliminated
      ? `<h2>انتهت محاولتك لهذا السؤال</h2><p class="muted">تُخصم 5 نقاط، ويمكنك المحاولة من جديد مع السؤال التالي.</p>`
      : `<button class="qatara-buzz-button" type="button" onclick="qataraBuzz('${code}','${playerId}',${game.questionIndex},${game.startedAt},${Number(game.baseWords) || 0},${Number(game.elapsedMs) || 0})">عرفتها!</button>`;
  } else if (game.phase === 'answering' && game.claim?.playerId === playerId) {
    const remaining = Math.max(0, Math.ceil((game.claim.deadline - Date.now()) / 1000));
    const submitted = !!game.answerText;
    content = `<h2>اكتب إجابتك الآن</h2>
      <div class="qatara-countdown" id="qataraPlayerCountdown">${remaining}</div>
      <form class="qatara-answer-form" onsubmit="event.preventDefault();qataraSubmitAnswer('${code}','${playerId}')">
        <input type="text" id="qataraAnswerInput" maxlength="120" placeholder="إجابتك" autocomplete="off" ${submitted ? 'disabled' : 'autofocus'} value="${escapeHtml(game.answerText || '')}">
        <button class="btn" id="qataraSubmitButton" type="submit" ${submitted ? 'disabled' : ''}>${submitted ? 'تم إرسال الإجابة' : 'إرسال الإجابة'}</button>
        <p class="muted" id="qataraAnswerStatus">${submitted ? 'وصلت إجابتك، انتظر النتيجة.' : 'لديك 10 ثوانٍ فقط.'}</p>
      </form>`;
  } else if (game.phase === 'answering') {
    content = `<h2>سبقك لاعب آخر!</h2><p class="muted">يكتب ${escapeHtml(room.players?.[game.claim?.playerId]?.name || 'لاعب')} إجابته الآن.</p>`;
  } else if (game.phase === 'won') {
    content = `${winnerCelebrationHtml()}<h2>${game.winner === playerId ? 'إجابة صحيحة!' : 'أجاب لاعب آخر إجابة صحيحة'}</h2>
      <p class="qatara-answer-reveal">${escapeHtml(question?.answer || '')}</p>`;
  } else if (game.phase === 'revealed') {
    const wasEliminated = game.lastAttempt?.playerId === playerId;
    content = `${wasEliminated ? '<p class="qatara-feedback is-wrong">انتهت محاولتك، وخُصم 5 نقاط.</p>' : '<h2>الإجابة الصحيحة</h2>'}
      <p class="qatara-answer-reveal">${escapeHtml(question?.answer || '')}</p>`;
  } else if (game.phase === 'done') {
    const ranking = [...(game.participantIds || [])].sort((a,b) => (Number(game.scores?.[b]) || 0) - (Number(game.scores?.[a]) || 0));
    const winner = ranking.length > 1 && (Number(game.scores?.[ranking[0]]) || 0) !== (Number(game.scores?.[ranking[1]]) || 0);
    content = `${winner?winnerCelebrationHtml():''}<h2>انتهت اللعبة</h2><p class="muted">شاهد النتيجة النهائية على شاشة المضيف.</p>`;
  }

  app.innerHTML = `<div class="phone qatara-phone"><div class="card qatara-player-card">
    <span class="host-section-kicker">سؤال القَطّارة</span>
    ${content}
    ${game.phase !== 'answering' ? `<p class="qatara-player-score">${escapeHtml(name)} · ${Number(game.scores?.[playerId]) || 0} نقطة</p>` : ''}
  </div></div>`;

  if (game.phase === 'answering' && game.claim?.playerId === playerId) {
    qataraPlayerInterval = setInterval(() => {
      const countdown = document.getElementById('qataraPlayerCountdown');
      if (countdown) countdown.textContent = String(Math.max(0, Math.ceil((game.claim.deadline - Date.now()) / 1000)));
    }, 100);
  }
}
