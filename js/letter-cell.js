const LETTER_CELL_ALPHABET = Array.from('ابتثجحخدذرزسشصضطظعغفقكلمنهوي');
const LETTER_CELL_DEFAULT_SETTINGS = {
  rounds:2,
  cellCount:25,
  contestName:'مسابقة خلية الحروف',
  autoWin:true,
  teamNames:{A:'الفريق الأخضر',B:'الفريق البرتقالي'},
  teamColors:{A:'#35b51d',B:'#ff783b'}
};
const LETTER_CELL_ROUND_OPTIONS=[1,2,3];
const LETTER_CELL_SIZE_OPTIONS=[16,25,36];
const LETTER_CELL_COLOR_THEMES=[
  {name:'أخضر وبرتقالي',colors:{A:'#35b51d',B:'#ff783b'}},
  {name:'أزرق ووردي',colors:{A:'#2196f3',B:'#e91e63'}},
  {name:'بنفسجي وذهبي',colors:{A:'#8e44ad',B:'#f1c40f'}},
  {name:'أحمر وأزرق',colors:{A:'#e53935',B:'#1e88e5'}},
  {name:'تركوازي وأرجواني',colors:{A:'#00bcd4',B:'#9c27b0'}},
  {name:'ليموني وكحلي',colors:{A:'#c0ca33',B:'#283593'}},
  {name:'نعناعي ومرجاني',colors:{A:'#00b894',B:'#ff7675'}},
  {name:'سماوي وبرتقالي',colors:{A:'#03a9f4',B:'#ff9800'}},
  {name:'وردي وأخضر',colors:{A:'#ec407a',B:'#43a047'}},
  {name:'ذهبي وأزرق',colors:{A:'#ffb300',B:'#3949ab'}},
  {name:'أحمر وفيروزي',colors:{A:'#f44336',B:'#009688'}},
  {name:'أبيض ورمادي',colors:{A:'#eeeeee',B:'#607d8b'}}
];
let LETTER_CELL_QUESTIONS = null;
let letterCellQuestionLoad = null;
const letterCellCurrentQuestions = new Map();
const letterCellUsedQuestionIds = new Set();
let letterCellDisplayRef = null;
let letterCellCurrentBoardWrap = null;
let letterCellResizeObserver = null;
const letterCellObservedBoards = new Set();

function letterCellUpdateHexSize(boardWrap, dimension) {
  if (!boardWrap || dimension <= 0) return;
  // Calculate hex size based on both width AND height to fill the container
  const w = boardWrap.clientWidth;
  const h = boardWrap.clientHeight;
  // For a hex grid with offset rows: total width ≈ dimension * hexSize, total height ≈ dimension * hexSize * 0.86
  const hexByWidth = w / dimension;
  const hexByHeight = h / (dimension * 0.75);
  const hexSize = Math.min(hexByWidth, hexByHeight);
  boardWrap.style.setProperty('--hex-size', `${hexSize}px`);
  boardWrap.style.setProperty('--hex-font-size', `${hexSize * 0.35}px`);
}

function letterCellUpdateBoardSize() {
  if (letterCellCurrentBoardWrap) {
    const boardEl = letterCellCurrentBoardWrap.querySelector('.letter-cell-board');
    if (!boardEl) return;
    const dimension = parseFloat(getComputedStyle(boardEl).getPropertyValue('--letter-cell-columns')) || 0;
    if (dimension > 0) {
      letterCellUpdateHexSize(letterCellCurrentBoardWrap, dimension);
    }
  }
}
window.addEventListener('resize', () => {
  requestAnimationFrame(letterCellUpdateBoardSize);
});

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
    phase:'home',
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
    contestName:String(settings.contestName||LETTER_CELL_DEFAULT_SETTINGS.contestName),
    autoWin:settings.autoWin!==false,
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
    
    <div class="letter-cell-board is-size-${dimension}" style="--letter-cell-columns:${dimension}" role="group" aria-label="لوحة خلية الحروف">${rows.map((row,rowIndex)=>`
      <div class="letter-cell-board-row ${rowIndex%2?'is-offset':''}">${row.map(cell=>{
        const owner=cell.owner==='A'||cell.owner==='B'?cell.owner:null;
        const color=owner?settings.teamColors[owner]:'';
        const selected=game.selectedCell===cell.id;
        const classes=`letter-cell-tile ${selected?'is-selected':''} ${owner?'is-owned':''} ${owner?`owner-${owner}`:''} ${cell.skipped?'is-skipped':''}`;
        const style=color?`--letter-team-color:${color}`:'';
        const showLetter=!owner;const content=showLetter?`<span class="letter-cell-tile-face">${escapeHtml(cell.letter)}</span>`:'';
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
  const roundOptions=[{value:3,label:'ثلاث جولات'},{value:2,label:'جولتين'},{value:1,label:'جولة'}];
  const sizeOptions=[{value:16,label:'أربعة'},{value:25,label:'خمسة'},{value:36,label:'ستة'}];
  const theme=LETTER_CELL_COLOR_THEMES.find(item=>item.colors.A.toLowerCase()===settings.teamColors.A.toLowerCase()&&item.colors.B.toLowerCase()===settings.teamColors.B.toLowerCase());
  return `<form id="letterCellSettingsForm" class="letter-cell-settings-form" onsubmit="event.preventDefault();saveLetterCellSettings('${escapeHtml(code)}')">
    <label class="letter-cell-field-label" for="letterCellContestName">اسم المسابقة</label>
    <input class="letter-cell-contest-input" id="letterCellContestName" type="text" maxlength="40" value="${escapeHtml(settings.contestName)}" required>
    <span class="letter-cell-field-label">أسماء المتسابقين</span>
    <div class="letter-cell-contestants">${['A','B'].map((team,index)=>`<label class="letter-cell-contestant" style="--letter-team-color:${settings.teamColors[team]}">
      <span class="letter-cell-hex" aria-hidden="true"></span>
      <input id="letterCellTeamName${team}" type="text" maxlength="24" value="${escapeHtml(settings.teamNames[team])}" aria-label="اسم المتسابق ${index+1}" required>
    </label>`).join('')}</div>
    <fieldset class="letter-cell-choice-group"><legend>عدد جولات الفوز</legend><div class="letter-cell-choice-row">${roundOptions.map(option=>`<button type="button" class="letter-cell-choice ${settings.rounds===option.value?'is-active':''}" data-round-option="${option.value}" aria-pressed="${settings.rounds===option.value}" onclick="letterCellChooseSetting('rounds',${option.value})">${option.label}</button>`).join('')}</div></fieldset>
    <fieldset class="letter-cell-choice-group"><legend>عدد الخلايا</legend><div class="letter-cell-choice-row">${sizeOptions.map(option=>`<button type="button" class="letter-cell-choice ${settings.cellCount===option.value?'is-active':''}" data-size-option="${option.value}" aria-pressed="${settings.cellCount===option.value}" onclick="letterCellChooseSetting('cellCount',${option.value})">${option.label}</button>`).join('')}</div></fieldset>
    <fieldset class="letter-cell-choice-group"><legend>حساب الفوز تلقائياً</legend><div class="letter-cell-choice-row letter-cell-choice-row-compact">
      <button type="button" class="letter-cell-choice ${!settings.autoWin?'is-active':''}" data-auto-win="false" aria-pressed="${!settings.autoWin}" onclick="letterCellChooseSetting('autoWin',false)">معطل</button>
      <button type="button" class="letter-cell-choice ${settings.autoWin?'is-active':''}" data-auto-win="true" aria-pressed="${settings.autoWin}" onclick="letterCellChooseSetting('autoWin',true)">مفعل</button>
    </div></fieldset>
    <fieldset class="letter-cell-choice-group"><legend>لون الخلايا</legend><div class="letter-cell-color-grid">${LETTER_CELL_COLOR_THEMES.map((item,index)=>`<button type="button" class="letter-cell-color-theme ${theme===item?'is-active':''}" style="--theme-a:${item.colors.A};--theme-b:${item.colors.B}" data-color-theme="${index}" aria-label="${escapeHtml(item.name)}" aria-pressed="${theme===item}" onclick="letterCellChooseSetting('theme',${index})"><span class="letter-cell-theme-swatch"></span></button>`).join('')}</div></fieldset>
    <button type="submit" class="letter-cell-settings-save">حفظ ورجوع</button>
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
  setVersionFooterVisibility(false);
  app.innerHTML=`<div class="stage letter-cell-host-stage" data-phase="${escapeHtml(game.phase||'home')}">
    ${activityExitControlsHtml(code,'letter-cell')}
    <main class="letter-cell-host">
      <div class="letter-cell-host-layout">
        <div class="letter-cell-primary-column">
          <section class="letter-cell-home" data-home-view ${game.phase==='home'?'':'hidden'}>
            <h1 data-contest-title>${escapeHtml(settings.contestName)}</h1>
            <button class="letter-cell-home-start" type="button" onclick="letterCellStartPlay('${escapeHtml(code)}')">بدء اللعبة</button>
            <button class="letter-cell-home-settings" type="button" onclick="letterCellOpenSettings('${escapeHtml(code)}')">الإعدادات</button>
          </section>
          <section class="letter-cell-settings-screen" data-settings-screen ${game.phase==='setup'?'':'hidden'}>
            <button class="letter-cell-settings-save" type="submit" form="letterCellSettingsForm">حفظ ورجوع</button>
            <section class="letter-cell-settings-card" aria-label="إعدادات المسابقة">
              ${letterCellSettingsForm({...game,phase:'setup'},code)}
            </section>
          </section>
          <section class="letter-cell-panel letter-cell-host-question" data-playing-view aria-label="أداة الأسئلة" ${game.phase==='playing'||game.phase==='ended'?'':'hidden'}>
            <div class="letter-cell-host-question-heading"><div><span class="host-section-kicker">أداة الأسئلة</span></div><span class="letter-cell-question-letter" data-question-letter title=""><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></span></div>
            <div class="letter-cell-question-content">
              <p class="letter-cell-question-empty" data-question-placeholder>اختر خلية لعرض سؤالها هنا. لن يظهر السؤال على شاشة العرض.</p>
              <p class="letter-cell-question-text" data-question-text hidden></p>
              <strong class="letter-cell-answer-text" data-answer-text hidden></strong>
            </div>
            <div class="letter-cell-question-actions">
              <button class="btn btn-ghost letter-cell-action-btn letter-cell-show-answer" data-show-answer type="button" hidden>عرض الإجابة</button>
              <button class="btn btn-ghost letter-cell-action-btn letter-cell-replace-question" data-replace-question type="button" hidden>استبدال السؤال</button>
            </div>
          </section>
          <section class="letter-cell-panel letter-cell-board-panel" data-playing-view ${game.phase==='playing'||game.phase==='ended'?'':'hidden'}>
            <div class="letter-cell-board-play" data-board-view>
              <div class="letter-cell-board-heading"><span class="host-section-kicker">لوحة اللعب</span></div>
              <div class="letter-cell-board-content">
                <section class="letter-cell-letters-area" data-letters-area>
                  <div class="letter-cell-board-mount" data-board-mount>${letterCellBoardHtml(game,true)}</div>
                </section>
                <aside class="letter-cell-teams-area" data-teams-area>
                  <div class="letter-cell-round-title-sidebar" data-board-round-sidebar-wrap>
                    <span class="round-line1" data-board-round-line1>الجولة</span>
                    <span class="round-line2" data-board-round-line2>${escapeHtml(letterCellRoundTitle(game)).replace('الجولة','').trim()||'الأولى'}</span>
                  </div>
                  <div class="letter-cell-teams-cards" data-teams-cards>
                    ${['A','B'].map(team=>`
                      <button class="letter-cell-team-card" data-team="${team}" type="button" onclick="window.letterCellAwardCell && window.letterCellAwardCell('${escapeHtml(ACTIVE_HOST_CODE)}','${team}')">
                        <span class="letter-cell-team-check" aria-hidden="true">✓</span>
                        <span class="letter-cell-team-name">${escapeHtml(settings.teamNames[team])}</span>
                        <span class="letter-cell-team-score" data-team-score="${team}">0</span>
                      </button>
                    `).join('')}
                  </div>
                </aside>
              </div>
              <div class="letter-cell-round-controls" data-round-controls hidden>
                <button class="btn letter-cell-start-button" data-next-round type="button" onclick="letterCellNextRound('${escapeHtml(code)}')"></button>
              </div>
              <div class="letter-cell-manual-round" data-manual-round hidden>
                <span>احتساب الفوز يدويًا</span>
                ${['A','B'].map(team=>`<button type="button" data-round-winner="${team}" style="--letter-team-color:${settings.teamColors[team]}" onclick="letterCellManuallyCompleteRound('${escapeHtml(code)}','${team}')">${escapeHtml(settings.teamNames[team])} فاز</button>`).join('')}
                <button type="button" onclick="letterCellManuallyCompleteRound('${escapeHtml(code)}',null)">تعادل</button>
              </div>
              <div class="letter-cell-result" data-game-result hidden><strong data-game-result-text></strong>
                <button class="btn" type="button" onclick="letterCellRestart('${escapeHtml(code)}')">لعبة جديدة بالإعدادات نفسها</button>
              </div>
            </div>
          </section>
        </div>
        <aside class="letter-cell-sidebar" data-playing-view ${game.phase==='playing'||game.phase==='ended'?'':'hidden'}>
          <section class="letter-cell-panel letter-cell-display-link letter-cell-host-broadcast">
            <span class="host-section-kicker">دعوة اللاعبون</span>
            <div class="letter-cell-broadcast-split">
              <div class="letter-cell-broadcast-invite" data-invite-url="${escapeHtml(inviteUrl)}" id="letterCellInvite">
                <div class="invite-qr" id="letterCellInviteQr" role="img" aria-label="رمز QR للانضمام"></div>
                <div class="invite-actions">
                  <button type="button" class="btn" data-copy>نسخ الرابط</button>
                  ${navigator.share ? `<button type="button" class="btn btn-ghost" data-share>مشاركة</button>` : ''}
                </div>
              </div>
              <div class="letter-cell-broadcast-display">
                <a href="${escapeHtml(letterCellDisplayUrl(code))}" target="_blank" rel="noopener" class="btn">فتح شاشة العرض</a>
                <button class="btn btn-ghost" data-copy-display type="button">نسخ رابط العرض</button>
              </div>
            </div>
          </section>
          <section class="letter-cell-panel letter-cell-host-invite">
            <span class="host-section-kicker">أداة الجرس</span>
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
        </aside>
      </div>
    </main>
  </div>`;
  const root=app.querySelector('.letter-cell-host-stage');
  if(root){
    root.dataset.roomCode=code;
    root.querySelector('#letterCellSettingsForm')?.addEventListener('input',()=>{root.dataset.settingsDraft='true';});
  }
  app.querySelector('[data-letter-cell-exit="lobby"]')?.addEventListener('click',event=>{
    event.preventDefault();
    letterCellRunExitAction(event.currentTarget,()=>window.resetToLobby(code));
  });
  app.querySelector('[data-letter-cell-exit="details"]')?.addEventListener('click',event=>{
    event.preventDefault();
    letterCellRunExitAction(event.currentTarget,()=>window.letterCellReturnToSetup(code));
  });
  app.querySelector('[data-replace-question]')?.addEventListener('click',()=>letterCellReplaceQuestion(code,root?.dataset.selectedCell||''));
  app.querySelector('[data-show-answer]')?.addEventListener('click',()=>letterCellToggleAnswer(code));
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
  tile.classList.toggle('owner-A',owner==='A');
  tile.classList.toggle('owner-B',owner==='B');
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
  if(element){
    element.hidden=hidden;
    element.style.display=hidden?'none':'';
  }
}

function letterCellShowPhase(root,phase){
  if(!root)return;
  root.dataset.phase=phase;
  letterCellSetHidden(root.querySelector('[data-home-view]'),phase!=='home');
  letterCellSetHidden(root.querySelector('[data-settings-screen]'),phase!=='setup');
  root.querySelectorAll('[data-playing-view]').forEach(view=>letterCellSetHidden(view,phase!=='playing'&&phase!=='ended'));
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
  if(root.dataset.phase!==game.phase){
    delete root.dataset.settingsDraft;
    root.dataset.phase=game.phase;
  }
  if(root.dataset.selectedCell!==(selected?.id||''))root.dataset.selectedCell=selected?.id||'';

  letterCellShowPhase(root,game.phase);
  letterCellSetText(root.querySelector('[data-contest-title]'),settings.contestName);
  if(game.phase!=='setup'||!root.dataset.settingsDraft){
    const settingsValues={
      letterCellContestName:settings.contestName,
      letterCellTeamNameA:settings.teamNames.A,
      letterCellTeamNameB:settings.teamNames.B
    };
    Object.entries(settingsValues).forEach(([id,value])=>{
      const input=root.querySelector(`#${id}`);
      if(input&&document.activeElement!==input&&input.value!==value)input.value=value;
    });
    root.querySelectorAll('.letter-cell-contestant').forEach((field,index)=>letterCellSetColor(field,settings.teamColors[index===0?'A':'B']));
    const activeTheme=LETTER_CELL_COLOR_THEMES.findIndex(item=>item.colors.A.toLowerCase()===settings.teamColors.A.toLowerCase()&&item.colors.B.toLowerCase()===settings.teamColors.B.toLowerCase());
    root.querySelectorAll('[data-color-theme]').forEach(button=>{
      const active=Number(button.dataset.colorTheme)===activeTheme;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    root.querySelectorAll('[data-round-option]').forEach(button=>{
      const active=Number(button.dataset.roundOption)===settings.rounds;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    root.querySelectorAll('[data-size-option]').forEach(button=>{
      const active=Number(button.dataset.sizeOption)===settings.cellCount;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    root.querySelectorAll('[data-auto-win]').forEach(button=>{
      const active=(button.dataset.autoWin==='true')===settings.autoWin;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    });
  }

  letterCellSetText(root.querySelector('[data-question-heading]'),selected?`سؤال حرف ${selected.letter}`:'السؤال الحالي');
  const questionText=root.querySelector('[data-question-text]');
  letterCellSetHidden(questionText,!question);
  letterCellSetText(questionText,question?.question||'');
  const placeholder=root.querySelector('[data-question-placeholder]');
  letterCellSetHidden(placeholder,!!question);
  letterCellSetText(placeholder,selected
    ? question?'':'لا يوجد سؤال متاح لهذا الحرف.'
    : 'اختر خلية لعرض سؤالها هنا. لن يظهر السؤال على شاشة العرض.');
  const answerText=root.querySelector('[data-answer-text]');
  const showAnswerBtn=root.querySelector('[data-show-answer]');
  const questionKey=selected?`${selected.id}:${question?.question||''}:${question?.answer||''}`:'';
  if(question){
    letterCellSetText(answerText,question.answer);
    letterCellSetHidden(answerText,true);
    if(showAnswerBtn)showAnswerBtn.textContent='عرض الإجابة';
  }else{
    letterCellSetHidden(answerText,true);
  }
  if(root.dataset.questionKey!==questionKey)root.dataset.questionKey=questionKey;
  const letterEl=root.querySelector('[data-question-letter]');
  if(letterEl)letterEl.title=question?.contributor?'المساهم: '+question.contributor:'';
  const replace=root.querySelector('[data-replace-question]');
  const showAnswer=root.querySelector('[data-show-answer]');
  letterCellSetHidden(replace,!selected);
  letterCellSetHidden(showAnswer,!selected);
  const awardControls=root.querySelector('[data-award-controls]');
  if(awardControls){
    awardControls.querySelectorAll('[data-award-team]').forEach(button=>{
      const team=button.dataset.awardTeam;
      letterCellSetText(button.querySelector('[data-award-team-name]'),settings.teamNames[team]);
      button.setAttribute('aria-label',`احتساب النقطة لـ ${settings.teamNames[team]}`);
      letterCellSetColor(button,settings.teamColors[team]);
    });
  }

  // Sync team scores in sidebar
  root.querySelectorAll('[data-team-score]').forEach(el=>{
    const team=el.dataset.teamScore;
    const score=game.roundWins?.[team]||0;
    letterCellSetText(el,score);
  });
  root.querySelectorAll('.letter-cell-team-card[data-team]').forEach(card=>{
    const team=card.dataset.team;
    letterCellSetText(card.querySelector('.letter-cell-team-name'),settings.teamNames[team]);
    letterCellSetColor(card,settings.teamColors[team]);
  });
  root.querySelectorAll('[data-round-winner]').forEach(button=>{
    const team=button.dataset.roundWinner;
    button.style.setProperty('--letter-team-color',settings.teamColors[team]);
    letterCellSetText(button,`${settings.teamNames[team]} فاز`);
  });

  // Sync sidebar round title (two lines)
  const roundTitle=letterCellRoundTitle(game);
  const line1=root.querySelector('[data-board-round-line1]');
  const line2=root.querySelector('[data-board-round-line2]');
  if(line1)letterCellSetText(line1,'الجولة');
  if(line2)letterCellSetText(line2,roundTitle.replace('الجولة','').trim()||'الأولى');

  const boardMount=root.querySelector('[data-board-mount]');
  const boardWrap = boardMount.querySelector('.letter-cell-board-wrap') ?? boardMount;
  letterCellCurrentBoardWrap = boardWrap;
  const dimension = letterCellBoardDimension(game);
  letterCellUpdateHexSize(boardWrap, dimension);

  // Update cells without full rebuild - only rebuild if structure changed
  const cells=Array.isArray(game.cells)?game.cells:[];
  const existingTiles = [...boardMount.querySelectorAll('[data-cell-id]')];
  const needsRebuild = existingTiles.length !== cells.length;

  if (needsRebuild) {
    boardMount.innerHTML = letterCellBoardHtml(game, true);
    const newWrap = boardMount.querySelector('.letter-cell-board-wrap') ?? boardMount;
    letterCellCurrentBoardWrap = newWrap;
    letterCellUpdateHexSize(newWrap, dimension);
  } else {
    // Update existing tiles in place
    existingTiles.forEach(tile => {
      const cell = cells.find(item => String(item.id) === tile.dataset.cellId);
      if (cell) letterCellUpdateCellDom(tile, cell, game, settings);
    });
  }

  const edgeColors={'.letter-cell-edge-top':settings.teamColors.B,'.letter-cell-edge-bottom':settings.teamColors.B,
    '.letter-cell-edge-left':settings.teamColors.A,'.letter-cell-edge-right':settings.teamColors.A};
  Object.entries(edgeColors).forEach(([selector,color])=>{
    const edge=boardMount.querySelector(selector);
    if(edge&&edge.style.getPropertyValue('--edge-team-color')!==color)edge.style.setProperty('--edge-team-color',color);
  });

  // Update round title
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
  letterCellSetHidden(root.querySelector('[data-manual-round]'),settings.autoWin||game.phase!=='playing'||game.roundComplete);
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
  db.ref(`rooms/${code}`).once('value').then(snapshot=>{
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

window.letterCellOpenSettings=function(code){
  db.ref(`rooms/${code}/letterCell`).transaction(game=>{
    if(!game||game.phase!=='home')return;
    game.phase='setup';
    return game;
  }).then(result=>{
    if(result.committed)letterCellShowPhase(app.querySelector('.letter-cell-host-stage'), 'setup');
    else letterCellShowPhase(app.querySelector('.letter-cell-host-stage'),lastHostRoom?.letterCell?.phase||'home');
  }).catch(error=>{
    console.error('Could not open Letter Cell settings:',error);
    alert('تعذر فتح الإعدادات. تحقق من الاتصال وحاول مرة أخرى.');
  });
};

window.letterCellChooseSetting=function(kind,value){
  const root=app.querySelector('.letter-cell-host-stage');
  if(!root)return;
  root.dataset.settingsDraft='true';
  const selector=kind==='rounds'?'[data-round-option]':kind==='cellCount'?'[data-size-option]':kind==='autoWin'?'[data-auto-win]':kind==='theme'?'[data-color-theme]':null;
  if(!selector)return;
  const expected=String(value);
  root.querySelectorAll(selector).forEach(button=>{
    const actual=kind==='rounds'?button.dataset.roundOption:
      kind==='cellCount'?button.dataset.sizeOption:
        kind==='autoWin'?button.dataset.autoWin:button.dataset.colorTheme;
    const active=actual===expected;
    button.classList.toggle('is-active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  if(kind==='theme'){
    const theme=LETTER_CELL_COLOR_THEMES[value];
    if(theme)root.querySelectorAll('.letter-cell-contestant').forEach((field,index)=>
      letterCellSetColor(field,theme.colors[index===0?'A':'B']));
  }
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
  const root=app.querySelector('.letter-cell-host-stage');
  const rounds=Number(root?.querySelector('[data-round-option].is-active')?.dataset.roundOption);
  const cellCount=Number(root?.querySelector('[data-size-option].is-active')?.dataset.sizeOption);
  const autoWin=root?.querySelector('[data-auto-win].is-active')?.dataset.autoWin==='true';
  const themeIndex=Number(root?.querySelector('[data-color-theme].is-active')?.dataset.colorTheme);
  const selectedTheme=LETTER_CELL_COLOR_THEMES[themeIndex];
  const contestName=document.getElementById('letterCellContestName')?.value.trim();
  const teamNames={A:document.getElementById('letterCellTeamNameA')?.value.trim(),B:document.getElementById('letterCellTeamNameB')?.value.trim()};
  const teamColors=selectedTheme?.colors;
  if(!LETTER_CELL_ROUND_OPTIONS.includes(rounds)||!LETTER_CELL_SIZE_OPTIONS.includes(cellCount)||
     !contestName||!teamNames.A||!teamNames.B||!teamColors){
    alert('تحقق من اسم المسابقة وأسماء المتسابقين والخيارات المحددة.');
    return null;
  }
  return {rounds,cellCount,contestName,autoWin,teamNames,teamColors};
}

function letterCellSaveSettingsTransaction(code,settings){
  return db.ref(`rooms/${code}/letterCell`).transaction(game=>{
    if(!game||game.phase!=='setup')return;
    game.settings=settings;
    game.cells=letterCellMakeBoard(settings.cellCount);
    game.roundsCompleted=0;
    game.roundWins={A:0,B:0};
    game.selectedCell=null;
    game.roundComplete=false;
    game.tieBreak=false;
    game.tieBreakStarted=false;
    game.roundWinner=null;
    game.winner=null;
    game.phase='home';
    return game;
  });
}

window.saveLetterCellSettings=function(code){
  const settings=letterCellReadSettingsForm();
  if(!settings)return;
  letterCellSaveSettingsTransaction(code,settings).then(result=>{
    if(result.committed)letterCellShowPhase(app.querySelector('.letter-cell-host-stage'),'home');
    else alert('تعذر حفظ الإعدادات. ارجع إلى الشاشة الرئيسية ثم حاول مجددًا.');
  }).catch(error=>{
    console.error('Could not save Letter Cell settings:',error);
    alert('تعذر حفظ الإعدادات. تحقق من الاتصال وحاول مرة أخرى.');
  });
};

window.letterCellStartPlay=function(code){
  const setupOpen=app.querySelector('.letter-cell-host-stage')?.dataset.phase==='setup';
  const settings=setupOpen?letterCellReadSettingsForm():null;
  if(setupOpen&&!settings)return;
  const gameRef=db.ref(`rooms/${code}/letterCell`);
  letterCellLoadQuestions().then(()=>gameRef.transaction(game=>{
    if(!game||(game.phase!=='home'&&game.phase!=='setup'))return;
    if(settings){
      game.settings=settings;
      game.cells=letterCellMakeBoard(settings.cellCount);
      game.roundsCompleted=0;
      game.selectedCell=null;
    }
    game.phase='playing';
    return game;
  })).then(result=>{
    if(result.committed){
      letterCellShowPhase(app.querySelector('.letter-cell-host-stage'),'playing');
      return db.ref(`rooms/${code}/buzzer`).update({locked:true,winner:null,pressedAt:null,presses:{},round:0});
    }
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

window.letterCellToggleAnswer=function(code){
  const root=document.querySelector('#app');
  if(!root)return;
  const answerText=root.querySelector('[data-answer-text]');
  const showAnswerBtn=root.querySelector('[data-show-answer]');
  if(!answerText||!showAnswerBtn)return;
  const isHidden=answerText.hidden;
  if(isHidden){
    answerText.hidden=false;
    showAnswerBtn.textContent='إخفاء الإجابة';
  }else{
    answerText.hidden=true;
    showAnswerBtn.textContent='عرض الإجابة';
  }
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
    current.winner=letterCellSettings(current).autoWin&&letterCellConnectedTeam(current,team)?team:null;
    if(current.winner)letterCellCompleteRound(current,team);
    else if(letterCellSettings(current).autoWin&&current.cells.every(item=>item.owner||item.skipped))letterCellCompleteRound(current,null);
    return current;
  }).then(result=>{
    if(!result.committed)return;
    return db.ref(`rooms/${code}/buzzer`).update({locked:true,winner:null,pressedAt:null,presses:{},cellId:null});
  }).catch(error=>{
    console.error('Could not award a Letter Cell:',error);
    alert('تعذر احتساب الخلية. تحقق من الاتصال وحاول مرة أخرى.');
  });
};

window.letterCellManuallyCompleteRound=function(code,team){
  if(team!==null&&team!=='A'&&team!=='B')return;
  db.ref(`rooms/${code}/letterCell`).transaction(current=>{
    if(!current||current.phase!=='playing'||current.roundComplete||letterCellSettings(current).autoWin)return;
    letterCellCompleteRound(current,team);
    return current;
  }).catch(error=>{
    console.error('Could not manually complete a Letter Cell round:',error);
    alert('تعذر احتساب نتيجة الجولة. تحقق من الاتصال وحاول مرة أخرى.');
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
