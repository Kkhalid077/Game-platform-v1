const LETTER_CELL_ALPHABET = Array.from('ابتثجحخدذرزسشصضطظعغفقكلمنهوي');
const LETTER_CELL_DEFAULT_SETTINGS = {
  rounds:2,
  cellCount:25,
  teamNames:{A:'الفريق الأخضر',B:'الفريق البرتقالي'},
  teamColors:{A:'#35b51d',B:'#ff783b'}
};
const LETTER_CELL_ROUND_OPTIONS=[1,2,3];
const LETTER_CELL_SIZE_OPTIONS=[16,25,36];
let LETTER_CELL_QUESTIONS = null;
let letterCellQuestionLoad = null;
const letterCellCurrentQuestions = new Map();
const letterCellUsedQuestionIds = new Set();
let letterCellDisplayRef = null;

function letterCellNormalizeLetter(value){
  return normalizeAr(value).replace(/\u0640/g,'').charAt(0);
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

function letterCellRefreshHost(code,game=null){
  if(game&&lastHostRoom?.activeGame==='letter-cell'){
    lastHostRoom={...lastHostRoom,letterCell:game};
  }
  if(lastHostRoom?.status==='in_game'&&lastHostRoom.activeGame==='letter-cell'){
    window.updateLetterCellHostView?.(code,lastHostRoom);
  }
}

function letterCellMakeBoard(count){
  const letters=shuffle(LETTER_CELL_ALPHABET);
  while(letters.length<count)letters.push(...shuffle(LETTER_CELL_ALPHABET));
  return letters.slice(0,count).map((letter,index)=>({
    id:String(index),
    letter,
    owner:null
  }));
}

function letterCellBoardDimension(game){
  const count=Array.isArray(game?.cells)&&game.cells.length?game.cells.length:letterCellSettings(game).cellCount;
  return LETTER_CELL_SIZE_OPTIONS.includes(count)?Math.sqrt(count):5;
}

function letterCellGridLabel(cellCount){
  const dimension=Math.round(Math.sqrt(cellCount));
  return `${dimension} × ${dimension}`;
}

function letterCellInitialState(){
  return {
    phase:'setup',
    settings:JSON.parse(JSON.stringify(LETTER_CELL_DEFAULT_SETTINGS)),
    cells:letterCellMakeBoard(LETTER_CELL_DEFAULT_SETTINGS.cellCount),
    roundsCompleted:0,
    selectedCell:null,
    roundWins:{A:0,B:0},
    roundComplete:false,
    tieBreak:false,
    tieBreakStarted:false
  };
}

function letterCellSettings(game){
  const settings=game?.settings||{};
  const requestedRounds=Number(settings.rounds);
  const requestedCellCount=Number(settings.cellCount);
  return {
    rounds:LETTER_CELL_ROUND_OPTIONS.includes(requestedRounds)?requestedRounds:LETTER_CELL_DEFAULT_SETTINGS.rounds,
    cellCount:LETTER_CELL_SIZE_OPTIONS.includes(requestedCellCount)?requestedCellCount:LETTER_CELL_DEFAULT_SETTINGS.cellCount,
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
  if(game?.roundWins)return {A:Number(game.roundWins.A)||0,B:Number(game.roundWins.B)||0};
  const score={A:0,B:0};
  (game?.cells||[]).forEach(cell=>{if(cell.owner==='A'||cell.owner==='B')score[cell.owner]++;});
  return score;
}

function letterCellWinner(game){
  const scores=letterCellScore(game);
  return scores.A===scores.B?null:scores.A>scores.B?'A':'B';
}

function letterCellRoundTitle(game){
  const ordinals=[
    'الأولى','الثانية','الثالثة','الرابعة','الخامسة','السادسة','السابعة','الثامنة','التاسعة','العاشرة',
    'الحادية عشرة','الثانية عشرة','الثالثة عشرة','الرابعة عشرة','الخامسة عشرة','السادسة عشرة','السابعة عشرة','الثامنة عشرة','التاسعة عشرة','العشرون',
    'الحادية والعشرون','الثانية والعشرون','الثالثة والعشرون','الرابعة والعشرون','الخامسة والعشرون','السادسة والعشرون','السابعة والعشرون','الثامنة والعشرون','التاسعة والعشرون','الثلاثون'
  ];
  const completed=Math.max(0,Number(game?.roundsCompleted)||0);
  const round=game?.tieBreak?completed+1:game?.roundComplete||game?.phase==='ended'?Math.max(1,completed):completed+1;
  return `الجولة ${ordinals[Math.min(ordinals.length-1,Math.max(0,round-1))]}`;
}

function letterCellCompleteRound(game,roundWinner){
  game.roundComplete=true;
  game.roundWinner=roundWinner||null;
  if(!game.tieBreak)game.roundsCompleted=(Number(game.roundsCompleted)||0)+1;
  game.roundWins=game.roundWins||{A:0,B:0};
  if(roundWinner)game.roundWins[roundWinner]=(Number(game.roundWins[roundWinner])||0)+1;
  if(game.tieBreak&&roundWinner){
    game.phase='ended';
    game.winner=roundWinner;
    return;
  }
  if(!game.tieBreak&&game.roundsCompleted>=letterCellSettings(game).rounds){
    const winner=letterCellWinner(game);
    if(winner){
      game.phase='ended';
      game.winner=winner;
    }else{
      game.tieBreak=true;
    }
  }
}

function letterCellConnectedTeam(game,team){
  const cells=Array.isArray(game.cells)?game.cells:[];
  const boardSize=letterCellBoardDimension(game);
  const rowCount=Math.ceil(cells.length/boardSize);
  const starts=[];
  for(let index=0;index<cells.length;index++){
    const row=Math.floor(index/boardSize),column=index%boardSize;
    if(team==='A'?column===0:row===0)starts.push(index);
  }
  const visited=new Set();
  const queue=starts.filter(index=>cells[index]?.owner===team);
  queue.forEach(index=>visited.add(index));
  for(let head=0;head<queue.length;head++){
    const index=queue[head],row=Math.floor(index/boardSize),column=index%boardSize;
    if(team==='A'?column===boardSize-1:row===rowCount-1)return true;
    const neighbors=[];
    if(column>0)neighbors.push(index-1);
    if(column<boardSize-1&&index+1<cells.length)neighbors.push(index+1);
    const adjacentColumns=row%2===0?[column-1,column]:[column,column+1];
    for(const adjacentRow of [row-1,row+1]){
      for(const adjacentColumn of adjacentColumns){
        if(adjacentRow>=0&&adjacentRow<rowCount&&adjacentColumn>=0&&adjacentColumn<boardSize){
          neighbors.push(adjacentRow*boardSize+adjacentColumn);
        }
      }
    }
    for(const neighbor of neighbors){
      if(neighbor<0||neighbor>=cells.length||visited.has(neighbor)||cells[neighbor]?.owner!==team)continue;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }
  return false;
}

function letterCellTeamHtml(team,settings,score){
  return `<article class="letter-cell-team" style="--letter-team-color:${settings.teamColors[team]}">
    <span>${escapeHtml(settings.teamNames[team])}</span><strong>${score[team]}</strong>
  </article>`;
}

function letterCellBoardHtml(game,interactive){
  const cells=Array.isArray(game.cells)?game.cells:[];
  const settings=letterCellSettings(game);
  const dimension=letterCellBoardDimension(game);
  const rows=[];
  for(let index=0;index<cells.length;index+=dimension)rows.push(cells.slice(index,index+dimension));
  return `<div class="letter-cell-board-wrap">
    <span class="letter-cell-edge letter-cell-edge-top" style="--edge-team-color:${settings.teamColors.B}" aria-label="حد ${escapeHtml(settings.teamNames.B)}"></span>
    <span class="letter-cell-edge letter-cell-edge-bottom" style="--edge-team-color:${settings.teamColors.B}" aria-hidden="true"></span>
    <span class="letter-cell-edge letter-cell-edge-left" style="--edge-team-color:${settings.teamColors.A}" aria-label="حد ${escapeHtml(settings.teamNames.A)}"></span>
    <span class="letter-cell-edge letter-cell-edge-right" style="--edge-team-color:${settings.teamColors.A}" aria-hidden="true"></span>
    <div class="letter-cell-board is-size-${dimension}" style="--letter-cell-columns:${dimension}" role="group" aria-label="لوحة خلية الحروف">${rows.map((row,rowIndex)=>`
      <div class="letter-cell-board-row ${rowIndex%2?'is-offset':''}">${row.map(cell=>{
        const owner=cell.owner==='A'||cell.owner==='B'?cell.owner:null;
        const color=owner?settings.teamColors[owner]:'';
        const selected=game.selectedCell===cell.id;
        const classes=`letter-cell-tile ${selected?'is-selected':''} ${owner?'is-owned':''} ${cell.skipped?'is-skipped':''}`;
        const style=color?`--letter-team-color:${color}`:'';
        const content=`<span class="letter-cell-tile-face">${escapeHtml(cell.letter)}</span>`;
        if(!interactive)return `<div class="${classes}" data-cell-id="${escapeHtml(cell.id)}" data-letter="${escapeHtml(cell.letter)}" style="${style}" aria-label="خلية حرف ${escapeHtml(cell.letter)}${selected?'، مختارة':''}">${content}</div>`;
        const isSelected=game.selectedCell===cell.id;
        const isOwned=!!owner;
        const disabled=game.phase!=='playing'||game.roundComplete||!!cell.skipped;
        const onclick=isOwned?`letterCellUnawardCell('${escapeHtml(ACTIVE_HOST_CODE)}','${escapeHtml(cell.id)}')`:`letterCellSelectCell('${escapeHtml(ACTIVE_HOST_CODE)}','${escapeHtml(cell.id)}')`;
        const ariaLabel=isOwned?`إلغاء احتساب الخلية ${escapeHtml(cell.letter)} (فريق ${escapeHtml(settings.teamNames[owner])})`:`اختيار الخلية ${escapeHtml(cell.letter)}`;
        return `<button type="button" class="${classes}" data-cell-id="${escapeHtml(cell.id)}" data-letter="${escapeHtml(cell.letter)}" style="${style}" ${disabled?'disabled':''} onclick="${onclick}" aria-label="${ariaLabel}">${content}</button>`;
      }).join('')}</div>`).join('')}</div>
  </div>`;
}

function letterCellSettingsForm(game,code){
  const settings=letterCellSettings(game);
  if(game.phase!=='setup'){
    return `<div class="letter-cell-settings-summary">
      <p>الجولات: <strong>${settings.rounds}</strong></p>
      <p>حجم اللوحة: <strong>${letterCellGridLabel(settings.cellCount)}</strong></p>
      <p>${escapeHtml(settings.teamNames.A)} — ${escapeHtml(settings.teamNames.B)}</p>
    </div>`;
  }
  return `<form class="letter-cell-settings-form" onsubmit="event.preventDefault();saveLetterCellSettings('${escapeHtml(code)}')">
    <label>عدد الجولات<select id="letterCellRounds" required>${LETTER_CELL_ROUND_OPTIONS.map(rounds=>`<option value="${rounds}" ${settings.rounds===rounds?'selected':''}>${rounds===1?'جولة واحدة':rounds===2?'جولتان':'3 جولات'}</option>`).join('')}</select></label>
    <label>حجم اللوحة<select id="letterCellCount" required>${LETTER_CELL_SIZE_OPTIONS.map(count=>`<option value="${count}" ${settings.cellCount===count?'selected':''}>${letterCellGridLabel(count)}</option>`).join('')}</select></label>
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
  const time=Number(buzzer.pressedAt)||Number(buzzer.presses?.[winnerId])||0;
  return `<div class="letter-cell-buzzer-status ${player?'has-winner':''}" data-buzzer-status>
    <span data-buzzer-state>${active?'أسرع لاعب':'الجرس غير نشط'}</span><strong data-buzzer-player>${winner}</strong>
    <time data-buzzer-time ${time?'':'hidden'}>${time?new Date(time).toLocaleTimeString('ar-SA',{minute:'2-digit',second:'2-digit'}):''}</time>
  </div>
  <p class="letter-cell-hint" data-buzzer-hint>${active?'اختار المنظّم خلية. اقرأ سؤالًا تكون إجابته بحرفها.':'اختر خلية من اللوحة لتفعيل جرس اللاعبين.'}</p>`;
}

function letterCellConnectedPlayersHtml(room,game){
  const settings=letterCellSettings(game);
  const players=Object.values(room.players||{});
  if(!players.length)return '<span class="letter-cell-connected-empty">بانتظار انضمام اللاعبين</span>';
  return `<ul class="letter-cell-connected-list">${players.map(player=>`<li>
    <span class="letter-cell-connected-dot" aria-hidden="true"></span>
    <strong>${escapeHtml(player.name||'لاعب')}</strong>
    ${player.team?`<small>${escapeHtml(settings.teamNames[player.team]||'')}</small>`:''}
  </li>`).join('')}</ul>`;
}

function renderLetterCellHost(code,room){
  const game=room.letterCell;
  if(!game){renderHostGenericPlaceholder(code,room);return;}
  const mounted=app.querySelector('.letter-cell-host-stage');
  if(mounted?.dataset.roomCode===code){
    window.updateLetterCellHostView(code,room);
    return;
  }
  const inviteUrl=joinGameUrl(code,'letter-cell');
  const settings=letterCellSettings(game);
  app.innerHTML=`<div class="stage letter-cell-host-stage">
    ${activityExitControlsHtml(code,'letter-cell')}
    <main class="letter-cell-host">
      <header class="letter-cell-heading">
        <div><span class="host-section-kicker">خلية الحروف</span></div>
      </header>
      <div class="letter-cell-host-layout">
        <div class="letter-cell-primary-column">
          <section class="letter-cell-panel letter-cell-host-question" aria-label="أداة الأسئلة">
            <div class="letter-cell-host-question-heading"><div><span class="host-section-kicker">أداة الأسئلة</span></div><span class="letter-cell-question-letter" data-question-letter hidden></span></div>
            <p class="letter-cell-question-empty" data-question-placeholder>اختر خلية لعرض سؤالها هنا. لن يظهر السؤال على شاشة العرض.</p>
            <p class="letter-cell-question-text" data-question-text hidden></p>
            <details class="letter-cell-answer" data-question-answer hidden><summary>عرض الإجابة</summary><strong data-answer-text></strong></details>
            <small class="letter-cell-question-credit" data-question-contributor hidden></small>
            <div class="letter-cell-question-actions">
              <button class="btn btn-ghost letter-cell-replace-question" data-replace-question type="button" hidden>استبدال السؤال</button>
            </div>
          </section>
          <section class="letter-cell-panel letter-cell-board-panel">
            <div class="letter-cell-board-setup" data-settings-edit ${game.phase==='setup'?'':'hidden'}>
              <span class="host-section-kicker">الإعدادات</span><h2>لوحة اللعب</h2>
              ${letterCellSettingsForm({...game,phase:'setup'},code)}
              <button class="btn letter-cell-start-button" type="button" onclick="letterCellStartPlay('${escapeHtml(code)}')">بدء اللعبة</button>
            </div>
            <div class="letter-cell-board-play" data-board-view ${game.phase==='setup'?'hidden':''}>
              <div class="letter-cell-board-heading"><span class="host-section-kicker">لوحة اللعب</span></div>
              <h2 class="letter-cell-round-title" data-board-round>${escapeHtml(letterCellRoundTitle(game))}</h2>
              <div class="letter-cell-board-content">
                <div class="letter-cell-board-mount" data-board-mount>${letterCellBoardHtml(game,true)}</div>
                <div class="letter-cell-award-controls" data-award-controls>
                  ${['A','B'].map(team=>`<button class="letter-cell-award-button" data-award-team="${team}" style="--letter-team-color:${settings.teamColors[team]}" type="button" aria-label="احتساب النقطة لـ ${escapeHtml(settings.teamNames[team])}" onclick="letterCellAwardCell('${escapeHtml(code)}','${team}')">
                    <span class="letter-cell-award-check" aria-hidden="true">✓</span>
                    <span class="letter-cell-award-team" data-award-team-name>${escapeHtml(settings.teamNames[team])}</span>
                    <small>احتساب النقطة</small>
                  </button>`).join('')}
                </div>
              </div>
              <div class="letter-cell-round-controls" data-round-controls hidden>
                <button class="btn letter-cell-start-button" data-next-round type="button" onclick="letterCellNextRound('${escapeHtml(code)}')"></button>
              </div>
              <div class="letter-cell-result" data-game-result hidden><strong data-game-result-text></strong>
                <button class="btn" type="button" onclick="letterCellRestart('${escapeHtml(code)}')">لعبة جديدة بالإعدادات نفسها</button>
              </div>
            </div>
          </section>
        </div>
        <aside class="letter-cell-sidebar">
          <section class="letter-cell-panel letter-cell-host-invite">
            <span class="host-section-kicker">أداة الجرس</span>
            ${joinCardHtml('letterCellInvite',inviteUrl)}
            <p class="letter-cell-player-count" data-player-count></p>
            <div class="letter-cell-connected-players" aria-label="اللاعبون المتصلون">
              <h3>اللاعبون المتصلون</h3>
              <div data-player-list>${letterCellConnectedPlayersHtml(room,game)}</div>
            </div>
            <div class="letter-cell-host-buzzer">
              <div data-buzzer-status-mount>${letterCellBuzzerStatus(room,game)}</div>
              <div id="letterCellHostTimer"></div>
              <div class="letter-cell-buzzer-controls">
                <button class="btn btn-ghost" data-toggle-buzzer type="button"></button>
                <button class="btn btn-ghost" type="button" onclick="letterCellClearBuzzer('${escapeHtml(code)}')">إعادة ضبط الجرس</button>
              </div>
              <div class="buzzer-timer-controls letter-cell-timer-controls">
                <span>مؤقت السؤال:</span>
                <button type="button" onclick="buzzerStartTimer('${escapeHtml(code)}',10)">10 ثوانٍ</button>
                <button type="button" onclick="buzzerStartTimer('${escapeHtml(code)}',30)">30 ثانية</button>
                <button type="button" onclick="buzzerStopTimer('${escapeHtml(code)}')">إيقاف</button>
              </div>
            </div>
          </section>
          <section class="letter-cell-panel letter-cell-display-link letter-cell-host-broadcast">
            <span class="host-section-kicker">بث صفحة اللوحة</span><h2>عرض مستقل</h2>
            <a href="${escapeHtml(letterCellDisplayUrl(code))}" target="_blank" rel="noopener">فتح شاشة العرض</a>
            <div class="letter-cell-broadcast-url" dir="ltr">${escapeHtml(letterCellDisplayUrl(code))}</div>
            <button class="btn btn-ghost" data-copy-display type="button">نسخ رابط العرض</button>
            <small>افتح الرابط في متصفح التلفاز عبر Wi‑Fi أو اعرضه على شاشة HDMI.</small>
          </section>
        </aside>
      </div>
    </main>
  </div>`;
  const root=app.querySelector('.letter-cell-host-stage');
  if(root)root.dataset.roomCode=code;
  app.querySelector('[data-letter-cell-exit="lobby"]')?.addEventListener('click',event=>{
    event.preventDefault();
    letterCellRunExitAction(event.currentTarget,()=>window.resetToLobby(code));
  });
  app.querySelector('[data-letter-cell-exit="details"]')?.addEventListener('click',event=>{
    event.preventDefault();
    letterCellRunExitAction(event.currentTarget,()=>window.letterCellReturnToSetup(code));
  });
  app.querySelector('[data-replace-question]')?.addEventListener('click',()=>letterCellReplaceQuestion(code,root?.dataset.selectedCell||''));
  app.querySelector('[data-toggle-buzzer]')?.addEventListener('click',()=>letterCellToggleBuzzer(code));
  app.querySelector('[data-copy-display]')?.addEventListener('click',async event=>{
    const button=event.currentTarget;
    const copied=await copyText(letterCellDisplayUrl(code));
    button.textContent=copied?'تم نسخ رابط العرض':'تعذّر النسخ، انسخه يدويًا';
    window.setTimeout(()=>{if(button.isConnected)button.textContent='نسخ رابط العرض';},2200);
  });
  initJoinCard('letterCellInvite',inviteUrl);
  window.updateLetterCellHostView(code,room);
}

function letterCellRunExitAction(button,action){
  if(button.disabled)return;
  const label=button.textContent;
  button.disabled=true;
  Promise.resolve().then(action).then(result=>{
    if(button.isConnected){
      button.disabled=false;
      if(result===false)button.textContent=label;
    }
  }).catch(error=>{
    console.error('Could not complete a Letter Cell host navigation action:',error);
    if(button.isConnected){
      button.disabled=false;
      button.textContent=label;
    }
    alert('تعذر تنفيذ الإجراء. تحقق من الاتصال وحاول مرة أخرى.');
  });
}

function letterCellUpdateCellDom(tile,cell,game,settings){
  const owner=cell.owner==='A'||cell.owner==='B'?cell.owner:null;
  const selected=game.selectedCell===cell.id;
  const isOwned=!!owner;
  tile.classList.toggle('is-selected',selected);
  tile.classList.toggle('is-owned',isOwned);
  tile.classList.toggle('is-skipped',!!cell.skipped);
  const isSelected=game.selectedCell===cell.id;
  const disabled=game.phase!=='playing'||game.roundComplete||!!cell.skipped;
  if(tile.disabled!==disabled)tile.disabled=disabled;
  const onclick=isOwned?`letterCellUnawardCell('${escapeHtml(ACTIVE_HOST_CODE)}','${escapeHtml(cell.id)}')`:`letterCellSelectCell('${escapeHtml(ACTIVE_HOST_CODE)}','${escapeHtml(cell.id)}')`;
  const ariaLabel=isOwned?`إلغاء احتساب الخلية ${cell.letter} (فريق ${escapeHtml(settings.teamNames[owner])})`:`اختيار الخلية ${cell.letter}${selected?'، مختارة':''}`;
  tile.setAttribute('onclick',onclick);
  if(tile.getAttribute('aria-label')!==ariaLabel)tile.setAttribute('aria-label',ariaLabel);
  if(owner)letterCellSetColor(tile,settings.teamColors[owner]);
  else if(tile.style.getPropertyValue('--letter-team-color'))tile.style.removeProperty('--letter-team-color');
}

function letterCellFormatBuzzerTime(room){
  const buzzer=room.buzzer||{};
  const pressedAt=Number(buzzer.pressedAt)||Number(buzzer.presses?.[buzzer.winner])||0;
  return pressedAt?new Date(pressedAt).toLocaleTimeString('ar-SA',{minute:'2-digit',second:'2-digit'}):'';
}

function letterCellSetText(element,value){
  const text=String(value??'');
  if(element&&element.textContent!==text)element.textContent=text;
}

function letterCellSetHidden(element,hidden){
  if(element&&element.hidden!==hidden)element.hidden=hidden;
}

function letterCellSetColor(element,color){
  if(element&&element.style.getPropertyValue('--letter-team-color')!==color){
    element.style.setProperty('--letter-team-color',color);
  }
}

window.updateLetterCellHostView=function(code,room){
  const root=app.querySelector('.letter-cell-host-stage');
  const game=room?.letterCell;
  if(!root||root.dataset.roomCode!==code||!game)return false;
  const settings=letterCellSettings(game);
  const selected=Array.isArray(game.cells)?game.cells.find(cell=>cell.id===game.selectedCell):null;
  const question=selected?letterCellGetHostQuestion(code,selected.id):null;
  const finished=game.phase==='ended';
  if(root.dataset.phase!==game.phase)root.dataset.phase=game.phase;
  if(root.dataset.selectedCell!==(selected?.id||''))root.dataset.selectedCell=selected?.id||'';

  const editable=root.querySelector('[data-settings-edit]');
  const boardView=root.querySelector('[data-board-view]');
  letterCellSetHidden(editable,game.phase!=='setup');
  letterCellSetHidden(boardView,game.phase==='setup');
  letterCellSetText(root.querySelector('[data-settings-rounds]'),settings.rounds);
  letterCellSetText(root.querySelector('[data-settings-cell-count]'),letterCellGridLabel(settings.cellCount));
  letterCellSetText(root.querySelector('[data-settings-team-names]'),`${settings.teamNames.A} — ${settings.teamNames.B}`);
  root.querySelectorAll('.letter-cell-team-settings').forEach((fieldset,index)=>{
    const team=index===0?'A':'B';
    letterCellSetColor(fieldset,settings.teamColors[team]);
    letterCellSetText(fieldset.querySelector('legend'),team==='A'?'الفريق الأول':'الفريق الثاني');
  });
  const settingsValues={
    letterCellRounds:String(settings.rounds),
    letterCellCount:String(settings.cellCount),
    letterCellTeamNameA:settings.teamNames.A,
    letterCellTeamNameB:settings.teamNames.B,
    letterCellTeamColorA:settings.teamColors.A,
    letterCellTeamColorB:settings.teamColors.B
  };
  Object.entries(settingsValues).forEach(([id,value])=>{
    const input=root.querySelector(`#${id}`);
    if(input&&document.activeElement!==input&&input.value!==value)input.value=value;
  });

  letterCellSetText(root.querySelector('[data-question-heading]'),selected?`سؤال حرف ${selected.letter}`:'السؤال الحالي');
  const letter=root.querySelector('[data-question-letter]');
  letterCellSetHidden(letter,!selected);
  letterCellSetText(letter,selected?.letter||'');
  const questionText=root.querySelector('[data-question-text]');
  letterCellSetHidden(questionText,!question);
  letterCellSetText(questionText,question?.question||'');
  const placeholder=root.querySelector('[data-question-placeholder]');
  letterCellSetHidden(placeholder,!!question);
  letterCellSetText(placeholder,selected
    ? question?'':'لا يوجد سؤال متاح لهذا الحرف.'
    : 'اختر خلية لعرض سؤالها هنا. لن يظهر السؤال على شاشة العرض.');
  const answer=root.querySelector('[data-question-answer]');
  letterCellSetHidden(answer,!question);
  const questionKey=selected?`${selected.id}:${question?.question||''}:${question?.answer||''}`:'';
  const questionChanged=root.dataset.questionKey!==questionKey;
  if(question){
    letterCellSetText(root.querySelector('[data-answer-text]'),question.answer);
    if(questionChanged)answer.open=false;
  }
  if(root.dataset.questionKey!==questionKey)root.dataset.questionKey=questionKey;
  const contributor=root.querySelector('[data-question-contributor]');
  letterCellSetHidden(contributor,!question?.contributor);
  letterCellSetText(contributor,question?.contributor?`المساهم: ${question.contributor}`:'');
  const replace=root.querySelector('[data-replace-question]');
  letterCellSetHidden(replace,!selected);
  const awardControls=root.querySelector('[data-award-controls]');
  awardControls.querySelectorAll('[data-award-team]').forEach(button=>{
    const team=button.dataset.awardTeam;
    letterCellSetText(button.querySelector('[data-award-team-name]'),settings.teamNames[team]);
    button.setAttribute('aria-label',`احتساب النقطة لـ ${settings.teamNames[team]}`);
    letterCellSetColor(button,settings.teamColors[team]);
  });

  const boardMount=root.querySelector('[data-board-mount]');
  const boardTiles=[...boardMount.querySelectorAll('[data-cell-id]')];
  const cells=Array.isArray(game.cells)?game.cells:[];
  const boardMatches=boardTiles.length===cells.length&&boardTiles.every((tile,index)=>
    tile.dataset.cellId===String(cells[index].id)&&tile.dataset.letter===cells[index].letter);
  if(!boardMatches)boardMount.innerHTML=letterCellBoardHtml(game,true);
  const edgeColors={'.letter-cell-edge-top':settings.teamColors.B,'.letter-cell-edge-bottom':settings.teamColors.B,
    '.letter-cell-edge-left':settings.teamColors.A,'.letter-cell-edge-right':settings.teamColors.A};
  Object.entries(edgeColors).forEach(([selector,color])=>{
    const edge=boardMount.querySelector(selector);
    if(edge&&edge.style.getPropertyValue('--edge-team-color')!==color)edge.style.setProperty('--edge-team-color',color);
  });
  boardMount.querySelectorAll('[data-cell-id]').forEach(tile=>{
    const cell=cells.find(item=>String(item.id)===tile.dataset.cellId);
    if(cell)letterCellUpdateCellDom(tile,cell,game,settings);
  });

  const boardRound=root.querySelector('[data-board-round]');
  letterCellSetText(boardRound,letterCellRoundTitle(game));
  const boardHint=root.querySelector('[data-board-hint]');
  letterCellSetText(boardHint,finished
    ? 'انتهت اللعبة.'
    : game.phase==='setup'?'أكمل الإعدادات ثم ابدأ اللعبة؛ لوحة الخلايا جاهزة أدناه.'
      : game.roundComplete?'حُسمت الجولة؛ يمكنك بدء الجولة التالية من هنا.'
        : selected?'اقرأ السؤال في المربع أعلاه ثم احتسب الخلية للفريق صاحب الإجابة الصحيحة.'
          :'اختر خلية لإظهار سؤالها والتحكم في احتسابها.');
  const roundControls=root.querySelector('[data-round-controls]');
  letterCellSetHidden(roundControls,!(game.roundComplete&&game.phase==='playing'));
  letterCellSetText(root.querySelector('[data-next-round]'),game.tieBreak
    ?game.tieBreakStarted?'إعادة الجولة الفاصلة':'بدء الجولة الفاصلة'
    :'بدء الجولة التالية');
  const result=root.querySelector('[data-game-result]');
  letterCellSetHidden(result,!finished);
  letterCellSetText(root.querySelector('[data-game-result-text]'),game.winner
    ?`الفائز: ${settings.teamNames[game.winner]}`:'انتهت اللعبة بالتعادل');

  const buzzer=root.querySelector('[data-buzzer-status]');
  const buzzerState=root.querySelector('[data-buzzer-state]');
  const buzzerPlayer=root.querySelector('[data-buzzer-player]');
  const buzzerTime=root.querySelector('[data-buzzer-time]');
  const winnerId=room.buzzer?.winner;
  const player=winnerId?room.players?.[winnerId]:null;
  buzzer.classList.toggle('has-winner',!!player);
  letterCellSetText(buzzerState,game.phase==='playing'&&selected?'أسرع لاعب':'الجرس غير نشط');
  letterCellSetText(buzzerPlayer,player
    ?`${player.name||'لاعب'}${player.team?` — ${settings.teamNames[player.team]}`:' — لم يختر فريقًا'}`
    :'بانتظار ضغطة اللاعب الأول');
  letterCellSetText(buzzerTime,letterCellFormatBuzzerTime(room));
  letterCellSetHidden(buzzerTime,!buzzerTime.textContent);
  letterCellSetText(root.querySelector('[data-buzzer-hint]'),game.phase==='playing'&&selected
    ?'اقرأ السؤال ثم راقب أسرع لاعب يضغط.'
    :'اختر خلية من اللوحة لتفعيل جرس اللاعبين.');
  letterCellSetText(root.querySelector('[data-toggle-buzzer]'),room.buzzer?.locked?'فتح الجرس':'قفل الجرس');
  updateBuzzerTimerMount(room.buzzer?.timer,'letterCellHostTimer');
  startBuzzerTimerDisplay();
  const playerCount=Object.keys(room.players||{}).length;
  letterCellSetText(root.querySelector('[data-player-count]'),`اللاعبون المتصلون: ${playerCount}`);
  const playerList=root.querySelector('[data-player-list]');
  if(playerList)playerList.innerHTML=letterCellConnectedPlayersHtml(room,game);
  return true;
};

function renderLetterCellPlayer(code,playerId,name,room){
  const game=room.letterCell;
  if(!game){app.innerHTML='<div class="phone"><div class="card"><h2>خلية الحروف</h2><p class="muted">بانتظار إعداد اللعبة من المنظّم.</p></div></div>';return;}
  const buzzer=room.buzzer||{};
  const selected=game.cells?.find(cell=>cell.id===game.selectedCell);
  const winner=buzzer.winner&&room.players?.[buzzer.winner];
  const pressed=!!buzzer.presses?.[playerId];
  const won=buzzer.winner===playerId;
  const blocked=game.phase!=='playing'||!selected||buzzer.locked||pressed;
  app.innerHTML=`<div class="phone buzzer-player-screen"><main class="buzzer-panel buzzer-player-panel" id="letterCellPlayerRoot">
    <div><span class="host-section-kicker">خلية الحروف — جرس الإجابة</span><h1>أهلاً ${escapeHtml(name)}</h1></div>
    <div id="letterCellPlayerTimer"></div>
    <button class="buzzer-dome ${won?'is-winner':''}" type="button" ${blocked?'disabled':''} onclick="letterCellPressBuzzer('${escapeHtml(code)}','${escapeHtml(playerId)}')" aria-label="اضغط للإجابة">${won?'أنت الأسرع!':pressed?'تم تسجيل ضغطتك':buzzer.locked?'مقفلة':'اضغط للإجابة'}</button>
    <p class="buzzer-player-status">${won?'مبروك! أنت أول من ضغط':winner&&pressed?`تأخرت عن ${escapeHtml(winner.name||'لاعب')}، تابع شاشة المنظّم.`:pressed?'تم تسجيل ضغطتك.':game.phase!=='playing'?'انتظر بدء اللعبة من المنظّم.':!selected?'انتظر اختيار الخلية من المنظّم.':buzzer.locked?'انتظر فتح الجرس من المنظّم.':winner?`سبقك ${escapeHtml(winner.name||'لاعب')}، تابع شاشة المنظّم.`:'اضغط عند معرفة الإجابة.'}</p>
  </main></div>`;
  updateBuzzerTimerMount(buzzer.timer,'letterCellPlayerTimer');
  startBuzzerTimerDisplay();
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
      <section class="letter-cell-tv-board-area" aria-label="لوحة خلايا اللعبة">
        ${letterCellBoardHtml(game,false)}
      </section>
      <aside class="letter-cell-display-sidebar">
        <header><h1 class="letter-cell-display-round-title">${escapeHtml(letterCellRoundTitle(game))}</h1>
          <strong>${finished?'النتيجة النهائية':game.tieBreak?'جولة فاصلة':game.roundComplete?'انتهت الجولة':`الجولة ${Math.min(game.roundsCompleted+1,settings.rounds)} / ${settings.rounds}`}</strong></header>
        <div class="letter-cell-tv-scores">${['A','B'].map(team=>`<div class="letter-cell-tv-team" style="--letter-team-color:${settings.teamColors[team]}">
          <span class="letter-cell-tv-check" aria-hidden="true">✓</span><strong>${escapeHtml(settings.teamNames[team])}</strong><span class="letter-cell-tv-score">${scores[team]}</span>
        </div>`).join('')}</div>
        ${game.selectedCell?`<p class="letter-cell-display-selected">حرف السؤال: <strong>${escapeHtml(game.cells?.find(cell=>cell.id===game.selectedCell)?.letter||'')}</strong></p>`:''}
        ${finished?`<p class="letter-cell-display-result">${game.winner?`الفائز: ${escapeHtml(settings.teamNames[game.winner])}`:'تعادل'}</p>`:''}
      </aside>
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

function letterCellReadSettingsForm(){
  const rounds=Number(document.getElementById('letterCellRounds')?.value);
  const cellCount=Number(document.getElementById('letterCellCount')?.value);
  const teamNames={A:document.getElementById('letterCellTeamNameA')?.value.trim(),B:document.getElementById('letterCellTeamNameB')?.value.trim()};
  const teamColors={A:document.getElementById('letterCellTeamColorA')?.value,B:document.getElementById('letterCellTeamColorB')?.value};
  if(!LETTER_CELL_ROUND_OPTIONS.includes(rounds)||!LETTER_CELL_SIZE_OPTIONS.includes(cellCount)||
     !teamNames.A||!teamNames.B||!/^#[0-9a-f]{6}$/i.test(teamColors.A||'')||!/^#[0-9a-f]{6}$/i.test(teamColors.B||'')){
    alert('تحقق من عدد الجولات وحجم اللوحة وأسماء الفريقين وألوانهما.');
    return null;
  }
  return {rounds,cellCount,teamNames,teamColors};
}

function letterCellSaveSettingsTransaction(code,settings){
  return db.ref(`rooms/${code}/letterCell`).transaction(game=>{
    if(!game||game.phase!=='setup')return;
    game.settings=settings;
    game.cells=letterCellMakeBoard(settings.cellCount);
    game.roundsCompleted=0;
    game.selectedCell=null;
    return game;
  });
}

window.saveLetterCellSettings=function(code){
  const settings=letterCellReadSettingsForm();
  if(!settings)return;
  letterCellSaveSettingsTransaction(code,settings).then(result=>{
    if(!result.committed)alert('لا يمكن تغيير الإعدادات بعد بدء اللعب.');
  }).catch(error=>{
    console.error('Could not save Letter Cell settings:',error);
    alert('تعذر حفظ الإعدادات. تحقق من الاتصال وحاول مرة أخرى.');
  });
};

window.letterCellStartPlay=function(code){
  const settings=document.getElementById('letterCellRounds')?letterCellReadSettingsForm():null;
  if(document.getElementById('letterCellRounds')&&!settings)return;
  const gameRef=db.ref(`rooms/${code}/letterCell`);
  const begin=()=>gameRef.transaction(game=>{
    if(!game||game.phase!=='setup')return;
    if(settings){
      game.settings=settings;
      game.cells=letterCellMakeBoard(settings.cellCount);
      game.roundsCompleted=0;
      game.selectedCell=null;
    }
    game.phase='playing';
    return game;
  });
  begin().then(result=>{
    if(result.committed)return db.ref(`rooms/${code}/buzzer`).update({locked:true,winner:null,pressedAt:null,presses:{},round:0});
  }).catch(error=>{
    console.error('Could not begin Letter Cell rounds:',error);
    alert('تعذر بدء اللعب. تحقق من الاتصال وحاول مرة أخرى.');
  });
};

window.letterCellSelectCell=function(code,cellId){
  return db.ref(`rooms/${code}/letterCell`).transaction(game=>{
    if(!game||game.phase!=='playing'||game.roundsCompleted>=letterCellSettings(game).rounds)return;
    const cell=game.cells?.find(item=>item.id===cellId);
    if(!cell||cell.owner)return;
    // Allow deselection (clicking same cell) or switching to different cell
    if(game.selectedCell===cellId){
      game.selectedCell=null; // deselect
    }else{
      game.selectedCell=cellId; // select or switch
    }
    return game;
  }).then(async result=>{
    if(!result.committed)return;
    const selectedGame=result.snapshot?.val();
    const cell=selectedGame?.cells?.find(item=>String(item.id)===String(cellId));
    if(!cell)throw new Error('تعذر استعادة الخلية التي تم اختيارها.');
    
    // If deselected, clear the question and buzzer
    if(selectedGame.selectedCell!==cellId){
      await db.ref(`rooms/${code}/buzzer`).update({
        locked:true,winner:null,pressedAt:null,presses:{},cellId:null
      });
      letterCellRefreshHost(code,selectedGame);
      return;
    }
    
    await letterCellLoadQuestions();
    const question=letterCellPickQuestion(cell.letter);
    if(question)letterCellStoreHostQuestion(code,cellId,question);
    letterCellRefreshHost(code,selectedGame);
    await db.ref(`rooms/${code}/buzzer`).update({
      locked:!question,winner:null,pressedAt:null,presses:{},
      round:((lastHostRoom?.buzzer?.round||0)+1),cellId:question?cellId:null
    });
    if(!question)alert(`لا يوجد سؤال متاح لحرف ${cell.letter}.`);
  }).catch(error=>{
    console.error('Could not select a Letter Cell:',error);
    alert(error.message||'تعذر اختيار الخلية. تحقق من الاتصال وحاول مرة أخرى.');
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
  if(!room||room.status!=='in_game'||room.activeGame!=='letter-cell'||!room.players?.[playerId])return;
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

window.letterCellAwardCell=function(code,team){
  if(team!=='A'&&team!=='B')return;
  db.ref(`rooms/${code}/letterCell`).transaction(current=>{
    if(!current||current.phase!=='playing'||current.roundComplete||!current.selectedCell)return;
    const cell=current.cells?.find(item=>item.id===current.selectedCell);
    if(!cell||cell.owner||cell.skipped)return;
    cell.owner=team;
    current.selectedCell=null;
    current.winner=letterCellConnectedTeam(current,team)?team:null;
    if(current.winner)letterCellCompleteRound(current,team);
    else if(current.cells.every(item=>item.owner||item.skipped))letterCellCompleteRound(current,null);
    return current;
  }).then(result=>{
    if(!result.committed)return;
    return db.ref(`rooms/${code}/buzzer`).update({locked:true,winner:null,pressedAt:null,presses:{},cellId:null});
  }).catch(error=>{
    console.error('Could not award a Letter Cell:',error);
    alert('تعذر احتساب الخلية. تحقق من الاتصال وحاول مرة أخرى.');
  });
};

window.letterCellUnawardCell=function(code,cellId){
  db.ref(`rooms/${code}/letterCell`).transaction(current=>{
    if(!current||current.phase!=='playing')return;
    const cell=current.cells?.find(item=>item.id===cellId);
    if(!cell||!cell.owner)return;
    cell.owner=null;
    // If this cell was the selected one, clear selection
    if(current.selectedCell===cellId)current.selectedCell=null;
    // Check if round should be un-completed
    if(current.roundComplete){
      const teamAConnected=letterCellConnectedTeam(current,'A');
      const teamBConnected=letterCellConnectedTeam(current,'B');
      if(!teamAConnected && !teamBConnected){
        current.roundComplete=false;
        current.roundWinner=null;
      }
    }
    return current;
  }).then(result=>{
    if(!result.committed)return;
    return db.ref(`rooms/${code}/buzzer`).update({locked:true,winner:null,pressedAt:null,presses:{},cellId:null});
  }).catch(error=>{
    console.error('Could not unaward a Letter Cell:',error);
    alert('تعذر إلغاء احتساب الخلية. تحقق من الاتصال وحاول مرة أخرى.');
  });
};

window.letterCellNextRound=function(code){
  const nextBoard=letterCellMakeBoard(letterCellSettings(lastHostRoom?.letterCell).cellCount);
  db.ref(`rooms/${code}/letterCell`).transaction(current=>{
    if(!current||current.phase!=='playing'||!current.roundComplete)return;
    current.cells=nextBoard.map(cell=>({...cell}));
    current.selectedCell=null;
    current.roundComplete=false;
    current.roundWinner=null;
    current.winner=null;
    if(current.tieBreak)current.tieBreakStarted=true;
    return current;
  }).then(result=>{
    if(!result.committed)return;
    return db.ref(`rooms/${code}/buzzer`).update({locked:true,winner:null,pressedAt:null,presses:{},cellId:null});
  }).catch(error=>{
    console.error('Could not start the next Letter Cell round:',error);
    alert('تعذر بدء الجولة التالية. تحقق من الاتصال وحاول مرة أخرى.');
  });
};

window.letterCellSetTeam=function(code,playerId,team){
  if(team!=='A'&&team!=='B')return;
  db.ref(`rooms/${code}/players/${playerId}/team`).set(team).catch(error=>{
    console.error('Could not assign a Letter Cell team:',error);
    alert('تعذر اختيار الفريق. تحقق من الاتصال وحاول مرة أخرى.');
  });
};

window.letterCellReturnToSetup=function(code){
  return db.ref(`rooms/${code}/letterCell`).transaction(current=>{
    if(!current)return;
    const settings=letterCellSettings(current);
    current.phase='setup';
    current.settings=settings;
    current.cells=letterCellMakeBoard(settings.cellCount);
    current.roundsCompleted=0;
    current.selectedCell=null;
    current.roundWins={A:0,B:0};
    current.roundComplete=false;
    current.tieBreak=false;
    current.tieBreakStarted=false;
    current.roundWinner=null;
    current.winner=null;
    return current;
  }).then(async result=>{
    if(!result.committed){
      alert('تعذر إنهاء اللعبة والعودة إلى الإعدادات.');
      return false;
    }
    letterCellClearHostQuestions(code);
    letterCellRefreshHost(code,result.snapshot.val());
    await db.ref(`rooms/${code}/buzzer`).update({locked:true,winner:null,pressedAt:null,presses:{},timer:null,cellId:null});
    return true;
  }).catch(error=>{
    console.error('Could not return Letter Cell to setup:',error);
    alert('تعذر إنهاء اللعبة والعودة إلى الإعدادات. تحقق من الاتصال وحاول مرة أخرى.');
    return false;
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
