const XO_WINNING_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

window.startXoGame = function(code){
  const roomRef=db.ref(`rooms/${code}`);
  roomRef.once('value').then(snapshot=>{
    const room=snapshot.val();
    const players=Object.entries(roomPlayersForGame(room||{},'xo'))
      .map(([id,player])=>({id,name:player.name||'لاعب'}));
    if(players.length<2){
      alert('تحتاج لعبة إكس أو إلى لاعبين اثنين على الأقل.');
      return;
    }
    const participants=players.slice(0,2).map((player,index)=>({...player,mark:index===0?'X':'O'}));
    return roomRef.update({
      status:'in_game',
      activeGame:'xo',
      xo:{phase:'playing',players:participants,board:Array(9).fill(''),turn:'X',startingMark:'X'}
    });
  }).catch(error=>{
    console.error('Could not start X O:',error);
    alert('تعذر بدء اللعبة. تحقق من الاتصال ثم حاول مرة أخرى.');
  });
};

function xoWinner(board){
  for(const [first,second,third] of XO_WINNING_LINES){
    if(board[first]&&board[first]===board[second]&&board[first]===board[third])return board[first];
  }
  return null;
}

function xoBoardMarkup(game,playerId=null,code=''){
  const board=Array.isArray(game?.board)?game.board:Array(9).fill(null);
  return `<div class="xo-board" role="grid" aria-label="لوحة إكس أو">${board.map((mark,index)=>{
    const player=game?.players?.find(item=>item.id===playerId);
    const canPlay=game?.phase==='playing'&&player?.mark===game.turn&&!mark;
    return `<button type="button" class="xo-cell ${mark==='X'?'is-x':mark==='O'?'is-o':''}" role="gridcell" aria-label="الخانة ${index+1}${mark?` ${mark}`:''}" ${canPlay?'': 'disabled'} onclick="xoPlayMove('${code}','${playerId||''}',${index})">${mark||''}</button>`;
  }).join('')}</div>`;
}

function xoStatus(game,playerId=null){
  if(!game)return 'بانتظار المنظّم لبدء اللعبة.';
  const winningMark=game.winner||xoWinner(game.board||[]);
  if(winningMark){
    const winner=game.players?.find(player=>player.mark===winningMark);
    return `فاز ${winner?.name||winningMark}!`;
  }
  if(game.phase==='draw')return 'تعادل! لا توجد خانات فارغة.';
  const turnPlayer=game.players?.find(player=>player.mark===game.turn);
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
    const player=game.players?.find(item=>item.id===playerId);
    if(!player||player.mark!==game.turn)return;
    game.board[index]=player.mark;
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
  }).catch(error=>console.error('Could not play X O move:',error));
};

window.xoStartNextRound=function(code){
  db.ref(`rooms/${code}/xo`).transaction(game=>{
    if(!game||!['won','draw'].includes(game.phase))return;
    const startingMark=game.startingMark==='X'?'O':'X';
    return {...game,phase:'playing',board:Array(9).fill(''),turn:startingMark,startingMark,winner:null};
  }).catch(error=>console.error('Could not start the next X O round:',error));
};

function renderXoHost(code,room){
  const game=room.xo||null;
  const participants=game?.players||[];
  const spectators=Object.entries(room.players||{}).filter(([id])=>!participants.some(player=>player.id===id));
  const result=game?.phase==='won'||game?.phase==='draw';
  document.getElementById('stage').innerHTML=`
    ${activityExitControlsHtml(code,'xo')}
    <main class="xo-screen xo-host-screen">
      <header class="xo-heading"><span class="host-section-kicker">لعبة لاعبين · إكس أو</span><h1>إكس أو</h1><p>${escapeHtml(xoStatus(game))}</p></header>
      <div class="xo-scoreboard">${participants.map(player=>`<div class="xo-player ${game?.turn===player.mark&&game?.phase==='playing'?'is-turn':''}"><span class="xo-mark ${player.mark==='X'?'is-x':'is-o'}">${player.mark}</span><strong>${escapeHtml(player.name)}</strong></div>`).join('')}</div>
      ${xoBoardMarkup(game,null,code)}
      ${result?`<button type="button" class="btn xo-next-round" onclick="xoStartNextRound('${code}')">جولة جديدة</button>`:''}
      ${spectators.length?`<p class="xo-spectators">المشاهدون: ${spectators.map(([,player])=>escapeHtml(player.name||'لاعب')).join('، ')}</p>`:''}
    </main>`;
}

function renderXoPlayer(code,playerId,name,room){
  const game=room.xo||null;
  const player=game?.players?.find(item=>item.id===playerId);
  app.innerHTML=`
    <main class="xo-screen xo-player-screen">
      <header class="xo-heading"><span class="host-section-kicker">لعبة لاعبين</span><h1>إكس أو</h1><p>أهلًا ${escapeHtml(name)} · ${escapeHtml(xoStatus(game,playerId))}</p></header>
      ${player?`<div class="xo-player-badge">رمزك <strong class="xo-mark ${player.mark==='X'?'is-x':'is-o'}">${player.mark}</strong></div>`:''}
      ${xoBoardMarkup(game,playerId,code)}
      ${game?.phase==='won'||game?.phase==='draw'?'<p class="xo-round-result">انتهت الجولة، ينتظر الجميع بدء جولة جديدة.</p>':''}
    </main>`;
}
