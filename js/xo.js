const XO_WINNING_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

window.toggleXoNetworkInvite=function(){
  const invite=document.getElementById('xoNetworkInvite');
  if(!invite)return;
  invite.hidden=!invite.hidden;
};

window.startXoGame = function(code,mode='network'){
  if(!['local','network','computer'].includes(mode))return;
  const roomRef=db.ref(`rooms/${code}`);
  roomRef.once('value').then(snapshot=>{
    const room=snapshot.val();
    const players=Object.entries(roomPlayersForGame(room||{},'xo'))
      .map(([id,player])=>({id,name:player.name||'لاعب'}));
    if(mode==='network') {
      const hostId=`host-${code}`;
      const user=firebase.auth().currentUser;
      const hostName=user?.displayName||localStorage.getItem('adminGuestName')||'المنظّم';
      const roomPlayers={...(room.players||{}),[hostId]:{name:hostName,gameId:'xo',host:true}};
      return roomRef.update({
        status:'in_game',
        activeGame:'xo',
        players:roomPlayers,
        xo:{mode,phase:'waiting',hostPlayerId:hostId,players:[],board:Array(9).fill(''),turn:'X',startingMark:'X'}
      });
    }
    const participants=mode==='network'
      ? players.slice(0,2).map((player,index)=>({...player,mark:index===0?'X':'O'}))
      : mode==='local'
        ? [{id:'local-x',name:'اللاعب الأول',mark:'X'},{id:'local-o',name:'اللاعب الثاني',mark:'O'}]
        : [{id:'computer-human',name:'أنت',mark:'X'},{id:'computer-opponent',name:'الكمبيوتر',mark:'O'}];
    return roomRef.update({
      status:'in_game',
      activeGame:'xo',
      xo:{mode,phase:'playing',players:participants,board:Array(9).fill(''),turn:'X',startingMark:'X'}
    });
  }).catch(error=>{
    console.error('Could not start X O:',error);
    alert('تعذر بدء اللعبة. تحقق من الاتصال ثم حاول مرة أخرى.');
  });
};

window.ensureXoNetworkStarted = function(code){
  return db.ref(`rooms/${code}`).transaction(room=>{
    if(!room||room.status!=='in_game'||room.activeGame!=='xo'||room.xo?.mode!=='network'||room.xo.phase!=='waiting')return;
    const allPlayers=Object.entries(roomPlayersForGame(room,'xo'))
      .map(([id,player])=>({id,name:player.name||'لاعب'}));
    const host=allPlayers.find(player=>player.id===room.xo.hostPlayerId);
    const guest=allPlayers.find(player=>player.id!==room.xo.hostPlayerId);
    const players=[host,guest].filter(Boolean);
    if(players.length<2)return;
    room.xo={...room.xo,phase:'playing',players:players.map((player,index)=>({...player,mark:index===0?'X':'O'})),board:Array(9).fill(''),turn:'X',startingMark:'X'};
    return room;
  }).catch(error=>console.error('Could not start network X O automatically:',error));
};

function xoWinner(board){
  for(const [first,second,third] of XO_WINNING_LINES){
    if(board[first]&&board[first]===board[second]&&board[first]===board[third])return board[first];
  }
  return null;
}

function xoBoardMarkup(game,playerId=null,code='',hostInteraction=false){
  const board=Array.isArray(game?.board)?game.board:Array(9).fill(null);
  return `<div class="xo-board" role="grid" aria-label="لوحة إكس أو">${board.map((mark,index)=>{
    const player=game?.players?.find(item=>item.id===playerId);
    const isNetwork=game?.mode==='network';
    const canPlay=game?.phase==='playing'&&!mark&&(
      isNetwork
        ? !!player&&player.mark===game.turn
        : hostInteraction&&(game.mode==='local'||(game.mode==='computer'&&game.turn==='X'))
    );
    return `<button type="button" class="xo-cell ${mark==='X'?'is-x':mark==='O'?'is-o':''}" role="gridcell" aria-label="الخانة ${index+1}${mark?` ${mark}`:''}" ${canPlay?'': 'disabled'} onclick="xoPlayMove('${code}','${playerId||''}',${index})">${mark||''}</button>`;
  }).join('')}</div>`;
}

function xoStatus(game,playerId=null){
  if(!game)return 'بانتظار المنظّم لبدء اللعبة.';
  if(game.phase==='waiting')return 'بانتظار انضمام اللاعب الثاني لبدء اللعبة تلقائيًا.';
  const winningMark=game.winner||xoWinner(game.board||[]);
  if(winningMark){
    const winner=game.players?.find(player=>player.mark===winningMark);
    return `فاز ${winner?.name||winningMark}!`;
  }
  if(game.phase==='draw')return 'تعادل! لا توجد خانات فارغة.';
  const turnPlayer=game.players?.find(player=>player.mark===game.turn);
  if(game.mode==='local')return `دور ${turnPlayer?.name||'اللاعب'} (${game.turn})`;
  if(game.mode==='computer')return game.turn==='X'?'دورك الآن — X':'الكمبيوتر يفكر…';
  if(playerId){
    const player=game.players?.find(item=>item.id===playerId);
    if(!player)return 'أنت متفرّج في هذه الجولة؛ يتسع اللعب للاعبين.';
    return player.mark===game.turn?`دورك الآن — ${player.mark}`:`بانتظار ${turnPlayer?.name||'اللاعب الآخر'} (${game.turn})`;
  }
  return `الدور على ${turnPlayer?.name||'اللاعب'} — ${game.turn}`;
}

window.xoPlayMove=function(code,playerId,index){
  if(!Number.isInteger(index)||index<0||index>8)return;
  db.ref(`rooms/${code}/xo`).transaction(game=>{
    if(!game||game.phase!=='playing'||!Array.isArray(game.board)||game.board[index])return;
    let mark;
    if(game.mode==='network'){
      const player=game.players?.find(item=>item.id===playerId);
      if(!player||player.mark!==game.turn)return;
      mark=player.mark;
    }else if(game.mode==='local'){
      mark=game.turn;
    }else if(game.mode==='computer'&&game.turn==='X'&&!playerId){
      mark='X';
    }else return;
    game.board[index]=mark;
    const winner=xoWinner(game.board);
    if(winner){
      game.phase='won';
      game.winner=winner;
    }else if(game.board.every(Boolean)){
      game.phase='draw';
    }else{
      game.turn=game.turn==='X'?'O':'X';
    }
    return game;
  }).then(result=>{
    if(result.committed&&result.snapshot.val()?.mode==='computer')xoPlayComputerMove(code);
  }).catch(error=>console.error('Could not play X O move:',error));
};

function xoMinimax(board,turn,memo=new Map()){
  const key=`${board.join('')}:${turn}`;
  if(memo.has(key))return memo.get(key);
  const winner=xoWinner(board);
  if(winner==='O')return 10;
  if(winner==='X')return -10;
  if(board.every(Boolean))return 0;
  const scores=board.map((cell,index)=>{
    if(cell)return null;
    const next=board.slice();
    next[index]=turn;
    return xoMinimax(next,turn==='O'?'X':'O',memo);
  }).filter(score=>score!==null);
  const bestScore=turn==='O'?Math.max(...scores):Math.min(...scores);
  memo.set(key,bestScore);
  return bestScore;
}

function xoBestComputerMove(board){
  let bestScore=-Infinity,bestMoves=[];
  const memo=new Map();
  board.forEach((cell,index)=>{
    if(cell)return;
    const next=board.slice();
    next[index]='O';
    const score=xoMinimax(next,'X',memo);
    if(score>bestScore){bestScore=score;bestMoves=[index];}
    else if(score===bestScore)bestMoves.push(index);
  });
  return bestMoves[Math.floor(Math.random()*bestMoves.length)];
}

function xoPlayComputerMove(code){
  db.ref(`rooms/${code}/xo`).transaction(game=>{
    if(!game||game.mode!=='computer'||game.phase!=='playing'||game.turn!=='O')return;
    const index=xoBestComputerMove(game.board||[]);
    if(!Number.isInteger(index))return;
    game.board[index]='O';
    const winner=xoWinner(game.board);
    if(winner){game.phase='won';game.winner=winner;}
    else if(game.board.every(Boolean))game.phase='draw';
    else game.turn='X';
    return game;
  }).catch(error=>console.error('Could not play computer X O move:',error));
}

window.xoStartNextRound=function(code){
  db.ref(`rooms/${code}/xo`).transaction(game=>{
    if(!game||!['won','draw'].includes(game.phase))return;
    const startingMark=game.mode==='computer'?'X':game.startingMark==='X'?'O':'X';
    return {...game,phase:'playing',board:Array(9).fill(''),turn:startingMark,startingMark,winner:null};
  }).catch(error=>console.error('Could not start the next X O round:',error));
};

function renderXoHost(code,room){
  const game=room.xo||null;
  if(game?.phase==='waiting'){
    const inviteUrl=joinGameUrl(code,'xo');
    document.getElementById('stage').innerHTML=`
      ${activityExitControlsHtml(code,'xo')}
      <main class="xo-screen xo-host-screen">
        <header class="xo-heading"><span class="host-section-kicker">اللعب عن طريق الشبكة</span><h1>إكس أو</h1><p>أرسل الدعوة وانتظر انضمام اللاعب الثاني؛ تبدأ اللعبة تلقائيًا.</p></header>
        ${joinCardHtml('xoNetworkLobbyInvite',inviteUrl)}
      </main>`;
    initJoinCard('xoNetworkLobbyInvite',inviteUrl);
    return;
  }
  const participants=game?.players||[];
  const hostPlayerId=game?.players?.find(player=>player.id===game.hostPlayerId)?.id||game?.hostPlayerId;
  const spectators=game?.mode==='network'
    ? Object.entries(room.players||{}).filter(([id])=>!participants.some(player=>player.id===id))
    : [];
  const result=game?.phase==='won'||game?.phase==='draw';
  const modeTitle={local:'اللعب على جهازي',network:'اللعب عن طريق الشبكة',computer:'اللعب مع الكمبيوتر'}[game?.mode]||'';
  document.getElementById('stage').innerHTML=`
    ${activityExitControlsHtml(code,'xo')}
    <main class="xo-screen xo-host-screen">
      <header class="xo-heading"><span class="host-section-kicker">${modeTitle}</span><h1>إكس أو</h1><p>${escapeHtml(xoStatus(game))}</p></header>
      <div class="xo-scoreboard">${participants.map(player=>`<div class="xo-player ${game?.turn===player.mark&&game?.phase==='playing'?'is-turn':''}"><span class="xo-mark ${player.mark==='X'?'is-x':'is-o'}">${player.mark}</span><strong>${escapeHtml(player.name)}</strong></div>`).join('')}</div>
      ${game?.winner?winnerCelebrationHtml():''}
      ${xoBoardMarkup(game,hostPlayerId,code,true)}
      ${result?`<button type="button" class="btn xo-next-round" onclick="xoStartNextRound('${code}')">جولة جديدة</button>`:''}
      ${spectators.length?`<p class="xo-spectators">المشاهدون: ${spectators.map(([,player])=>escapeHtml(player.name||'لاعب')).join('، ')}</p>`:''}
    </main>`;
}

function renderXoPlayer(code,playerId,name,room){
  const game=room.xo||null;
  const player=game?.players?.find(item=>item.id===playerId);
  const canPlayNetwork=game?.mode==='network';
  if(game?.phase==='waiting'){
    app.innerHTML=`<main class="xo-screen xo-player-screen"><header class="xo-heading"><span class="host-section-kicker">اللعب عن طريق الشبكة</span><h1>إكس أو</h1><p>تم انضمامك يا ${escapeHtml(name)}. بانتظار اللاعب الثاني لبدء اللعبة تلقائيًا.</p></header></main>`;
    return;
  }
  app.innerHTML=`
    <main class="xo-screen xo-player-screen">
      <header class="xo-heading"><span class="host-section-kicker">${game?.mode==='network'?'اللعب عن طريق الشبكة':game?.mode==='computer'?'اللعب مع الكمبيوتر':'اللعب على جهاز المنظّم'}</span><h1>إكس أو</h1><p>أهلًا ${escapeHtml(name)} · ${escapeHtml(xoStatus(game,playerId))}</p></header>
      ${player?`<div class="xo-player-badge">رمزك <strong class="xo-mark ${player.mark==='X'?'is-x':'is-o'}">${player.mark}</strong></div>`:''}
      ${game?.winner?winnerCelebrationHtml():''}
      ${xoBoardMarkup(game,canPlayNetwork?playerId:null,code)}
      ${game?.phase==='won'||game?.phase==='draw'?'<p class="xo-round-result">انتهت الجولة، ينتظر الجميع بدء جولة جديدة.</p>':''}
    </main>`;
}
