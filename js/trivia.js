/* أسئلة وتحديات: اختيار الفئات، وسائل المساعدة، ولوحة فريقين */
const TRIVIA_BANK = [
  {id:'geo',name:'حول العالم',icon:'🌍',qs:[
    ['ما عاصمة المملكة العربية السعودية؟','الرياض',['الرياض','جدة','مكة','الدمام'],'تقع في وسط المملكة.'],
    ['ما أكبر قارة في العالم؟','آسيا',['آسيا','أفريقيا','أوروبا','أمريكا الجنوبية'],'تضم الصين والهند.'],
    ['ما النهر الذي يمر في مصر؟','النيل',['النيل','الأمازون','الفرات','الدانوب'],'من أطول أنهار العالم.'],
    ['ما عاصمة اليابان؟','طوكيو',['طوكيو','أوساكا','كيوتو','سيول'],'مدينة يابانية ضخمة تبدأ بحرف ط.'],
    ['ما أكبر محيط على الأرض؟','المحيط الهادئ',['المحيط الهادئ','الأطلسي','الهندي','المتجمد الشمالي'],'يقع بين آسيا وأمريكا.']]},
  {id:'science',name:'علوم',icon:'🔬',qs:[
    ['ما الكوكب المعروف بالكوكب الأحمر؟','المريخ',['المريخ','الزهرة','المشتري','عطارد'],'لونه ناتج عن أكاسيد الحديد.'],
    ['ما الغاز الذي تمتصه النباتات؟','ثاني أكسيد الكربون',['ثاني أكسيد الكربون','الأكسجين','النيتروجين','الهيدروجين'],'تستخدمه في البناء الضوئي.'],
    ['كم عدد عظام جسم الإنسان البالغ تقريبًا؟','206',['206','150','300','412'],'أكثر من مئتي عظمة بقليل.'],
    ['ما أقرب نجم إلى الأرض؟','الشمس',['الشمس','الشعرى اليمانية','سيريوس','النجم القطبي'],'نراه نهارًا.'],
    ['ما وحدة قياس شدة التيار الكهربائي؟','الأمبير',['الأمبير','الفولت','الواط','الأوم'],'سميت نسبة إلى عالم فرنسي.']]},
  {id:'history',name:'تاريخ وحضارة',icon:'🏛️',qs:[
    ['في أي دولة تقع أهرامات الجيزة؟','مصر',['مصر','السودان','العراق','الأردن'],'على ضفاف النيل.'],
    ['ما المدينة التي كانت عاصمة الدولة العباسية؟','بغداد',['بغداد','دمشق','القاهرة','قرطبة'],'أسسها أبو جعفر المنصور.'],
    ['من الرحالة المغربي الشهير الذي جاب بلادًا كثيرة؟','ابن بطوطة',['ابن بطوطة','ابن خلدون','الإدريسي','المسعودي'],'ولد في طنجة.'],
    ['ما الحضارة التي اشتهرت بالكتابة المسمارية؟','السومرية',['السومرية','الرومانية','الإغريقية','الفينيقية'],'نشأت في بلاد الرافدين.'],
    ['في أي عام انتهت الحرب العالمية الثانية؟','1945',['1945','1939','1918','1950'],'بعد ست سنوات من بدايتها.']]},
  {id:'sports',name:'رياضة',icon:'⚽',qs:[
    ['كم لاعبًا في فريق كرة القدم داخل الملعب؟','11',['11','9','10','12'],'حارس المرمى ضمن العدد.'],
    ['كم حلقة في شعار الألعاب الأولمبية؟','5',['5','4','6','7'],'ترمز إلى القارات.'],
    ['ما الرياضة التي يستخدم فيها المضرب والريشة؟','الريشة الطائرة',['الريشة الطائرة','التنس','الإسكواش','تنس الطاولة'],'تُلعب غالبًا في صالة.'],
    ['كم دقيقة مدة مباراة كرة القدم الأصلية؟','90',['90','80','100','60'],'شوطان متساويان.'],
    ['ما الدولة صاحبة أكبر عدد من ألقاب كأس العالم للرجال حتى 2022؟','البرازيل',['البرازيل','ألمانيا','إيطاليا','الأرجنتين'],'فازت باللقب خمس مرات.']]},
  {id:'literature',name:'لغة وأدب',icon:'📚',qs:[
    ['ما جمع كلمة كتاب؟','كتب',['كتب','كتابات','كتابان','كتبة'],'جمع تكسير من ثلاثة أحرف.'],
    ['من مؤلف مسرحية روميو وجولييت؟','وليام شكسبير',['وليام شكسبير','تشارلز ديكنز','جورج أورويل','دانتي'],'كاتب مسرحي إنجليزي.'],
    ['ما ضد كلمة شجاع؟','جبان',['جبان','قوي','كريم','صبور'],'صفة من يخاف المواجهة.'],
    ['كم عدد حروف اللغة العربية؟','28',['28','26','29','30'],'من الألف إلى الياء.'],
    ['من صاحب معلقة قفا نبك؟','امرؤ القيس',['امرؤ القيس','عنترة بن شداد','زهير بن أبي سلمى','طرفة بن العبد'],'شاعر جاهلي اشتهر بالغزل.']]},
  {id:'food',name:'طعام ومطبخ',icon:'🍽️',qs:[
    ['ما المكون الأساسي للحمص؟','الحمص',['الحمص','العدس','الفول','الفاصولياء'],'بقول معروف اسمه هو اسم الطبق.'],
    ['من أي فاكهة يُصنع الزبيب؟','العنب',['العنب','التين','التمر','التفاح'],'تُجفف حباته.'],
    ['ما البهار الذي يعطي الكركم لونه الأصفر؟','الكركم',['الكركم','القرفة','الكمون','الفلفل الأسود'],'يُستخدم أيضًا في الكاري.'],
    ['أي دولة تشتهر بالسوشي؟','اليابان',['اليابان','تايلاند','الصين','كوريا'], 'طبق أرز ياباني مشهور.'],
    ['ما العنصر الذي يجعل العجين ينتفخ؟','الخميرة',['الخميرة','الملح','السكر','الزيت'],'كائنات دقيقة تنتج غازًا.']]},
  {id:'tech',name:'تقنية واختراعات',icon:'💡',qs:[
    ['ما الجهاز المستخدم لإدخال النص إلى الحاسوب؟','لوحة المفاتيح',['لوحة المفاتيح','الشاشة','السماعة','الطابعة'],'تحتوي على أزرار الحروف.'],
    ['ماذا تعني الأحرف WWW؟','الشبكة العنكبوتية العالمية',['الشبكة العنكبوتية العالمية','نظام تشغيل عالمي','اتصال لاسلكي','ذاكرة حاسوب'],'تظهر غالبًا في عناوين المواقع.'],
    ['من مخترع الهاتف الذي نُسب إليه أول براءة اختراع؟','ألكسندر غراهام بيل',['ألكسندر غراهام بيل','توماس إديسون','نيكولا تسلا','جيمس واط'],'عالم اسكتلندي أمريكي.'],
    ['ما لغة التنسيق الشائعة لتصميم صفحات الويب؟','CSS',['CSS','HTML','SQL','Python'],'تتحكم بالألوان والتخطيط.'],
    ['ما اسم أول قمر صناعي أُطلق إلى الفضاء؟','سبوتنيك 1',['سبوتنيك 1','أبولو 11','فوستوك 1','إكسبلورر 1'],'أطلقه الاتحاد السوفيتي عام 1957.']]},
  {id:'nature',name:'طبيعة وحيوانات',icon:'🐾',qs:[
    ['ما أسرع حيوان بري؟','الفهد',['الفهد','الأسد','الحصان','الغزال'],'يُعرف أيضًا بالشيتا.'],
    ['ما الحيوان الملقب بسفينة الصحراء؟','الجمل',['الجمل','الحصان','اللاما','الفيل'],'يتحمل العطش والحرارة.'],
    ['كم ساقًا للعنكبوت؟','8',['8','6','10','12'],'أكثر من الحشرات بزوج أرجل.'],
    ['ما أكبر حيوان يعيش على الأرض؟','الحوت الأزرق',['الحوت الأزرق','الفيل الأفريقي','الزرافة','القرش الأبيض'],'يعيش في المحيط ويعد أضخم الكائنات.'],
    ['ما اسم صغير الضفدع قبل اكتمال نموه؟','شرغوف',['شرغوف','يرقة','فرخ','جرو'],'يعيش في الماء وله ذيل.']]}
];
const TRIVIA_AIDS=[{id:'fifty',name:'حذف خيارين',icon:'✂️'},{id:'hint',name:'تلميح',icon:'💡'},{id:'double',name:'مضاعفة النقاط',icon:'×2'}];

function startTriviaSetup(code){
  const game=TRIVIA_BANK.map(c=>({id:c.id,name:c.name,icon:c.icon}));
  db.ref('rooms/'+code).update({status:'trivia_setup',activeGame:'trivia',trivia:{phase:'setup',categories:game.slice(0,6).map(c=>c.id),aids:{fifty:true,hint:true,double:true},usedAids:{},scores:{A:0,B:0},used:{},teams:{A:'الفريق أ',B:'الفريق ب'},turn:'A'}});
}
function renderTriviaHost(code,room){
  const t=room.trivia||{};
  if(t.phase==='setup') return renderTriviaSetupHost(code,t);
  if(t.phase==='question') return renderTriviaQuestionHost(code,t);
  if(t.phase==='done') return renderTriviaDone(code,t);
  renderTriviaBoard(code,t);
}
function renderTriviaSetupHost(code,t){
  const selected=t.categories||[];
  const cards=TRIVIA_BANK.map(c=>`<button class="trivia-category ${selected.includes(c.id)?'is-selected':''}" onclick="triviaToggleCategory('${code}','${c.id}')"><span>${c.icon}</span><b>${c.name}</b><small>${selected.includes(c.id)?'تم الاختيار':'اختر الفئة'}</small></button>`).join('');
  const aids=TRIVIA_AIDS.map(a=>`<label class="trivia-aid"><input type="checkbox" ${t.aids?.[a.id]?'checked':''} onchange="triviaToggleAid('${code}','${a.id}',this.checked)"><span>${a.icon}</span><b>${a.name}</b></label>`).join('');
  document.getElementById('stage').innerHTML=`<div class="trivia-wrap"><header class="trivia-head"><div><span class="host-section-kicker">تحدي المعرفة</span><h1>جهّزوا الجولة</h1><p>اختاروا 6 فئات، ثم فعّلوا وسائل المساعدة التي تريدونها.</p></div><button class="btn btn-ghost" onclick="resetToLobby('${code}')">إنهاء</button></header><div class="trivia-category-grid">${cards}</div><h2 class="trivia-section-title">وسائل المساعدة</h2><div class="trivia-aids">${aids}</div><button class="btn trivia-start" ${selected.length!==6?'disabled':''} onclick="triviaBegin('${code}')">ابدأ اللعبة · ${selected.length}/6 فئات</button></div>`;
}
window.triviaToggleCategory=(code,id)=>{const ref=db.ref(`rooms/${code}/trivia/categories`);ref.once('value',s=>{let a=s.val()||[];a=a.includes(id)?a.filter(x=>x!==id):(a.length<6?[...a,id]:a);ref.set(a);});};
window.triviaToggleAid=(code,id,on)=>db.ref(`rooms/${code}/trivia/aids/${id}`).set(on);
window.triviaBegin=code=>db.ref(`rooms/${code}`).update({status:'in_game',trivia:{...lastHostRoom.trivia,phase:'board',used:{},usedAids:{},scores:{A:0,B:0},turn:'A'}});
function renderTriviaBoard(code,t){
  const categories=(t.categories||[]).map(id=>TRIVIA_BANK.find(c=>c.id===id)).filter(Boolean);
  const cells=categories.map(c=>`<section class="trivia-column"><h3>${c.icon} ${c.name}</h3>${c.qs.map((q,i)=>{const key=c.id+'_'+i;return `<button class="trivia-cell ${t.used?.[key]?'is-used':''}" ${t.used?.[key]?'disabled':''} onclick="triviaOpenQuestion('${code}','${key}')">${(i+1)*100}</button>`}).join('')}</section>`).join('');
  const scores=t.scores||{A:0,B:0};
  document.getElementById('stage').innerHTML=`<div class="trivia-wrap"><header class="trivia-head"><div><span class="host-section-kicker">لوحة اللعب</span><h1>تحدي المعرفة</h1><p>اختروا سؤالًا، ثم سجّلوا الفريق الذي أجاب إجابة صحيحة.</p></div><button class="btn btn-ghost" onclick="resetToLobby('${code}')">إنهاء اللعبة</button></header><div class="trivia-scoreboard"><div class="trivia-score team-a"><span>${escapeHtml(t.teams?.A||'الفريق أ')}</span><b>${scores.A||0}</b><small>نقطة</small></div><div class="trivia-turn">دور الاختيار<br><b>${escapeHtml(t.teams?.[t.turn]||'الفريق أ')}</b><button onclick="triviaSetTurn('${code}','${t.turn==='A'?'B':'A'}')">تبديل الدور</button></div><div class="trivia-score team-b"><span>${escapeHtml(t.teams?.B||'الفريق ب')}</span><b>${scores.B||0}</b><small>نقطة</small></div></div><div class="trivia-board">${cells}</div><p class="trivia-footnote">النقاط: 100 · 200 · 300 · 400 · 500</p></div>`;
}
window.triviaSetTurn=(code,team)=>db.ref(`rooms/${code}/trivia/turn`).set(team);
window.triviaOpenQuestion=(code,key)=>{const [catId,index]=[key.slice(0,key.lastIndexOf('_')),Number(key.slice(key.lastIndexOf('_')+1))];db.ref(`rooms/${code}/trivia`).once('value',s=>{const t=s.val();db.ref(`rooms/${code}/trivia`).update({phase:'question',current:{key,catId,index,team:t.turn,revealed:false}});});};
function renderTriviaQuestionHost(code,t){
 const c=TRIVIA_BANK.find(x=>x.id===t.current?.catId),q=c?.qs[t.current?.index];if(!q)return renderTriviaBoard(code,t);
 const pts=(t.current.index+1)*100*(t.current.double?2:1);
 const wrongKeep=q[2].find(x=>x!==q[1]);const shownOptions=t.current.fifty?q[2].filter(x=>x===q[1]||x===wrongKeep):q[2];
 const options=shownOptions.map((x,i)=>`<div class="trivia-option">${String.fromCharCode(65+i)} · ${escapeHtml(x)}</div>`).join('');
 document.getElementById('stage').innerHTML=`<div class="trivia-wrap"><div class="trivia-question-card"><span class="host-section-kicker">${c.icon} ${c.name} · ${pts} نقطة</span><h1>${escapeHtml(q[0])}</h1><div class="trivia-options">${options}</div>${t.current.hint?`<div class="trivia-hint">💡 ${escapeHtml(q[3])}</div>`:''}${t.current.revealed?`<div class="trivia-answer">الإجابة الصحيحة: <strong>${escapeHtml(q[1])}</strong></div>`:''}<div class="trivia-actions">${!t.current.revealed?`<button class="btn" onclick="triviaReveal('${code}')">إظهار الإجابة</button>`:`<button class="btn" onclick="triviaScore('${code}','A',${pts})">نقطة لـ ${escapeHtml(t.teams?.A||'الفريق أ')}</button><button class="btn trivia-b" onclick="triviaScore('${code}','B',${pts})">نقطة لـ ${escapeHtml(t.teams?.B||'الفريق ب')}</button><button class="btn btn-ghost" onclick="triviaSkip('${code}')">لا نقاط</button>`}<button class="btn btn-ghost" onclick="triviaBack('${code}')">العودة للوحة</button></div><div class="trivia-question-aids">${t.aids?.fifty&&!t.usedAids?.fifty?`<button onclick="triviaUseAid('${code}','fifty')">✂️ حذف خيارين</button>`:''}${t.aids?.hint&&!t.usedAids?.hint?`<button onclick="triviaUseAid('${code}','hint')">💡 تلميح</button>`:''}${t.aids?.double&&!t.usedAids?.double?`<button onclick="triviaUseAid('${code}','double')">×2 مضاعفة النقاط</button>`:''}</div></div></div>`;
}
window.triviaReveal=code=>db.ref(`rooms/${code}/trivia/current/revealed`).set(true);
window.triviaUseAid=(code,id)=>db.ref(`rooms/${code}/trivia`).once('value',s=>{const t=s.val();if(t.usedAids?.[id])return;const patch={};patch[`usedAids/${id}`]=true;if(id==='fifty')patch['current/fifty']=true;if(id==='hint')patch['current/hint']=true;if(id==='double')patch['current/double']=true;db.ref(`rooms/${code}/trivia`).update(patch);});
window.triviaScore=(code,team,pts)=>finishTriviaQuestion(code,team,pts);
window.triviaSkip=code=>finishTriviaQuestion(code,null,0);
function finishTriviaQuestion(code,team,pts){db.ref(`rooms/${code}/trivia`).once('value',s=>{const t=s.val();if(!t||!t.current)return;const key=t.current.key,used={...(t.used||{}),[key]:true},scores={...(t.scores||{A:0,B:0})};if(team)scores[team]=(scores[team]||0)+pts;const done=Object.keys(used).length>=30;db.ref(`rooms/${code}`).update({status:'in_game',trivia:{...t,phase:done?'done':'board',used,scores,current:null,turn:t.current.team==='A'?'B':'A'}});});}
window.triviaBack=code=>db.ref(`rooms/${code}/trivia`).update({phase:'board',current:null});
function renderTriviaDone(code,t){const a=t.scores?.A||0,b=t.scores?.B||0,winner=a===b?'تعادل!':a>b?(t.teams?.A||'الفريق أ'):(t.teams?.B||'الفريق ب');document.getElementById('stage').innerHTML=`<div class="trivia-wrap trivia-final"><div class="trivia-question-card"><span class="host-section-kicker">نهاية الجولة</span><h1>${a===b?'تعادل رائع!':'🏆 '+escapeHtml(winner)+' يفوز!'}</h1><div class="trivia-scoreboard"><div class="trivia-score team-a"><span>${escapeHtml(t.teams?.A||'الفريق أ')}</span><b>${a}</b></div><div class="trivia-score team-b"><span>${escapeHtml(t.teams?.B||'الفريق ب')}</span><b>${b}</b></div></div><button class="btn" onclick="resetToLobby('${code}')">العودة إلى الردهة</button></div></div>`;}
function renderTriviaPlayer(code,id,name,room){const t=room.trivia||{};app.innerHTML=`<div class="phone"><div class="card trivia-player"><div class="trivia-player-icon">${iconImageHtml('assets/icons/knowledge-challenge.svg','trivia-player-image')}</div><h2>${t.phase==='setup'?'استعدوا للجولة':t.phase==='done'?'انتهت الجولة':'تحدي المعرفة'}</h2><p class="muted">${t.phase==='setup'?'المضيف يختار الفئات ووسائل المساعدة.':t.phase==='done'?'يعرض المضيف النتيجة النهائية.':'تابعوا لوحة اللعب على شاشة المضيف وساعدوا فريقكم بالإجابة!'}</p>${t.phase==='board'?`<div class="trivia-player-scores"><span>${escapeHtml(t.teams?.A||'الفريق أ')} <b>${t.scores?.A||0}</b></span><span>${escapeHtml(t.teams?.B||'الفريق ب')} <b>${t.scores?.B||0}</b></span></div>`:''}</div></div>`;}
