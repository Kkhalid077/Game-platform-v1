/* =====================================================================
   SECTION 6 — MAFIA MODULE
   ===================================================================== */
function assignMafiaRoles(ids){
  const n = ids.length;
  const shuffled = shuffle(ids);
  const mafiaCount = Math.max(1, Math.floor(n/4));
  const roles = {};
  let i = 0;
  for (let k=0;k<mafiaCount;k++) roles[shuffled[i++]] = 'mafia';
  if (n>=5) roles[shuffled[i++]] = 'police';
  if (n>=6) roles[shuffled[i++]] = 'doctor';
  while (i<n) roles[shuffled[i++]] = 'citizen';
  return roles;
}

window.startMafiaGame = function(code){
  const roomRef = db.ref('rooms/'+code);
  roomRef.child('players').once('value', snap => {
    const players = snap.val() || {};
    const ids = Object.keys(players);
    if (ids.length < 4) { alert('تحتاج 4 لاعبين على الأقل لبدء لعبة المافيا'); return; }
    const roles = assignMafiaRoles(ids);
    const alive = {}; ids.forEach(id => alive[id] = true);
    roomRef.update({
      status:'in_game', activeGame:'mafia',
      mafia:{ phase:'role_reveal', roles, alive, round:1,
        nightVotes:{}, policeResults:{}, dayVotes:{},
        lastNightVictim:null, lastDayEliminated:null, winner:null }
    });
  });
};

window.mafiaNext = function(code, action){
  const mRef = db.ref('rooms/'+code+'/mafia');
  mRef.once('value', snap => {
    const m = snap.val(); if (!m) return;
    if (action==='to_police') mRef.update({ phase:'night_police' });
    else if (action==='to_doctor') mRef.update({ phase:'night_doctor' });
    else if (action==='to_night') mRef.update({ phase:'night_mafia' });
    else if (action==='reveal'){
      const mVotes = (m.nightVotes && m.nightVotes.mafia) || {};
      const tally = {};
      Object.values(mVotes).forEach(t => tally[t]=(tally[t]||0)+1);
      let victim=null, max=0;
      Object.entries(tally).forEach(([id,c]) => { if (c>max){max=c; victim=id;} });
      const protectedId = m.nightVotes && m.nightVotes.doctorTarget;
      const alive = {...m.alive};
      let died = null;
      if (victim && victim !== protectedId) { alive[victim]=false; died=victim; }
      mRef.update({ alive, lastNightVictim: died, phase:'reveal' }).then(()=>checkMafiaWin(code));
    }
    else if (action==='to_discussion') mRef.update({ phase:'discussion' });
    else if (action==='to_voting') mRef.update({ phase:'voting', dayVotes:{} });
    else if (action==='reveal_vote'){
      const dv = m.dayVotes || {};
      const tally = {};
      Object.values(dv).forEach(t => { if (t!=='abstain') tally[t]=(tally[t]||0)+1; });
      let top=null, max=0, tie=false;
      Object.entries(tally).forEach(([id,c]) => {
        if (c>max){ max=c; top=id; tie=false; } else if (c===max){ tie=true; }
      });
      const alive = {...m.alive};
      let eliminated=null;
      if (top && !tie) { alive[top]=false; eliminated=top; }
      mRef.update({ alive, lastDayEliminated: eliminated, phase:'vote_reveal' }).then(()=>checkMafiaWin(code));
    }
    else if (action==='to_next_round') mRef.update({ phase:'night_mafia', round:(m.round||1)+1, nightVotes:{} });
  });
};

function checkMafiaWin(code){
  const mRef = db.ref('rooms/'+code+'/mafia');
  mRef.once('value', snap => {
    const m = snap.val(); if (!m) return;
    const aliveIds = Object.keys(m.alive).filter(id=>m.alive[id]);
    const aliveMafia = aliveIds.filter(id=>m.roles[id]==='mafia').length;
    const aliveOthers = aliveIds.length - aliveMafia;
    if (aliveMafia===0) mRef.update({ phase:'ended', winner:'citizens' });
    else if (aliveMafia>=aliveOthers) mRef.update({ phase:'ended', winner:'mafia' });
  });
}

window.mafiaVote = function(code, myId, targetId){ db.ref('rooms/'+code+'/mafia/nightVotes/mafia/'+myId).set(targetId); };
window.doctorProtect = function(code, targetId){ db.ref('rooms/'+code+'/mafia/nightVotes/doctorTarget').set(targetId); };
window.dayVote = function(code, myId, targetId){ db.ref('rooms/'+code+'/mafia/dayVotes/'+myId).set(targetId); };
window.policeInvestigate = function(code, myId, targetId){
  const mRef = db.ref('rooms/'+code+'/mafia');
  mRef.once('value', snap => {
    const m = snap.val();
    const isMafia = m.roles[targetId] === 'mafia';
    mRef.child('policeResults/'+myId).set({ targetId, isMafia, round: m.round });
  });
};

function renderMafiaHost(code, room){
  const m = room.mafia; if (!m) return;
  const players = room.players || {};
  const aliveIds = Object.keys(m.alive||{}).filter(id=>m.alive[id]);
  let narrator = '', control = '';

  if (m.phase==='role_reveal'){
    narrator = 'كل لاعب يشاهد بطاقة دوره الآن على جواله. تأكد الجميع رأوا أدوارهم.';
    control = `<button class="btn" onclick="mafiaNext('${code}','to_night')">ابدأ الجولة الأولى 🌙</button>`;
  } else if (m.phase==='night_mafia'){
    const v = Object.keys((m.nightVotes&&m.nightVotes.mafia)||{}).length;
    narrator = `الجولة ${m.round} — اطلب من الجميع إغلاق أعينهم. المافيا يختارون ضحيتهم (${v} صوّتوا).`;
    control = `<button class="btn" onclick="mafiaNext('${code}','to_police')">التالي: دور الشرطي 👮</button>`;
  } else if (m.phase==='night_police'){
    narrator = 'الشرطي يختار الآن شخصًا للتحقيق معه.';
    control = `<button class="btn" onclick="mafiaNext('${code}','to_doctor')">التالي: دور الطبيب ⚕️</button>`;
  } else if (m.phase==='night_doctor'){
    narrator = 'الطبيب يختار الآن شخصًا ليحميه.';
    control = `<button class="btn" onclick="mafiaNext('${code}','reveal')">كشف نتيجة الليل 🔦</button>`;
  } else if (m.phase==='reveal'){
    narrator = m.lastNightVictim ? `💀 قُتل الليلة: ${escapeHtml(players[m.lastNightVictim]?.name||'')}` : '✅ نجا الجميع الليلة!';
    control = `<button class="btn" onclick="mafiaNext('${code}','to_discussion')">ابدأ النقاش 🗣️</button>`;
  } else if (m.phase==='discussion'){
    narrator = 'افتحوا أعينكم! كل شخص يتكلم مرة واحدة الآن، ثم انتقل للتصويت.';
    control = `<button class="btn" onclick="mafiaNext('${code}','to_voting')">ابدأ التصويت 🗳️</button>`;
  } else if (m.phase==='voting'){
    const v = Object.keys(m.dayVotes||{}).length;
    narrator = `التصويت جارٍ (${v}/${aliveIds.length} صوّتوا).`;
    control = `<button class="btn" onclick="mafiaNext('${code}','reveal_vote')">إعلان نتيجة التصويت</button>`;
  } else if (m.phase==='vote_reveal'){
    narrator = m.lastDayEliminated
      ? `🚪 تم إخراج: ${escapeHtml(players[m.lastDayEliminated]?.name||'')} (${ROLE_META[m.roles[m.lastDayEliminated]].name})`
      : '🤝 تعادل الأصوات — لم يخرج أحد.';
    control = `<button class="btn" onclick="mafiaNext('${code}','to_next_round')">الجولة التالية 🌙</button>`;
  } else if (m.phase==='ended'){
    narrator = m.winner==='mafia' ? '🔪 فازت المافيا!' : '🎉 فاز المواطنون!';
    control = `<button class="btn" onclick="resetToLobby('${code}')">لعبة جديدة 🔁</button>`;
  }

  const rolesHtml = Object.keys(players).map(id => {
    const dead = !m.alive[id];
    const rm = ROLE_META[m.roles[id]];
    return `<span class="chip ${dead?'dead':''}">${escapeHtml(players[id].name)} — ${rm?rm.icon+' '+rm.name:''}</span>`;
  }).join('');

  document.getElementById('stage').innerHTML = `
    <div style="margin-bottom:15px;">
      <button class="btn btn-danger" onclick="resetToLobby('${code}')">🛑 إنهاء اللعبة والعودة للوحة التحكم</button>
    </div>
    <h2 style="font-family:'Cairo'; color:var(--accent);">من هم المافيا؟ 🕵️</h2>
    <p class="narrator">${narrator}</p>
    ${control}
    <div class="players-box">
      <h3 style="font-family:'Cairo'; font-size:14px; color:var(--text-dim);">شاشة الحكم — كل الأدوار</h3>
      <div>${rolesHtml}</div>
    </div>
  `;
}

function renderMafiaPlayer(code, myId, name, room){
  const m = room.mafia; if (!m) return;
  const players = room.players || {};
  const myRole = m.roles[myId];
  const rm = ROLE_META[myRole];
  const iAmAlive = !!m.alive[myId];
  const aliveIds = Object.keys(m.alive||{}).filter(id=>m.alive[id]);

  const roleCard = `
    <div class="role-card ${rm.cls}">
      <div class="role-icon">${rm.icon}</div>
      <div class="role-name">${rm.name}</div>
      <div class="role-desc">${rm.desc}</div>
    </div>`;

  if (!iAmAlive){
    app.innerHTML = `<div class="phone"><div class="card">
      <h2 style="font-family:'Cairo';">💀 خرجت من اللعبة</h2>
      ${roleCard}
      <p class="muted">شاهد شاشة الحكم لمتابعة اللعبة.</p>
    </div></div>`;
    return;
  }

  if (m.phase==='role_reveal'){
    let extra = '';
    if (myRole==='mafia'){
      const mates = Object.keys(m.roles).filter(id=>m.roles[id]==='mafia' && id!==myId).map(id=>players[id]?.name).filter(Boolean);
      if (mates.length) extra = `<p class="muted">زملاؤك بالمافيا: ${mates.map(escapeHtml).join('، ')}</p>`;
    }
    app.innerHTML = `<div class="phone"><div class="card">${roleCard}${extra}<p class="muted">بانتظار بدء الحكم للجولة الأولى…</p></div></div>`;

  } else if (m.phase==='night_mafia'){
    if (myRole==='mafia'){
      const myVote = (m.nightVotes && m.nightVotes.mafia && m.nightVotes.mafia[myId]) || null;
      const targets = aliveIds.filter(id=>id!==myId && m.roles[id]!=='mafia');
      app.innerHTML = `<div class="phone"><div class="card">
        <h2 style="font-family:'Cairo';">🔪 اختر ضحية</h2>
        <div class="target-list">${targets.map(id=>`
          <button class="target-btn ${myVote===id?'picked':''}" onclick="mafiaVote('${code}','${myId}','${id}')">${escapeHtml(players[id].name)}</button>
        `).join('')}</div>
        ${myVote ? '<p class="muted">تم التصويت ✓ يمكنك تغيير رأيك</p>' : ''}
      </div></div>`;
    } else {
      app.innerHTML = `<div class="phone"><div class="card"><h2 style="font-family:'Cairo';">🌙 أغلق عينيك</h2><p class="muted">الجميع نائمون الآن…</p></div></div>`;
    }

  } else if (m.phase==='night_police'){
    if (myRole==='police'){
      const myResult = m.policeResults && m.policeResults[myId] && m.policeResults[myId].round===m.round ? m.policeResults[myId] : null;
      const targets = aliveIds.filter(id=>id!==myId);
      app.innerHTML = `<div class="phone"><div class="card">
        <h2 style="font-family:'Cairo';">👮 اختر من تحقق معه</h2>
        <div class="target-list">${targets.map(id=>`
          <button class="target-btn ${myResult && myResult.targetId===id?'picked':''}" onclick="policeInvestigate('${code}','${myId}','${id}')">${escapeHtml(players[id].name)}</button>
        `).join('')}</div>
        ${myResult ? `<p class="muted" style="font-size:16px; font-weight:700;">${escapeHtml(players[myResult.targetId].name)}${myResult.isMafia ? 'هو من المافيا 🔴' : 'ليس من المافيا 🟢'}</p>` : ''}
      </div></div>`;
    } else {
      app.innerHTML = `<div class="phone"><div class="card"><h2 style="font-family:'Cairo';">🌙 أغلق عينيك</h2><p class="muted">الشرطي يحقق الآن…</p></div></div>`;
    }

  } else if (m.phase==='night_doctor'){
    if (myRole==='doctor'){
      const myProtect = m.nightVotes && m.nightVotes.doctorTarget;
      app.innerHTML = `<div class="phone"><div class="card">
        <h2 style="font-family:'Cairo';">⚕️ اختر من تحميه</h2>
        <div class="target-list">${aliveIds.map(id=>`
          <button class="target-btn ${myProtect===id?'picked':''}" onclick="doctorProtect('${code}','${id}')">${escapeHtml(players[id].name)}${id===myId?' (أنت)':''}</button>
        `).join('')}</div>
      </div></div>`;
    } else {
      app.innerHTML = `<div class="phone"><div class="card"><h2 style="font-family:'Cairo';">🌙 أغلق عينيك</h2><p class="muted">الطبيب يحمي أحدهم الآن…</p></div></div>`;
    }

  } else if (m.phase==='reveal'){
    const txt = m.lastNightVictim ? `💀 ${escapeHtml(players[m.lastNightVictim]?.name||'')} قُتل الليلة` : '✅ نجا الجميع الليلة!';
    app.innerHTML = `<div class="phone"><div class="card"><h2 style="font-family:'Cairo';">${txt}</h2><p class="muted">استعد للنقاش…</p></div></div>`;

  } else if (m.phase==='discussion'){
    app.innerHTML = `<div class="phone"><div class="card"><h2 style="font-family:'Cairo';">🗣️ وقت النقاش</h2><p class="muted">تكلم عندما يأتي دورك. سيبدأ التصويت قريبًا.</p></div></div>`;

  } else if (m.phase==='voting'){
    const myVote = m.dayVotes && m.dayVotes[myId];
    const targets = aliveIds.filter(id=>id!==myId);
    app.innerHTML = `<div class="phone"><div class="card">
      <h2 style="font-family:'Cairo';">🗳️ صوّت لإخراج أحد</h2>
      <div class="target-list">
        ${targets.map(id=>`<button class="target-btn ${myVote===id?'picked':''}" onclick="dayVote('${code}','${myId}','${id}')">${escapeHtml(players[id].name)}</button>`).join('')}
        <button class="target-btn ${myVote==='abstain'?'picked':''}" onclick="dayVote('${code}','${myId}','abstain')">امتناع عن التصويت</button>
      </div>
    </div></div>`;

  } else if (m.phase==='vote_reveal'){
    const txt = m.lastDayEliminated ? `🚪 تم إخراج ${escapeHtml(players[m.lastDayEliminated]?.name||'')}` : '🤝 تعادل — لم يخرج أحد';
    app.innerHTML = `<div class="phone"><div class="card"><h2 style="font-family:'Cairo';">${txt}</h2><p class="muted">الجولة التالية تبدأ قريبًا…</p></div></div>`;

  } else if (m.phase==='ended'){
    const allRoles = Object.keys(players).map(id=>`${escapeHtml(players[id].name)}: ${ROLE_META[m.roles[id]].icon} ${ROLE_META[m.roles[id]].name}`).join('<br>');
    app.innerHTML = `<div class="phone"><div class="card">
      <h2 style="font-family:'Cairo';">${m.winner==='mafia' ? '🔪 فازت المافيا!' : '🎉 فاز المواطنون!'}</h2>
      <p class="muted">${allRoles}</p>
    </div></div>`;
  }
}
