/* ---------- أداة لوح الرسم المشترك ---------- */
const DRAW_BOARD_MAX_PLAYERS=6;
const DRAW_BOARD_COLORS=['#111827','#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#ffffff'];
let drawBoardHostCleanup=null;
let drawBoardPlayerCleanup=null;

function drawBoardRef(code,playerId){
  return db.ref(`rooms/${code}/drawingBoards/${playerId}`);
}
function stopDrawBoardHost(){
  if(drawBoardHostCleanup){drawBoardHostCleanup();drawBoardHostCleanup=null;}
}
function stopDrawBoardPlayer(){
  if(drawBoardPlayerCleanup){drawBoardPlayerCleanup();drawBoardPlayerCleanup=null;}
}
function drawBoardPaletteHtml(){
  return DRAW_BOARD_COLORS.map((color,index)=>`<button type="button" class="drawboard-color ${index===0?'is-selected':''}" style="--drawboard-color:${color}" aria-label="لون ${color}" aria-pressed="${index===0}" onclick="setDrawBoardColor('${color}',this)"></button>`).join('');
}

window.setDrawBoardColor=(color,button)=>{
  const input=document.getElementById('drawBoardColorInput');
  if(input)input.value=color;
  document.querySelectorAll('.drawboard-color').forEach(item=>{
    item.classList.toggle('is-selected',item===button);
    item.setAttribute('aria-pressed',item===button?'true':'false');
  });
  document.getElementById('drawBoardEraser')?.classList.remove('is-active');
};
window.setDrawBoardEraser=button=>{
  button.classList.toggle('is-active');
  document.querySelectorAll('.drawboard-color').forEach(item=>{
    item.classList.remove('is-selected');
    item.setAttribute('aria-pressed','false');
  });
};

window.startDrawBoardTool=async code=>{
  hostDetailGameId=null;
  try{
    await db.ref(`rooms/${code}`).update({
      status:'in_tool',activeGame:null,activeTool:'drawboard',players:{},
      drawingBoards:null,drawBoardSession:Date.now()
    });
  }catch(error){
    console.error('Could not start shared drawing boards:',error);
    alert(`تعذر بدء لوح الرسم: ${error.message||'تحقق من الاتصال والصلاحيات وحاول مرة أخرى.'}`);
  }
};

function renderDrawBoardHost(code,room){
  stopDrawBoardHost();
  const players=Object.entries(room.players||{}).slice(0,DRAW_BOARD_MAX_PLAYERS);
  const inviteUrl=joinGameUrl(code,'drawboard');
  const boards=players.map(([id,player],index)=>`
    <article class="drawboard-host-card">
      <header><div><span>الرسام ${index+1}</span><h2>${escapeHtml(player.name||'رسام')}</h2></div>
        <button type="button" class="drawboard-pointer-toggle" aria-pressed="false" onclick="toggleDrawBoardPointer('${id}',this)">إظهار المؤشر</button>
      </header>
      <div class="drawboard-canvas-wrap"><canvas class="drawboard-host-canvas" id="drawBoardCanvas-${id}" width="640" height="420" aria-label="لوحة ${escapeHtml(player.name||'الرسام')}"></canvas><span class="drawboard-pointer" id="drawBoardPointer-${id}" aria-hidden="true"></span></div>
    </article>`).join('');
  document.getElementById('stage').innerHTML=`
    ${activityExitControlsHtml(code,'drawboard')}
    <main class="drawboard-host-screen">
      <header class="drawboard-heading"><div><span class="host-section-kicker">أداة مساندة · من ٢ إلى ٦ رسامين</span><h1>لوح الرسم المشترك</h1><p>كل رسام يرسم على لوحته، وتظهر الرسومات والمؤشرات مباشرة هنا.</p></div><b class="drawboard-count">${players.length} / ${DRAW_BOARD_MAX_PLAYERS}</b></header>
      <div class="drawboard-host-content">${joinCardHtml('drawBoardInvite',inviteUrl)}
        <section class="drawboard-host-boards" aria-label="لوحات الرسامين">${boards||'<p class="drawboard-empty">أرسل رمز QR أو الرابط للرسامين. ستظهر اللوحات هنا عند انضمامهم.</p>'}</section>
      </div>
    </main>`;
  initJoinCard('drawBoardInvite',inviteUrl);
  const cleanups=[];
  players.forEach(([id])=>cleanups.push(mirrorDrawBoard(code,id)));
  drawBoardHostCleanup=()=>cleanups.forEach(cleanup=>cleanup());
}

function mirrorDrawBoard(code,playerId){
  const canvas=document.getElementById(`drawBoardCanvas-${playerId}`);
  const cursor=document.getElementById(`drawBoardPointer-${playerId}`);
  if(!canvas)return ()=>{};
  const ctx=canvas.getContext('2d');
  if(!ctx)return ()=>{};
  const baseRef=drawBoardRef(code,playerId);
  const strokesRef=baseRef.child('strokes');
  let disposed=false;
  const pointCounts=new Map();
  const redraw=()=>{
    strokesRef.once('value').then(snapshot=>{
      if(disposed||!canvas.isConnected)return;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      Object.values(snapshot.val()||{}).forEach(stroke=>drawSegment(ctx,canvas,stroke));
    }).catch(error=>console.error('Could not refresh shared drawing board:',error));
  };
  const addStroke=snapshot=>{
    const stroke=snapshot.val();
    if(stroke?.points)pointCounts.set(snapshot.key,stroke.points.length);
    drawSegment(ctx,canvas,stroke);
  };
  const updateStroke=snapshot=>{
    const stroke=snapshot.val(),previousCount=pointCounts.get(snapshot.key)||0;
    if(!stroke?.points)return;
    if(previousCount&&stroke.points.length>previousCount){
      drawSegment(ctx,canvas,{...stroke,points:stroke.points.slice(Math.max(0,previousCount-1))});
    }else redraw();
    pointCounts.set(snapshot.key,stroke.points.length);
  };
  const updateCursor=snapshot=>{
    const point=snapshot.val();
    if(!cursor||!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)){
      if(cursor)cursor.hidden=true;
      return;
    }
    cursor.style.left=`${point.x*100}%`;
    cursor.style.top=`${point.y*100}%`;
    cursor.hidden=false;
  };
  strokesRef.on('child_added',addStroke);
  strokesRef.on('child_changed',updateStroke);
  strokesRef.on('child_removed',updateStroke);
  baseRef.child('cursor').on('value',updateCursor);
  return ()=>{
    disposed=true;
    strokesRef.off('child_added',addStroke);
    strokesRef.off('child_changed',updateStroke);
    strokesRef.off('child_removed',updateStroke);
    baseRef.child('cursor').off('value',updateCursor);
  };
}

window.toggleDrawBoardPointer=(playerId,button)=>{
  const canvas=document.getElementById(`drawBoardCanvas-${playerId}`);
  if(!canvas)return;
  const visible=!canvas.classList.contains('show-pointer');
  canvas.classList.toggle('show-pointer',visible);
  button.setAttribute('aria-pressed',visible?'true':'false');
  button.classList.toggle('is-active',visible);
  button.textContent=visible?'إخفاء المؤشر':'إظهار المؤشر';
};

function renderDrawBoardPlayerCanvas(code,myId,name){
  stopDrawBoardPlayer();
  const escapedName=escapeHtml(name);
  app.innerHTML=`
    <main class="drawboard-player-screen">
      <header class="drawboard-player-heading"><div><span class="host-section-kicker">لوح الرسم المشترك</span><h1>لوحتك يا ${escapedName}</h1></div><span class="drawboard-live"><i></i> مباشر</span></header>
      <div class="drawboard-toolbar" role="toolbar" aria-label="أدوات الرسم">
        <div class="drawboard-palette">${drawBoardPaletteHtml()}</div>
        <label class="drawboard-custom-color" title="اختيار لون"><span>لون</span><input id="drawBoardColorInput" type="color" value="#111827" aria-label="اختيار لون مخصص"></label>
        <label class="drawboard-size-control" for="drawBoardBrushSize">حجم القلم <input id="drawBoardBrushSize" type="range" min="2" max="28" value="6"><output id="drawBoardBrushValue">6</output></label>
        <button type="button" class="drawboard-tool-button" id="drawBoardEraser" onclick="setDrawBoardEraser(this)">ممحاة</button>
        <button type="button" class="drawboard-tool-button" onclick="undoDrawBoardStroke('${code}','${myId}')">تراجع</button>
        <button type="button" class="drawboard-tool-button is-danger" onclick="clearDrawBoard('${code}','${myId}')">مسح لوحتي</button>
      </div>
      <div class="drawboard-player-canvas-wrap"><canvas id="drawBoardPlayerCanvas" width="640" height="420" aria-label="ارسم هنا"></canvas></div>
      <p class="drawboard-player-status" id="drawBoardStatus" role="status">كل ما ترسمه يظهر مباشرة على شاشة المنظّم.</p>
    </main>`;
  const canvas=document.getElementById('drawBoardPlayerCanvas');
  const ctx=canvas?.getContext('2d');
  if(!canvas||!ctx)return;
  const boardRef=drawBoardRef(code,myId),strokesRef=boardRef.child('strokes');
  boardRef.child('cursor').onDisconnect().remove().catch(error=>console.error('Could not register drawing cursor cleanup:',error));
  const colorInput=document.getElementById('drawBoardColorInput');
  const sizeInput=document.getElementById('drawBoardBrushSize');
  const sizeOutput=document.getElementById('drawBoardBrushValue');
  let drawing=false,points=[],strokeRef=null,activeColor='#111827',activeSize=6;
  let lastCursorWrite=0,cursorTimer=null,persistTimer=null,pendingCursor=null,disposed=false;
  const localStrokeIds=new Set();
  const paint=(snapshot,stroke=snapshot.val())=>{
    if(localStrokeIds.has(snapshot.key))return;
    drawSegment(ctx,canvas,stroke);
  };
  const redraw=()=>{
    strokesRef.once('value').then(snapshot=>{
      if(disposed||!canvas.isConnected)return;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      Object.values(snapshot.val()||{}).forEach(stroke=>drawSegment(ctx,canvas,stroke));
    }).catch(error=>setDrawBoardStatus(`تعذر تحديث اللوحة (${error.code||'خطأ اتصال'}).`));
  };
  const pointFromEvent=event=>{
    const rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return null;
    return {x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))};
  };
  const getColor=()=>document.getElementById('drawBoardEraser')?.classList.contains('is-active')?'#ffffff':(colorInput?.value||'#111827');
  const currentStroke=()=>({points:points.slice(),color:activeColor,size:activeSize,playerId:myId});
  const persistStroke=()=>{
    persistTimer=null;
    if(strokeRef)strokeRef.set(currentStroke()).catch(error=>setDrawBoardStatus(`تعذر بث الرسم (${error.code||'خطأ اتصال'}).`));
  };
  const sendCursor=point=>{
    pendingCursor=point;
    const now=Date.now();
    const flush=()=>{
      cursorTimer=null;
      if(disposed||!pendingCursor)return;
      const cursor=pendingCursor;
      pendingCursor=null;
      lastCursorWrite=Date.now();
      boardRef.child('cursor').set(cursor).catch(error=>console.error('Could not send drawing cursor:',error));
    };
    const wait=50-(now-lastCursorWrite);
    if(wait<=0){
      clearTimeout(cursorTimer);
      flush();
    }else if(!cursorTimer){
      cursorTimer=setTimeout(flush,wait);
    }
  };
  const begin=event=>{
    if(drawing||event.button!==undefined&&event.button!==0)return;
    event.preventDefault();
    const point=pointFromEvent(event);
    if(!point)return;
    drawing=true;
    points=[point];
    activeColor=getColor();
    activeSize=Number(sizeInput?.value)||6;
    strokeRef=strokesRef.push();
    localStrokeIds.add(strokeRef.key);
    drawSegment(ctx,canvas,currentStroke());
    persistStroke();
    sendCursor(point);
    if(event.pointerId!==undefined)canvas.setPointerCapture?.(event.pointerId);
  };
  const move=event=>{
    const point=pointFromEvent(event);
    if(!point)return;
    sendCursor(point);
    if(!drawing)return;
    event.preventDefault();
    const previous=points[points.length-1];
    points.push(point);
    drawSegment(ctx,canvas,{...currentStroke(),points:[previous,point]});
    if(!persistTimer)persistTimer=setTimeout(persistStroke,50);
  };
  const finish=()=>{
    if(!drawing)return;
    drawing=false;
    clearTimeout(persistTimer);
    persistTimer=null;
    persistStroke();
    points=[];
    strokeRef=null;
  };
  const addStroke=snapshot=>paint(snapshot);
  const updateStroke=snapshot=>paint(snapshot);
  strokesRef.on('child_added',addStroke);
  strokesRef.on('child_changed',updateStroke);
  strokesRef.on('child_removed',redraw);
  canvas.addEventListener('pointerdown',begin);
  window.addEventListener('pointermove',move,{passive:false});
  window.addEventListener('pointerup',finish);
  window.addEventListener('pointercancel',finish);
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  sizeInput?.addEventListener('input',()=>{if(sizeOutput)sizeOutput.value=sizeInput.value;});
  colorInput?.addEventListener('input',()=>document.getElementById('drawBoardEraser')?.classList.remove('is-active'));
  drawBoardPlayerCleanup=()=>{
    disposed=true;
    clearTimeout(cursorTimer);
    clearTimeout(persistTimer);
    canvas.removeEventListener('pointerdown',begin);
    window.removeEventListener('pointermove',move);
    window.removeEventListener('pointerup',finish);
    window.removeEventListener('pointercancel',finish);
    strokesRef.off('child_added',addStroke);
    strokesRef.off('child_changed',updateStroke);
    strokesRef.off('child_removed',redraw);
    boardRef.child('cursor').remove().catch(error=>console.error('Could not clear drawing cursor:',error));
  };
}

function setDrawBoardStatus(message){
  const status=document.getElementById('drawBoardStatus');
  if(status)status.textContent=message;
}
window.undoDrawBoardStroke=async(code,myId)=>{
  try{
    const strokesRef=drawBoardRef(code,myId).child('strokes');
    const result=await strokesRef.transaction(strokes=>{
      if(!strokes)return;
      const updated={...strokes},lastKey=Object.keys(updated).sort().pop();
      if(lastKey)delete updated[lastKey];
      return updated;
    });
    if(!result.committed)setDrawBoardStatus('لا توجد خطوط للتراجع عنها.');
  }catch(error){
    console.error('Could not undo drawing stroke:',error);
    setDrawBoardStatus('تعذر التراجع عن الرسم. تحقق من الاتصال.');
  }
};
window.clearDrawBoard=async(code,myId)=>{
  try{await drawBoardRef(code,myId).child('strokes').remove();}
  catch(error){console.error('Could not clear drawing board:',error);setDrawBoardStatus('تعذر مسح اللوحة. تحقق من الاتصال.');}
};

function renderDrawBoardPlayerNotice(){
  app.innerHTML='<div class="phone"><div class="card"><h2>لوح الرسم المشترك</h2><p class="muted">بانتظار المنظّم لفتح اللوح.</p></div></div>';
}

function registerDrawBoardPlayer(roomRef,playerId,record){
  const playersRef=roomRef.child('players');
  return playersRef.transaction(players=>{
    const current=players||{};
    if(current[playerId])return current;
    if(Object.keys(current).length>=DRAW_BOARD_MAX_PLAYERS)return;
    return {...current,[playerId]:record};
  }).then(async result=>{
    if(!result.committed)throw new Error('اكتمل العدد الأقصى للرسامين (٦).');
    await roomRef.child(`players/${playerId}`).onDisconnect().remove();
  });
}

window.renderDrawBoardHost=renderDrawBoardHost;
window.renderDrawBoardPlayer=(code,myId,name,room)=>{
  if(room.status==='in_tool'&&room.activeTool==='drawboard'){
    renderDrawBoardPlayerCanvas(code,myId,name);
    return;
  }
  stopDrawBoardPlayer();
  renderDrawBoardPlayerNotice();
};
window.registerDrawBoardPlayer=registerDrawBoardPlayer;
window.stopDrawBoardHost=stopDrawBoardHost;
window.stopDrawBoardPlayer=stopDrawBoardPlayer;
