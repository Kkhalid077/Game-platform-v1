const LETTER_CELL_ALPHABET = Array.from('ابتثجحخدذرزسشصضطظعغفقكلمنهوي');
const LETTER_CELL_DEFAULT_SETTINGS = {
  rounds:5,
  cellCount:25,
  teamNames:{A:'الفريق الأخضر',B:'الفريق البرتقالي'},
  teamColors:{A:'#2ee6a6',B:'#ff6b8b'}
};
let LETTER_CELL_QUESTIONS = null;
let letterCellQuestionLoad = null;
const letterCellCurrentQuestions = new Map();
const letterCellUsedQuestionIds = new Set();
let letterCellDisplayRef = null;

function letterCellNormalizeLetter(value){
  return normalizeAr(value).charAt(0);
}

function letterCellQuestionKey(group,question){
  return `${group}:${question.id}`;
}

function letterCellQuestionsFor(letter){
  if(!LETTER_CELL_QUESTIONS)return [];
  const normalized=letterCellNormalizeLetter(letter);
  return Object.entries(LETTER_CELL_QUESTIONS)
    .filter(([group])=>letterCellNormalizeLetter(group)===normalized)
    .flatMap(([group,questions])=>questions.map(question=>({group,question,key:letterCellQuestionKey(group,question)})));
}

function letterCellPickQuestion(letter,excludeKey=null){
  const candidates=letterCellQuestionsFor(letter).filter(item=>item.key!==excludeKey);
  if(!candidates.length)return null;
  const fresh=candidates.filter(item=>!letterCellUsedQuestionIds.has(item.key));
  const selected=shuffle(fresh.length?fresh:candidates)[0];
  letterCellUsedQuestionIds.add(selected.key);
  return selected;
}

function letterCellHostQuestionKey(code,cellId){
  return `${code}:${cellId}`;
}

function letterCellGetHostQuestion(code,cellId){
  const key=letterCellHostQuestionKey(code,cellId);
  if(letterCellCurrentQuestions.has(key))return letterCellCurrentQuestions.get(key).question;
  try{
    const saved=JSON.parse(sessionStorage.getItem(`letter-cell-question:${key}`)||'null');
    if(saved?.question&&typeof saved.question.question==='string'&&typeof saved.question.answer==='string'){
      letterCellCurrentQuestions.set(key,saved);
      return saved.question;
    }
  }catch(error){
    console.warn('Could not restore the private Letter Cell question:',error);
  }
  return null;
}

function letterCellStoreHostQuestion(code,cellId,selected){
  const key=letterCellHostQuestionKey(code,cellId);
  letterCellCurrentQuestions.set(key,selected);
  try{
    sessionStorage.setItem(`letter-cell-question:${key}`,JSON.stringify(selected));
  }catch(error){
    console.warn('Could not preserve the private Letter Cell question for this tab:',error);
  }
}

function letterCellClearHostQuestions(code){
  letterCellCurrentQuestions.clear();
  letterCellUsedQuestionIds.clear();
  try{
    const prefix=`letter-cell-question:${code}:`;
    for(let index=sessionStorage.length-1;index>=0;index--){
      const key=sessionStorage.key(index);
      if(key?.startsWith(prefix))sessionStorage.removeItem(key);
    }
  }catch(error){
    console.warn('Could not clear saved Letter Cell questions for this tab:',error);
  }
}

function letterCellRefreshHost(code){
  db.ref(`rooms/${code}`).once('value').then(snapshot=>{
    const room=snapshot.val();
    if(room?.status==='in_game'&&room.activeGame==='letter-cell'){lastHostRoom=room;renderLetterCellHost(code,room);}
  }).catch(error=>console.error('Could not refresh the Letter Cell host view:',error));
}

function letterCellMakeBoard(count){
  return shuffle(LETTER_CELL_ALPHABET).slice(0,count).map((letter,index)=>({
    id:String(index),
    letter,
    owner:null
  }));
}

function letterCellInitialState(){
  return {
    phase:'setup',
    settings:JSON.parse(JSON.stringify(LETTER_CELL_DEFAULT_SETTINGS)),
    cells:letterCellMakeBoard(LETTER_CELL_DEFAULT_SETTINGS.cellCount),
    roundsCompleted:0,
    selectedCell:null
  };
}

function letterCellSettings(game){
  const settings=game?.settings||{};
  return {
    rounds:Math.min(30,Math.max(1,Number(settings.rounds)||LETTER_CELL_DEFAULT_SETTINGS.rounds)),
    cellCount:Math.min(25,Math.max(5,Number(settings.cellCount)||LETTER_CELL_DEFAULT_SETTINGS.cellCount)),
    teamNames:{
      A:String(settings.teamNames?.A||LETTER_CELL_DEFAULT_SETTINGS.teamNames.A),
      B:String(settings.teamNames?.B||LETTER_CELL_DEFAULT_SETTINGS.teamNames.B)
    },
    teamColors:{
      A:/^#[0-9a-f]{6}$/i.test(settings.teamColors?.A||'')?settings.teamColors.A:LETTER_CELL_DEFAULT_SETTINGS.teamColors.A,
      B:/^#[0-9a-f]{6}$/i.test(settings.teamColors?.B||'')?settings.teamColors.B:LETTER_CELL_DEFAULT_SETTINGS.teamColors.B
    }
  };
}

function letterCellScore(game){
  const score={A:0,B:0};
  (game?.cells||[]).forEach(cell=>{if(cell.owner==='A'||cell.owner==='B')score[cell.owner]++;});
  return score;
}

function letterCellWinner(game){
  const scores=letterCellScore(game);
  return scores.A===scores.B?null:scores.A>scores.B?'A':'B';
}

function letterCellTeamHtml(team,settings,score){
  return `<article class="letter-cell-team" style="--letter-team-color:${settings.teamColors[team]}">
    <span>${escapeHtml(settings.teamNames[team])}</span><strong>${score[team]}</strong>
  </article>`;
}

function letterCellBoardHtml(game,interactive){
  const cells=Array.isArray(game.cells)?game.cells:[];
  const settings=letterCellSettings(game);
  const rows=[];
  for(let index=0;index<cells.length;index+=5)rows.push(cells.slice(index,index+5));
  return `<div class="letter-cell-board" role="group" aria-label="لوحة خلية الحروف">${rows.map((row,rowIndex)=>`
    <div class="letter-cell-board-row ${rowIndex%2?'is-offset':''}">${row.map(cell=>{
      const owner=cell.owner==='A'||cell.owner==='B'?cell.owner:null;
      const color=owner?settings.teamColors[owner]:'';
      const selected=game.selectedCell===cell.id;
      const classes=`letter-cell-tile ${selected?'is-selected':''} ${owner?'is-owned':''}`;
      const style=color?`--letter-team-color:${color}`:'';
      const content=`<span>${escapeHtml(cell.letter)}</span>`;
      if(!interactive)return `<div class="${classes}" style="${style}" aria-label="خلية حرف ${escapeHtml(cell.letter)}${selected?'، مختارة':''}">${content}</div>`;
      const disabled=game.phase!=='playing'||!!game.selectedCell||!!owner||game.roundsCompleted>=settings.rounds;
      return `<button type="button" class="${classes}" style="${style}" ${disabled?'disabled':''} onclick="letterCellSelectCell('${escapeHtml(ACTIVE_HOST_CODE)}','${escapeHtml(cell.id)}')" aria-label="اختيار الخلية ${escapeHtml(cell.letter)}">${content}</button>`;
    }).join('')}</div>`).join('')}</div>`;
}

function letterCellSettingsForm(game,code){
  const settings=letterCellSettings(game);
  if(game.phase!=='setup'){
    return `<div class="letter-cell-settings-summary">
      <p>الجولات: <strong>${settings.rounds}</strong></p>
      <p>الخلايا: <strong>${settings.cellCount}</strong></p>
      <p>${escapeHtml(settings.teamNames.A)} — ${escapeHtml(settings.teamNames.B)}</p>
    </div>`;
  }
  return `<form class="letter-cell-settings-form" onsubmit="event.preventDefault();saveLetterCellSettings('${escapeHtml(code)}')">
    <label>عدد الجولات<input id="letterCellRounds" type="number" min="1" max="30" value="${settings.rounds}" required></label>
    <label>عدد الخلايا<input id="letterCellCount" type="number" min="5" max="25" value="${settings.cellCount}" required></label>
    ${['A','B'].map(team=>`<fieldset class="letter-cell-team-settings" style="--letter-team-color:${settings.teamColors[team]}">
      <legend>${team==='A'?'الفريق الأول':'الفريق الثاني'}</legend>
      <label>اسم الفريق<input id="letterCellTeamName${team}" type="text" maxlength="24" value="${escapeHtml(settings.teamNames[team])}" required></label>
      <label>اللون<input id="letterCellTeamColor${team}" type="color" value="${settings.teamColors[team]}" aria-label="لون ${escapeHtml(settings.teamNames[team])}"></label>
    </fieldset>`).join('')}
    <button class="btn btn-ghost" type="submit">حفظ الإعدادات</button>
  </form>`;
}

function letterCellBuzzerStatus(room,game){
  const buzzer=room.buzzer||{};
  const winnerId=buzzer.winner;
  const player=winnerId?room.players?.[winnerId]:null;
  const team=player?.team;
  const settings=letterCellSettings(game);
  const winner=player
    ? `${escapeHtml(player.name||'لاعب')}${team?` — ${escapeHtml(settings.teamNames[team])}`:' — لم يختر فريقًا'}`
    : 'بانتظار ضغطة اللاعب الأول';
  const active=game.phase==='playing'&&!!game.selectedCell;
  return `<div class="letter-cell-buzzer-status ${player?'has-winner':''}">
    <span>${active?'أسرع لاعب':'الجرس غير نشط'}</span><strong>${winner}</strong>
  </div>
  <p class="letter-cell-hint">${active?'اختار المنظّم خلية. اقرأ سؤالًا تكون إجابته بحرفها.':'اختر خلية من اللوحة لتفعيل جرس اللاعبين.'}</p>`;
}

function renderLetterCellHost(code,room){
  const game=room.letterCell;
  if(!game){renderHostGenericPlaceholder(code,room);return;}
  const inviteUrl=joinGameUrl(code,'letter-cell');
  const settings=letterCellSettings(game);
  const scores=letterCellScore(game);
  const selected=Array.isArray(game.cells)?game.cells.find(cell=>cell.id===game.selectedCell):null;
  const question=selected?letterCellGetHostQuestion(code,selected.id):null;
  const finished=game.phase==='ended';
  app.innerHTML=`<div class="stage letter-cell-host-stage">
    ${activityExitControlsHtml(code,'letter-cell')}
    <main class="letter-cell-host">
      <header class="letter-cell-heading">
        <div><span class="host-section-kicker">لعبة جماعية</span><h1>خلية الحروف</h1></div>
        <div class="letter-cell-counters">
          <div class="letter-cell-scoreboard">${letterCellTeamHtml('A',settings,scores)}${letterCellTeamHtml('B',settings,scores)}</div>
          <div class="letter-cell-round-counter"><span>الجولة</span><strong>${Math.min(game.roundsCompleted+1,settings.rounds)}<i>/</i>${settings.rounds}</strong></div>
        </div>
      </header>
      <div class="letter-cell-layout">
        <div class="letter-cell-primary-column">
          <section class="letter-cell-panel letter-cell-board-panel">
            <div class="letter-cell-board-heading"><div><span class="host-section-kicker">لوحة اللعب</span><h2>اختر خلية</h2></div>
              <span class="letter-cell-round-count">الجولات المنتهية: ${game.roundsCompleted} / ${settings.rounds}</span>
            </div>
            <p class="letter-cell-hint">${game.phase==='setup'?'اضبط الإعدادات ثم اضغط «بدء الخلايا».':selected?'اقرأ السؤال للاعبين، ثم احتسب نتيجة الإجابة.':'اختر خلية لعرض سؤالها للمنظّم.'}</p>
            ${letterCellBoardHtml(game,true)}
            ${selected&&game.phase==='playing'?`<div class="letter-cell-round-controls">
              <button class="btn letter-cell-correct-button" type="button" ${room.buzzer?.winner&&room.players?.[room.buzzer.winner]?.team?'':'disabled'} onclick="letterCellFinishRound('${escapeHtml(code)}',true)">الإجابة صحيحة — احتساب الخلية</button>
              <button class="btn btn-ghost" type="button" onclick="letterCellFinishRound('${escapeHtml(code)}',false)">إجابة خاطئة / تجاوز</button>
            </div>`:''}
            ${finished?`<div class="letter-cell-result"><strong>${game.winner?`الفائز: ${escapeHtml(settings.teamNames[game.winner])}`:'انتهت اللعبة بالتعادل'}</strong>
              <button class="btn" type="button" onclick="letterCellRestart('${escapeHtml(code)}')">لعبة جديدة بالإعدادات نفسها</button></div>`:''}
          </section>
          <section class="letter-cell-panel letter-cell-question-panel" aria-label="سؤال الخلية للمنظّم">
            <span class="host-section-kicker">سؤال المنظّم فقط</span><h2>${selected?`سؤال حرف ${escapeHtml(selected.letter)}`:'السؤال'}</h2>
            ${selected&&question?`<p class="letter-cell-question-text">${escapeHtml(question.question)}</p>
              <details class="letter-cell-answer"><summary>إظهار الإجابة</summary><strong>${escapeHtml(question.answer)}</strong></details>
              ${question.contributor?`<small class="letter-cell-question-credit">المساهم: ${escapeHtml(question.contributor)}</small>`:''}
              <button class="btn btn-ghost letter-cell-replace-question" type="button" onclick="letterCellReplaceQuestion('${escapeHtml(code)}','${escapeHtml(selected.id)}')">استبدال السؤال</button>`
              :`<p class="letter-cell-question-empty">${selected?'لا يوجد سؤال متاح لهذا الحرف.':'اختر خلية لعرض سؤالها هنا.'}</p>`}
          </section>
        </div>
        <aside class="letter-cell-sidebar">
          <section class="letter-cell-panel letter-cell-settings-panel">
            <span class="host-section-kicker">إعدادات اللعبة</span><h2>الإعدادات</h2>
            ${letterCellSettingsForm(game,code)}
            ${game.phase==='setup'?`<button class="btn letter-cell-start-button" type="button" onclick="letterCellStartPlay('${escapeHtml(code)}')">بدء الخلايا</button>`:''}
          </section>
          <section class="letter-cell-panel letter-cell-buzzer-panel">
            <span class="host-section-kicker">جرس الإجابة</span><h2>دعوة لاعبي الجرس</h2>
            ${letterCellBuzzerStatus(room,game)}
            ${joinCardHtml('letterCellInvite',inviteUrl)}
            <div class="letter-cell-buzzer-controls">
              <button class="btn btn-ghost" type="button" onclick="letterCellToggleBuzzer('${escapeHtml(code)}')">${room.buzzer?.locked?'فتح الجرس':'قفل الجرس'}</button>
              <button class="btn btn-ghost" type="button" onclick="letterCellClearBuzzer('${escapeHtml(code)}')">إعادة ضبط الجرس</button>
            </div>
          </section>
          <section class="letter-cell-panel letter-cell-display-link">
            <span class="host-section-kicker">شاشة التلفاز</span><h2>عرض مستقل</h2>
            <a href="${escapeHtml(letterCellDisplayUrl(code))}" target="_blank" rel="noopener">فتح شاشة العرض</a>
            <small>افتح الرابط في متصفح التلفاز عبر Wi‑Fi أو انقله إلى شاشة HDMI ممتدة.</small>
          </section>
        </aside>
      </div>
    </main>
  </div>`;
  initJoinCard('letterCellInvite',inviteUrl);
}

function renderLetterCellPlayer(code,playerId,name,room){
  const game=room.letterCell;
  if(!game){app.innerHTML='<div class="phone"><div class="card"><h2>خلية الحروف</h2><p class="muted">بانتظار إعداد اللعبة من المنظّم.</p></div></div>';return;}
  const settings=letterCellSettings(game);
  const player=room.players?.[playerId]||{};
  const buzzer=room.buzzer||{};
  const selected=game.cells?.find(cell=>cell.id===game.selectedCell);
  const scores=letterCellScore(game);
  app.innerHTML=`<div class="phone letter-cell-player-screen"><main class="letter-cell-player">
    <span class="host-section-kicker">خلية الحروف</span><h1>أهلاً ${escapeHtml(name)}</h1>
    <div class="letter-cell-scoreboard">${letterCellTeamHtml('A',settings,scores)}${letterCellTeamHtml('B',settings,scores)}</div>
    <section class="letter-cell-player-team"><h2>اختر فريقك</h2><div>
      ${['A','B'].map(team=>`<button type="button" class="btn ${player.team===team?'':'btn-ghost'}" style="--letter-team-color:${settings.teamColors[team]}" aria-pressed="${player.team===team}" onclick="letterCellSetTeam('${escapeHtml(code)}','${escapeHtml(playerId)}','${team}')">${escapeHtml(settings.teamNames[team])}</button>`).join('')}
    </div><small>${player.team?`أنت في ${escapeHtml(settings.teamNames[player.team])}`:'اختر فريقًا قبل الضغط على الجرس.'}</small></section>
    <div class="letter-cell-player-round">${selected?`الخلية المختارة: <strong>${escapeHtml(selected.letter)}</strong>`:game.phase==='setup'?'بانتظار المنظّم لبدء اللعب':'بانتظار اختيار الخلية التالية'}</div>
    <button class="letter-cell-player-buzzer" type="button" ${game.phase!=='playing'||!selected||buzzer.locked||!!buzzer.winner||!player.team?'disabled':''} onclick="letterCellPressBuzzer('${escapeHtml(code)}','${escapeHtml(playerId)}')">اضغط للإجابة</button>
    <p class="letter-cell-player-status">${buzzer.winner===playerId?'أنت أول من ضغط الجرس!':buzzer.winner?'تم تسجيل أسرع لاعب. تابع شاشة المنظّم.':buzzer.locked?'انتظر فتح الجرس واختيار خلية.':player.team?'اضغط عند معرفة الإجابة.':'اختر فريقًا أولًا.'}</p>
  </main></div>`;
}

function renderLetterCellDisplay(code){
  setVersionFooterVisibility(false);
  setActivityBackdrop('letter-cell');
  app.innerHTML='<div class="letter-cell-display"><p class="letter-cell-display-message">جارٍ الاتصال باللعبة…</p></div>';
  if(letterCellDisplayRef)letterCellDisplayRef.off('value');
  letterCellDisplayRef=db.ref(`rooms/${code}`);
  letterCellDisplayRef.on('value',snapshot=>{
    const room=snapshot.val();
    const game=room?.letterCell;
    if(!game){
      app.innerHTML='<div class="letter-cell-display"><p class="letter-cell-display-message">بانتظار بدء لعبة خلية الحروف من المنظّم.</p></div>';
      return;
    }
    const settings=letterCellSettings(game);
    const scores=letterCellScore(game);
    const finished=game.phase==='ended';
    app.innerHTML=`<main class="letter-cell-display">
      <header><div><span>لعبة جماعية</span><h1>خلية الحروف</h1></div><strong>${finished?'النتيجة النهائية':game.phase==='setup'?'استعدوا للعب':`الجولة ${Math.min(game.roundsCompleted+1,settings.rounds)} / ${settings.rounds}`}</strong></header>
      <div class="letter-cell-scoreboard">${letterCellTeamHtml('A',settings,scores)}${letterCellTeamHtml('B',settings,scores)}</div>
      ${game.selectedCell?`<p class="letter-cell-display-selected">حرف السؤال: <strong>${escapeHtml(game.cells?.find(cell=>cell.id===game.selectedCell)?.letter||'')}</strong></p>`:''}
      ${letterCellBoardHtml(game,false)}
      ${finished?`<p class="letter-cell-display-result">${game.winner?`الفائز: ${escapeHtml(settings.teamNames[game.winner])}`:'تعادل'}</p>`:''}
    </main>`;
  },error=>{
    console.error('Could not load the Letter Cell TV display:',error);
    app.innerHTML=`<div class="letter-cell-display"><p class="letter-cell-display-message">تعذر الاتصال بشاشة اللعبة (${escapeHtml(error.code||'خطأ اتصال')}).</p></div>`;
  });
}

function letterCellDisplayUrl(code){
  const url=new URL(location.href);
  url.search='';
  url.searchParams.set('session',code);
  url.searchParams.set('game','letter-cell');
  url.searchParams.set('screen','tv');
  return url.href;
}

window.startLetterCellGame=function(code){
  letterCellLoadQuestions().then(()=>db.ref(`rooms/${code}`).once('value')).then(snapshot=>{
    if(!snapshot.exists())throw new Error('لم يتم العثور على الجلسة.');
    letterCellClearHostQuestions(code);
    return db.ref(`rooms/${code}`).update({
      status:'in_game',
      activeGame:'letter-cell',
      letterCell:letterCellInitialState(),
      buzzerTransport:'firebase',
      buzzerSession:null,
      buzzer:{winner:null,pressedAt:null,presses:{},locked:true,timer:null,round:0,cellId:null}
    });
  }).catch(error=>{
    console.error('Could not start Letter Cell:',error);
    alert(error.message||'تعذر بدء خلية الحروف. تحقق من الاتصال وحاول مرة أخرى.');
  });
};

function letterCellLoadQuestions(){
  if(LETTER_CELL_QUESTIONS)return Promise.resolve(LETTER_CELL_QUESTIONS);
  if(!letterCellQuestionLoad){
    letterCellQuestionLoad=fetch('assets/data/letter-cell-questions.json')
      .then(response=>{
        if(!response.ok)throw new Error(`تعذر تحميل بنك الأسئلة (${response.status}).`);
        return response.json();
      })
      .then(data=>{
        if(!data||typeof data!=='object'||Array.isArray(data)||
           !Object.entries(data).some(([,items])=>Array.isArray(items)&&items.some(item=>typeof item?.question==='string'&&typeof item?.answer==='string'))){
          throw new Error('ملف بنك الأسئلة لا يحتوي على أسئلة صالحة.');
        }
        LETTER_CELL_QUESTIONS=data;
        return data;
      })
      .catch(error=>{
        letterCellQuestionLoad=null;
        throw error;
      });
  }
  return letterCellQuestionLoad;
}

window.saveLetterCellSettings=function(code){
  const rounds=Number(document.getElementById('letterCellRounds')?.value);
  const cellCount=Number(document.getElementById('letterCellCount')?.value);
  const teamNames={A:document.getElementById('letterCellTeamNameA')?.value.trim(),B:document.getElementById('letterCellTeamNameB')?.value.trim()};
  const teamColors={A:document.getElementById('letterCellTeamColorA')?.value,B:document.getElementById('letterCellTeamColorB')?.value};
  if(!Number.isInteger(rounds)||rounds<1||rounds>30||!Number.isInteger(cellCount)||cellCount<5||cellCount>25||
     !teamNames.A||!teamNames.B||!/^#[0-9a-f]{6}$/i.test(teamColors.A||'')||!/^#[0-9a-f]{6}$/i.test(teamColors.B||'')){
    alert('تحقق من عدد الجولات والخلايا وأسماء الفريقين وألوانهما.');
    return;
  }
  db.ref(`rooms/${code}/letterCell`).transaction(game=>{
    if(!game||game.phase!=='setup')return;
    game.settings={rounds,cellCount,teamNames,teamColors};
    game.cells=letterCellMakeBoard(cellCount);
    game.roundsCompleted=0;
    game.selectedCell=null;
    return game;
  }).then(result=>{
    if(!result.committed)alert('لا يمكن تغيير الإعدادات بعد بدء اللعب.');
  }).catch(error=>{
    console.error('Could not save Letter Cell settings:',error);
    alert('تعذر حفظ الإعدادات. تحقق من الاتصال وحاول مرة أخرى.');
  });
};

window.letterCellStartPlay=function(code){
  db.ref(`rooms/${code}/letterCell`).transaction(game=>{
    if(!game||game.phase!=='setup')return;
    game.phase='playing';
    return game;
  }).then(result=>{
    if(result.committed)return db.ref(`rooms/${code}/buzzer`).update({locked:true,winner:null,pressedAt:null,presses:{},round:0});
  }).catch(error=>{
    console.error('Could not begin Letter Cell rounds:',error);
    alert('تعذر بدء اللعب. تحقق من الاتصال وحاول مرة أخرى.');
  });
};

window.letterCellSelectCell=function(code,cellId){
  db.ref(`rooms/${code}/letterCell`).transaction(game=>{
    if(!game||game.phase!=='playing'||game.selectedCell||game.roundsCompleted>=letterCellSettings(game).rounds)return;
    const cell=game.cells?.find(item=>item.id===cellId);
    if(!cell||cell.owner)return;
    game.selectedCell=cellId;
    return game;
  }).then(result=>{
    if(!result.committed)return;
    const cell=lastHostRoom?.letterCell?.cells?.find(item=>item.id===cellId)||
      result.snapshot?.val()?.cells?.find(item=>item.id===cellId);
    const question=letterCellPickQuestion(cell?.letter||'');
    if(question)letterCellStoreHostQuestion(code,cellId,question);
    letterCellRefreshHost(code);
    return db.ref(`rooms/${code}/buzzer`).update({
      locked:!question,winner:null,pressedAt:null,presses:{},
      round:((lastHostRoom?.buzzer?.round||0)+1),cellId:question?cellId:null
    });
  }).catch(error=>{
    console.error('Could not select a Letter Cell:',error);
    alert('تعذر اختيار الخلية. تحقق من الاتصال وحاول مرة أخرى.');
  });
};

window.letterCellReplaceQuestion=function(code,cellId){
  const room=lastHostRoom;
  const cell=room?.letterCell?.cells?.find(item=>item.id===cellId);
  if(!cell||room.letterCell.selectedCell!==cellId)return;
  const current=letterCellCurrentQuestions.get(letterCellHostQuestionKey(code,cellId));
  const replacement=letterCellPickQuestion(cell.letter,current?.key||null);
  if(!replacement){
    alert('لا توجد أسئلة أخرى لهذا الحرف لاستبدال السؤال الحالي.');
    return;
  }
  letterCellStoreHostQuestion(code,cellId,replacement);
  db.ref(`rooms/${code}/buzzer`).update({locked:false,cellId,winner:null,pressedAt:null,presses:{}})
    .then(()=>letterCellRefreshHost(code))
    .catch(error=>{
      console.error('Could not reopen the Letter Cell buzzer:',error);
      alert('تعذر فتح الجرس. تحقق من الاتصال وحاول مرة أخرى.');
    });
};

window.letterCellPressBuzzer=function(code,playerId){
  const room=lastPlayerRoom;
  if(!room||room.status!=='in_game'||room.activeGame!=='letter-cell'||room.players?.[playerId]?.team==null)return;
  const pressedAt=Date.now();
  db.ref(`rooms/${code}/buzzer`).transaction(state=>{
    if(!state||state.locked||state.winner||!room.letterCell?.selectedCell||state.cellId!==room.letterCell.selectedCell)return;
    state.winner=playerId;
    state.pressedAt=pressedAt;
    state.presses={...(state.presses||{}),[playerId]:pressedAt};
    state.locked=true;
    return state;
  }).catch(error=>{
    console.error('Could not record a Letter Cell buzzer press:',error);
  });
};

window.letterCellToggleBuzzer=function(code){
  const locked=!!lastHostRoom?.buzzer?.locked;
  db.ref(`rooms/${code}/buzzer/locked`).set(!locked).catch(error=>{
    console.error('Could not change the Letter Cell buzzer lock:',error);
    alert('تعذر تغيير حالة الجرس. تحقق من الاتصال وحاول مرة أخرى.');
  });
};

window.letterCellClearBuzzer=function(code){
  const round=(Number(lastHostRoom?.buzzer?.round)||0)+1;
  const cellId=lastHostRoom?.letterCell?.selectedCell||null;
  db.ref(`rooms/${code}/buzzer`).update({locked:!cellId,winner:null,pressedAt:null,presses:{},round,cellId}).catch(error=>{
    console.error('Could not reset the Letter Cell buzzer:',error);
    alert('تعذر إعادة ضبط الجرس. تحقق من الاتصال وحاول مرة أخرى.');
  });
};

window.letterCellFinishRound=function(code,correct){
  const room=lastHostRoom;
  const game=room?.letterCell;
  const buzzer=room?.buzzer||{};
  const winner=room?.players?.[buzzer.winner];
  const team=winner?.team;
  if(correct&&(!game?.selectedCell||!team)){
    alert('لا يوجد لاعب ضاغط اختار فريقًا لاحتساب الخلية.');
    return;
  }
  db.ref(`rooms/${code}/letterCell`).transaction(current=>{
    if(!current||current.phase!=='playing'||!current.selectedCell)return;
    const cell=current.cells?.find(item=>item.id===current.selectedCell);
    if(!cell)return;
    if(correct){
      if(cell.owner||!team)return;
      cell.owner=team;
    }
    current.roundsCompleted=(Number(current.roundsCompleted)||0)+1;
    current.selectedCell=null;
    if(current.roundsCompleted>=letterCellSettings(current).rounds||current.cells.every(item=>item.owner)) {
      current.phase='ended';
      current.winner=letterCellWinner(current);
    }
    return current;
  }).then(result=>{
    if(!result.committed)return;
    return db.ref(`rooms/${code}/buzzer`).update({locked:true,winner:null,pressedAt:null,presses:{},cellId:null});
  }).catch(error=>{
    console.error('Could not finish a Letter Cell round:',error);
    alert('تعذر تسجيل نتيجة الجولة. تحقق من الاتصال وحاول مرة أخرى.');
  });
};

window.letterCellSetTeam=function(code,playerId,team){
  if(team!=='A'&&team!=='B')return;
  db.ref(`rooms/${code}/players/${playerId}/team`).set(team).catch(error=>{
    console.error('Could not assign a Letter Cell team:',error);
    alert('تعذر اختيار الفريق. تحقق من الاتصال وحاول مرة أخرى.');
  });
};

window.letterCellRestart=function(code){
  if(!confirm('ستبدأ لعبة جديدة وسيُمسح توزيع الخلايا الحالي. هل تريد المتابعة؟'))return;
  const settings=letterCellSettings(lastHostRoom?.letterCell);
  const next=letterCellInitialState();
  next.settings=settings;
  next.cells=letterCellMakeBoard(settings.cellCount);
  db.ref(`rooms/${code}`).update({
    letterCell:next,
    buzzer:{winner:null,pressedAt:null,presses:{},locked:true,timer:null,round:0,cellId:null}
  }).then(()=>{
    letterCellClearHostQuestions(code);
    letterCellRefreshHost(code);
  }).catch(error=>{
    console.error('Could not restart Letter Cell:',error);
    alert('تعذر بدء لعبة جديدة. تحقق من الاتصال وحاول مرة أخرى.');
  });
};
