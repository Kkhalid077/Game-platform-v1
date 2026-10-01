/* أسئلة وتحديات: اختيار الفئات، وسائل المساعدة، ولوحة فريقين */
const TRIVIA_BANK = [
  {id:'geo',name:'حول العالم',sticker:'assets/icons/category-geo.svg',qs:[
    ['ما عاصمة المملكة العربية السعودية؟','الرياض',['الرياض','جدة','مكة','الدمام'],'تقع في وسط المملكة.'],
    ['ما أكبر قارة في العالم؟','آسيا',['آسيا','أفريقيا','أوروبا','أمريكا الجنوبية'],'تضم الصين والهند.'],
    ['ما النهر الذي يمر في مصر؟','النيل',['النيل','الأمازون','الفرات','الدانوب'],'من أطول أنهار العالم.'],
    ['ما عاصمة اليابان؟','طوكيو',['طوكيو','أوساكا','كيوتو','سيول'],'مدينة يابانية ضخمة تبدأ بحرف ط.'],
    ['ما أكبر محيط على الأرض؟','المحيط الهادئ',['المحيط الهادئ','الأطلسي','الهندي','المتجمد الشمالي'],'يقع بين آسيا وأمريكا.'],
    ['ما عاصمة إيطاليا؟','روما',['روما','ميلانو','البندقية','فلورنسا'],'مدينة تاريخية يمر فيها نهر التيبر.']]},
  {id:'science',name:'علوم',sticker:'assets/icons/category-science.svg',qs:[
    ['ما الكوكب المعروف بالكوكب الأحمر؟','المريخ',['المريخ','الزهرة','المشتري','عطارد'],'لونه ناتج عن أكاسيد الحديد.'],
    ['ما الغاز الذي تمتصه النباتات؟','ثاني أكسيد الكربون',['ثاني أكسيد الكربون','الأكسجين','النيتروجين','الهيدروجين'],'تستخدمه في البناء الضوئي.'],
    ['كم عدد عظام جسم الإنسان البالغ تقريبًا؟','206',['206','150','300','412'],'أكثر من مئتي عظمة بقليل.'],
    ['ما أقرب نجم إلى الأرض؟','الشمس',['الشمس','الشعرى اليمانية','سيريوس','النجم القطبي'],'نراه نهارًا.'],
    ['ما وحدة قياس شدة التيار الكهربائي؟','الأمبير',['الأمبير','الفولت','الواط','الأوم'],'سميت نسبة إلى عالم فرنسي.'],
    ['ما الجزء الذي يحمل البذور في النبات؟','الثمرة',['الثمرة','الجذر','الساق','الورقة'],'يتكون غالبًا بعد تحوّل الزهرة.']]},
  {id:'history',name:'تاريخ وحضارة',sticker:'assets/icons/category-history.svg',qs:[
    ['في أي دولة تقع أهرامات الجيزة؟','مصر',['مصر','السودان','العراق','الأردن'],'على ضفاف النيل.'],
    ['ما المدينة التي كانت عاصمة الدولة العباسية؟','بغداد',['بغداد','دمشق','القاهرة','قرطبة'],'أسسها أبو جعفر المنصور.'],
    ['من الرحالة المغربي الشهير الذي جاب بلادًا كثيرة؟','ابن بطوطة',['ابن بطوطة','ابن خلدون','الإدريسي','المسعودي'],'ولد في طنجة.'],
    ['ما الحضارة التي اشتهرت بالكتابة المسمارية؟','السومرية',['السومرية','الرومانية','الإغريقية','الفينيقية'],'نشأت في بلاد الرافدين.'],
    ['في أي عام انتهت الحرب العالمية الثانية؟','1945',['1945','1939','1918','1950'],'بعد ست سنوات من بدايتها.'],
    ['ما اسم المدينة الأثرية المنحوتة في الصخر جنوب الأردن؟','البتراء',['البتراء','جرش','تدمر','أريحا'],'تُعرف بالمدينة الوردية.']]},
  {id:'sports',name:'رياضة',sticker:'assets/icons/category-sports.svg',qs:[
    ['كم لاعبًا في فريق كرة القدم داخل الملعب؟','11',['11','9','10','12'],'حارس المرمى ضمن العدد.'],
    ['كم حلقة في شعار الألعاب الأولمبية؟','5',['5','4','6','7'],'ترمز إلى القارات.'],
    ['ما الرياضة التي يستخدم فيها المضرب والريشة؟','الريشة الطائرة',['الريشة الطائرة','التنس','الإسكواش','تنس الطاولة'],'تُلعب غالبًا في صالة.'],
    ['كم دقيقة مدة مباراة كرة القدم الأصلية؟','90',['90','80','100','60'],'شوطان متساويان.'],
    ['ما الدولة صاحبة أكبر عدد من ألقاب كأس العالم للرجال حتى 2022؟','البرازيل',['البرازيل','ألمانيا','إيطاليا','الأرجنتين'],'فازت باللقب خمس مرات.'],
    ['كم عدد لاعبي فريق كرة السلة داخل الملعب؟','5',['5','6','7','8'],'يتكون الفريق من خمسة لاعبين في الملعب.']]},
  {id:'literature',name:'لغة وأدب',sticker:'assets/icons/category-literature.svg',qs:[
    ['ما جمع كلمة كتاب؟','كتب',['كتب','كتابات','كتابان','كتبة'],'جمع تكسير من ثلاثة أحرف.'],
    ['من مؤلف مسرحية روميو وجولييت؟','وليام شكسبير',['وليام شكسبير','تشارلز ديكنز','جورج أورويل','دانتي'],'كاتب مسرحي إنجليزي.'],
    ['ما ضد كلمة شجاع؟','جبان',['جبان','قوي','كريم','صبور'],'صفة من يخاف المواجهة.'],
    ['كم عدد حروف اللغة العربية؟','28',['28','26','29','30'],'من الألف إلى الياء.'],
    ['من صاحب معلقة قفا نبك؟','امرؤ القيس',['امرؤ القيس','عنترة بن شداد','زهير بن أبي سلمى','طرفة بن العبد'],'شاعر جاهلي اشتهر بالغزل.'],
    ['ما نوع كلمة «يكتب»؟','فعل مضارع',['فعل مضارع','اسم','فعل ماضٍ','حرف'],'يدل على حدث يقع الآن أو يتجدد.']]},
  {id:'food',name:'طعام ومطبخ',sticker:'assets/icons/category-food.svg',qs:[
    ['ما المكون الأساسي للحمص؟','الحمص',['الحمص','العدس','الفول','الفاصولياء'],'بقول معروف اسمه هو اسم الطبق.'],
    ['من أي فاكهة يُصنع الزبيب؟','العنب',['العنب','التين','التمر','التفاح'],'تُجفف حباته.'],
    ['ما البهار الذي يعطي الكركم لونه الأصفر؟','الكركم',['الكركم','القرفة','الكمون','الفلفل الأسود'],'يُستخدم أيضًا في الكاري.'],
    ['أي دولة تشتهر بالسوشي؟','اليابان',['اليابان','تايلاند','الصين','كوريا'], 'طبق أرز ياباني مشهور.'],
    ['ما العنصر الذي يجعل العجين ينتفخ؟','الخميرة',['الخميرة','الملح','السكر','الزيت'],'كائنات دقيقة تنتج غازًا.'],
    ['ما المكوّن الأساسي في طبق التبولة؟','البقدونس',['البقدونس','الأرز','البطاطس','الذرة'],'يُفرم ناعمًا ويخلط بالخضار والبرغل.']]},
  {id:'tech',name:'تقنية واختراعات',sticker:'assets/icons/category-tech.svg',qs:[
    ['ما الجهاز المستخدم لإدخال النص إلى الحاسوب؟','لوحة المفاتيح',['لوحة المفاتيح','الشاشة','السماعة','الطابعة'],'تحتوي على أزرار الحروف.'],
    ['ماذا تعني الأحرف WWW؟','الشبكة العنكبوتية العالمية',['الشبكة العنكبوتية العالمية','نظام تشغيل عالمي','اتصال لاسلكي','ذاكرة حاسوب'],'تظهر غالبًا في عناوين المواقع.'],
    ['من مخترع الهاتف الذي نُسب إليه أول براءة اختراع؟','ألكسندر غراهام بيل',['ألكسندر غراهام بيل','توماس إديسون','نيكولا تسلا','جيمس واط'],'عالم اسكتلندي أمريكي.'],
    ['ما لغة التنسيق الشائعة لتصميم صفحات الويب؟','CSS',['CSS','HTML','SQL','Python'],'تتحكم بالألوان والتخطيط.'],
    ['ما اسم أول قمر صناعي أُطلق إلى الفضاء؟','سبوتنيك 1',['سبوتنيك 1','أبولو 11','فوستوك 1','إكسبلورر 1'],'أطلقه الاتحاد السوفيتي عام 1957.'],
    ['ما التقنية التي تحول ضوء الشمس إلى كهرباء؟','الخلايا الشمسية',['الخلايا الشمسية','المحرك البخاري','التوربين المائي','المولد اليدوي'],'تُعرف أيضًا بالخلايا الكهروضوئية.']]},
  {id:'nature',name:'طبيعة وحيوانات',sticker:'assets/icons/category-nature.svg',qs:[
    ['ما أسرع حيوان بري؟','الفهد',['الفهد','الأسد','الحصان','الغزال'],'يُعرف أيضًا بالشيتا.'],
    ['ما الحيوان الملقب بسفينة الصحراء؟','الجمل',['الجمل','الحصان','اللاما','الفيل'],'يتحمل العطش والحرارة.'],
    ['كم ساقًا للعنكبوت؟','8',['8','6','10','12'],'أكثر من الحشرات بزوج أرجل.'],
    ['ما أكبر حيوان يعيش على الأرض؟','الحوت الأزرق',['الحوت الأزرق','الفيل الأفريقي','الزرافة','القرش الأبيض'],'يعيش في المحيط ويعد أضخم الكائنات.'],
    ['ما اسم صغير الضفدع قبل اكتمال نموه؟','شرغوف',['شرغوف','يرقة','فرخ','جرو'],'يعيش في الماء وله ذيل.'],
    ['ما الحيوان الذي يُعرف بملك الغابة؟','الأسد',['الأسد','النمر','الفهد','الذئب'],'يعيش في جماعات تسمى الزمر.']]}
];
const TRIVIA_CATEGORY_GROUPS = [
  {id:'knowledge',name:'معرفة وثقافة',categories:['geo','history','literature']},
  {id:'science',name:'علوم وتقنية',categories:['science','tech']},
  {id:'life',name:'حياة وطبيعة',categories:['nature']},
  {id:'sports',name:'رياضة',categories:['sports']},
  {id:'food',name:'أكل وشرب',categories:['food']}
];
const openTriviaCategoryGroups = new Set(TRIVIA_CATEGORY_GROUPS.map(group=>group.id));
let currentTriviaCategoriesCode=null;
let currentTriviaCategoriesState=null;
const TRIVIA_AIDS=[
  {id:'throw',name:'رمي السؤال',sticker:'assets/icons/aid-throw.svg',help:'يمرّر السؤال إلى الفريق الخصم؛ وإذا لم يجب تُخصم منه نقاط السؤال.'},
  {id:'hint',name:'تلميح',sticker:'assets/icons/aid-hint.svg',help:'يعرض تلميحًا يساعد الفريق على الوصول إلى الإجابة.'},
  {id:'double',name:'مضاعفة النقاط',sticker:'assets/icons/aid-double.svg',help:'يضاعف نقاط السؤال الحالي عند الإجابة الصحيحة.'},
  {id:'steal',name:'سرقة النقاط',sticker:'assets/icons/aid-steal.svg',help:'إذا أخفق الفريق في الإجابة، تُتاح للفريق الآخر فرصة كسب نقاط السؤال.'},
  {id:'skip',name:'تجاوز السؤال',sticker:'assets/icons/aid-skip.svg',help:'ينهي السؤال الحالي دون نقاط وينتقل الدور إلى الفريق الآخر.'},
  {id:'wheel',name:'عجلة الحظ',sticker:'assets/icons/aid-wheel.svg',help:'تدير عجلة عشوائية بنتائج ومفاجآت مختلفة.'}
];
function triviaAidStickerHtml(aid,className='trivia-floating-sticker'){
  return iconImageHtml(aid.sticker,className);
}
const TRIVIA_QUESTION_POINTS=[200,200,200,400,400,600];
function triviaPointsForIndex(index){return TRIVIA_QUESTION_POINTS[index]||TRIVIA_QUESTION_POINTS[0];}
function triviaQuestionLimit(trivia){return (trivia.categories||[]).length*TRIVIA_QUESTION_POINTS.length;}

function startTriviaSetup(code,retainedTeams=null){
  return db.ref('rooms/'+code).update({status:'trivia_setup',activeGame:'trivia',trivia:{
    phase:'setup',
    categories:[],
    aidsByTeam:{A:[],B:[]},
    usedAids:{A:{},B:{}},
    scores:{A:0,B:0},
    used:{},
    questionOverrides:{},
    teams:{
      A:retainedTeams?.A||'الفريق الأول',
      B:retainedTeams?.B||'الفريق الثاني'
    },
    turn:'A'
  }}).catch(error=>{
    console.error('Could not start trivia setup:',error);
    alert('تعذر تجهيز اللعبة. تحقق من الاتصال وحاول مرة أخرى.');
  });
}
function renderTriviaHost(code,room){
  const t=room.trivia||{};
  document.getElementById('stage')?.classList.toggle('trivia-landscape-stage',t.phase==='board'||t.phase==='question'||t.phase==='done');
  if(t.phase==='setup') return renderTriviaSetupHost(code,t);
  if(t.phase==='categories') return renderTriviaCategoriesHost(code,t);
  if(t.phase==='question') return renderTriviaQuestionHost(code,t);
  if(t.phase==='done') return renderTriviaDone(code,t);
  renderTriviaBoard(code,t);
}
function triviaExitControlsHtml(code,embedded=false){
  return `<div class="activity-exit-controls trivia-exit-controls${embedded?' is-embedded':''}">
    <button type="button" class="btn activity-return-detail" onclick="triviaFinishToCategories('${code}')">إنهاء اللعبة</button>
    <button type="button" class="btn btn-danger" onclick="triviaRestorePortrait();resetToLobby('${code}')">خروج</button>
  </div>`;
}
window.triviaRestorePortrait=()=>document.getElementById('stage')?.classList.remove('trivia-landscape-stage');
window.triviaFinishToCategories=async code=>{
  triviaRestorePortrait();
  try{
    await db.ref(`rooms/${code}`).update({
      status:'trivia_setup',
      activeGame:'trivia',
      'trivia/phase':'categories',
      'trivia/current':null,
      'trivia/pendingChallenge':null,
      'trivia/notice':null
    });
  }catch(error){
    console.error('Could not return to trivia category selection:',error);
    alert('تعذر إنهاء الجولة والعودة لاختيار الفئات. تحقق من الاتصال وحاول مرة أخرى.');
  }
};
function renderTriviaSetupHost(code,t){
  const teamCards=['A','B'].map(team=>{
    const selected=t.aidsByTeam?.[team]||[];
    const aidChoices=TRIVIA_AIDS.map(aid=>`<div class="trivia-aid-choice ${selected.includes(aid.id)?'is-selected':''}">
      <label class="trivia-aid"><input type="checkbox" data-trivia-aid="${team}-${aid.id}" ${selected.includes(aid.id)?'checked':''} ${selected.length>=3&&!selected.includes(aid.id)?'disabled':''} onchange="triviaToggleAid('${code}','${team}','${aid.id}',this.checked)"><span class="trivia-aid-icon">${triviaAidStickerHtml(aid)}</span><b>${aid.name}</b></label>
      <details class="trivia-aid-help"><summary aria-label="شرح ${aid.name}">؟</summary><p>${aid.help}</p></details>
    </div>`).join('');
    const teamName=t.teams?.[team]|| (team==='A'?'الفريق الأول':'الفريق الثاني');
    return `<section class="trivia-team-setup trivia-team-${team.toLowerCase()}">
      <header class="trivia-team-heading"><span class="trivia-team-label">الفريق ${team==='A'?'الأول':'الثاني'}</span>
        <div class="trivia-team-name"><strong data-trivia-team-name="${team}">${escapeHtml(teamName)}</strong><button type="button" class="trivia-team-edit" data-trivia-team-toggle="${team}" onclick="triviaToggleTeamEdit('${team}')">تعديل</button></div>
        <input class="trivia-team-name-input" data-trivia-team-input="${team}" value="${escapeHtml(teamName)}" maxlength="24" aria-label="اسم الفريق ${team==='A'?'الأول':'الثاني'}" hidden oninput="triviaPreviewTeamName('${team}',this.value)" onblur="triviaSaveTeamName('${code}','${team}',this.value)">
        <small>${selected.length} من 3 وسائل مساعدة مختارة</small>
      </header><div class="trivia-aid-grid">${aidChoices}</div>
    </section>`;
  }).join('');
  document.getElementById('stage').innerHTML=`<div class="trivia-wrap">
    <header class="trivia-head"><div><span class="host-section-kicker">تحدي الفئات</span><h1>إعداد الفريقين</h1><p>سمّوا الفريقين، ثم يختار كل فريق 3 وسائل مساعدة.</p></div><button type="button" class="btn btn-ghost" onclick="returnToGameDetail('${code}','trivia')">العودة إلى تعليمات اللعبة</button></header>
    <div class="trivia-team-setup-grid">${teamCards}</div>
    <div class="trivia-setup-actions">
      <button class="btn btn-ghost" onclick="triviaRandomizeAids('${code}')">اختيار عشوائي للوسائل</button>
      <button class="btn trivia-start" ${['A','B'].some(team=>(t.aidsByTeam?.[team]||[]).length!==3)?'disabled':''} onclick="triviaShowCategories('${code}')">تحديد الفئات</button>
    </div>
  </div>`;
}
function renderTriviaCategoriesHost(code,t){
  currentTriviaCategoriesCode=code;
  currentTriviaCategoriesState=t;
  const selected=t.categories||[];
  const groups=TRIVIA_CATEGORY_GROUPS.map(group=>{
    const isOpen=openTriviaCategoryGroups.has(group.id);
    const groupCategories=group.categories.map(id=>TRIVIA_BANK.find(category=>category.id===id)).filter(Boolean);
    const groupSelected=groupCategories.filter(category=>selected.includes(category.id)).length;
    const cards=groupCategories.map(category=>`<button type="button" class="trivia-category ${selected.includes(category.id)?'is-selected':''}" onclick="triviaToggleCategory('${code}','${category.id}')"><img class="trivia-category-sticker" src="${escapeHtml(category.sticker)}" alt="" aria-hidden="true"><b>${category.name}</b><small>${selected.includes(category.id)?'تم الاختيار':'اختر الفئة'}</small></button>`).join('');
    return `<section class="trivia-category-group ${isOpen?'is-open':''}">
      <header class="trivia-category-group-header">
        <button type="button" class="trivia-category-group-toggle" aria-expanded="${isOpen}" onclick="toggleTriviaCategoryGroup('${group.id}')"><span>${group.name}</span><small>${groupSelected} مختارة</small><b aria-hidden="true">${isOpen?'−':'+'}</b></button>
      </header>
      <div class="trivia-category-grid" ${isOpen?'':'hidden'}>${cards}</div>
    </section>`;
  }).join('');
  document.getElementById('stage').innerHTML=`<div class="trivia-wrap">
    <header class="trivia-head"><div><span class="host-section-kicker">تحدي الفئات</span><h1>تحديد الفئات</h1><p>اختاروا 6 فئات للوحة اللعب (${selected.length}/6).</p></div><button class="btn btn-ghost" onclick="triviaBackToTeams('${code}')">العودة للفريقين</button></header>
    <div class="trivia-category-groups">${groups}</div>
    <div class="trivia-setup-actions trivia-category-actions">
      <button class="btn btn-ghost" onclick="triviaRandomizeCategories('${code}')">اختيار عشوائي للفئات</button>
      <button class="btn trivia-start" ${selected.length!==6?'disabled':''} onclick="triviaBegin('${code}')">ابدأ اللعبة</button>
    </div>
  </div>`;
}
window.toggleTriviaCategoryGroup=function(groupId){
  if(openTriviaCategoryGroups.has(groupId)) openTriviaCategoryGroups.delete(groupId);
  else openTriviaCategoryGroups.add(groupId);
  if(currentTriviaCategoriesCode&&currentTriviaCategoriesState) renderTriviaCategoriesHost(currentTriviaCategoriesCode,currentTriviaCategoriesState);
};
window.triviaToggleTeamEdit=team=>{
  const input=document.querySelector(`[data-trivia-team-input="${team}"]`);
  const button=document.querySelector(`[data-trivia-team-toggle="${team}"]`);
  if(!input||!button)return;
  input.hidden=!input.hidden;
  button.textContent=input.hidden?'تعديل':'تم';
  if(!input.hidden){input.focus();input.select();}else input.blur();
};
window.triviaPreviewTeamName=(team,name)=>{
  const display=document.querySelector(`[data-trivia-team-name="${team}"]`);
  if(display)display.textContent=name.trim()||(team==='A'?'الفريق الأول':'الفريق الثاني');
};
window.triviaSaveTeamName=async(code,team,name)=>{
  if(team!=='A'&&team!=='B')return;
  const trimmed=name.trim();
  if(!trimmed||trimmed.length>24){alert('اكتب اسمًا من حرف واحد إلى 24 حرفًا.');return;}
  try{await db.ref(`rooms/${code}/trivia/teams/${team}`).set(trimmed);}
  catch(error){console.error('Could not save trivia team name:',error);alert('تعذر حفظ اسم الفريق. تحقق من الاتصال وحاول مرة أخرى.');}
};
window.triviaToggleAid=async(code,team,id,on)=>{
  if(!['A','B'].includes(team)||!TRIVIA_AIDS.some(aid=>aid.id===id))return;
  const ref=db.ref(`rooms/${code}/trivia/aidsByTeam/${team}`);
  try{
    const result=await ref.transaction(current=>{
      const selected=Array.isArray(current)?current:[];
      if(on){if(selected.includes(id)||selected.length>=3)return;return [...selected,id];}
      return selected.filter(aid=>aid!==id);
    });
    if(!result.committed&&on){
      const checkbox=document.querySelector(`[data-trivia-aid="${team}-${id}"]`);
      if(checkbox)checkbox.checked=false;
      alert('يمكن لكل فريق اختيار 3 وسائل مساعدة فقط.');
    }
  }catch(error){console.error('Could not update trivia aids:',error);alert('تعذر حفظ وسائل المساعدة. تحقق من الاتصال وحاول مرة أخرى.');}
};
window.triviaRandomizeAids=async code=>{
  const sample=()=>{
    const ids=TRIVIA_AIDS.map(aid=>aid.id);
    for(let index=ids.length-1;index>0;index--){
      const swapIndex=Math.floor(Math.random()*(index+1));
      [ids[index],ids[swapIndex]]=[ids[swapIndex],ids[index]];
    }
    return ids.slice(0,3);
  };
  try{
    await db.ref(`rooms/${code}/trivia/aidsByTeam`).set({A:sample(),B:sample()});
  }catch(error){console.error('Could not randomly choose trivia aids:',error);alert('تعذر اختيار وسائل المساعدة عشوائيًا. تحقق من الاتصال وحاول مرة أخرى.');}
};
window.triviaShowCategories=async code=>{
  try{
    const ref=db.ref(`rooms/${code}/trivia`),snapshot=await ref.once('value'),trivia=snapshot.val();
    if(!trivia||['A','B'].some(team=>(trivia.aidsByTeam?.[team]||[]).length!==3)){
      alert('يجب أن يختار كل فريق 3 وسائل مساعدة.');
      return;
    }
    await ref.child('phase').set('categories');
  }
  catch(error){console.error('Could not open trivia categories:',error);alert('تعذر فتح الفئات. تحقق من الاتصال وحاول مرة أخرى.');}
};
window.triviaBackToTeams=async code=>{
  try{await db.ref(`rooms/${code}/trivia/phase`).set('setup');}
  catch(error){console.error('Could not return to trivia team setup:',error);alert('تعذر العودة لإعداد الفريقين. تحقق من الاتصال وحاول مرة أخرى.');}
};
window.triviaToggleCategory=async(code,id)=>{
  const ref=db.ref(`rooms/${code}/trivia/categories`);
  try{
    const result=await ref.transaction(current=>{
      const selected=Array.isArray(current)?current:[];
      return selected.includes(id)?selected.filter(item=>item!==id):(selected.length<6?[...selected,id]:undefined);
    });
    if(!result.committed)alert('يمكن اختيار 6 فئات فقط.');
  }catch(error){console.error('Could not update trivia categories:',error);alert('تعذر حفظ الفئات. تحقق من الاتصال وحاول مرة أخرى.');}
};
window.triviaRandomizeCategories=async code=>{
  const ids=TRIVIA_BANK.map(category=>category.id);
  for(let index=ids.length-1;index>0;index--){
    const swapIndex=Math.floor(Math.random()*(index+1));
    [ids[index],ids[swapIndex]]=[ids[swapIndex],ids[index]];
  }
  try{await db.ref(`rooms/${code}/trivia/categories`).set(ids.slice(0,6));}
  catch(error){console.error('Could not randomly choose trivia categories:',error);alert('تعذر اختيار الفئات عشوائيًا. تحقق من الاتصال وحاول مرة أخرى.');}
};
window.triviaBegin=async code=>{
  try{
    const snapshot=await db.ref(`rooms/${code}/trivia`).once('value');
    const trivia=snapshot.val();
    if(!trivia||trivia.phase!=='categories'||(trivia.categories||[]).length!==6||
      ['A','B'].some(team=>(trivia.aidsByTeam?.[team]||[]).length!==3)){
      alert('تأكدوا من اختيار 3 وسائل مساعدة لكل فريق و6 فئات قبل بدء اللعبة.');
      return;
    }
    await db.ref(`rooms/${code}`).update({status:'in_game',trivia:{...trivia,phase:'board',used:{},usedAids:{A:{},B:{}},scores:{A:0,B:0},turn:'A'}});
  }catch(error){console.error('Could not begin trivia game:',error);alert('تعذر بدء اللعبة. تحقق من الاتصال وحاول مرة أخرى.');}
};
function renderTriviaBoard(code,t){
  const categories=(t.categories||[]).map(id=>TRIVIA_BANK.find(c=>c.id===id)).filter(Boolean);
  const cells=categories.map(c=>`<section class="trivia-column"><h3><b>${c.name}</b></h3>${c.qs.map((_,index)=>c.qs.length-1-index).map(i=>{const key=c.id+'_'+i;return `<button class="trivia-cell ${t.used?.[key]?'is-used':''}" ${t.used?.[key]?'disabled':''} onclick="triviaOpenQuestion('${code}','${key}')">${triviaPointsForIndex(i)}</button>`}).join('')}</section>`).join('');
  const scores=t.scores||{A:0,B:0};
  const rankedTeams=['A','B'].sort((left,right)=>(scores[right]||0)-(scores[left]||0));
  const scoreCards=rankedTeams.map((team,index)=>`<div class="trivia-score team-${team.toLowerCase()} ${index===0&&scores.A!==scores.B?'is-leading':''}">
    <span class="trivia-rank">${scores.A===scores.B?'تعادل':index===0?'المتصدّر':'الفريق الآخر'}</span>
    <span>${escapeHtml(t.teams?.[team]||(team==='A'?'الفريق الأول':'الفريق الثاني'))}</span>
    <b>${scores[team]||0}</b><small>نقطة</small>
  </div>`).join('');
  document.getElementById('stage').innerHTML=`<div class="trivia-wrap trivia-board-screen">
    <header class="trivia-gamebar">
      <div class="trivia-turn"><span>دور الاختيار</span><b>${escapeHtml(t.teams?.[t.turn]||'الفريق الأول')}</b></div>
      <button class="trivia-turn-switch" aria-label="تبديل الدور" title="تبديل الدور" onclick="triviaSetTurn('${code}','${t.turn==='A'?'B':'A'}')">↔</button>
      <h1><span>تحدي الفئات</span><small>اختروا سؤالًا من اللوحة</small></h1>
      ${triviaExitControlsHtml(code,true)}
    </header>
    ${t.notice?`<p class="trivia-notice" role="status">${escapeHtml(t.notice)}</p>`:''}
    <div class="trivia-board-frame"><div class="trivia-board">${cells}</div></div>
    <p class="trivia-footnote">اختر سؤالًا؛ قيمة النقاط تتناقص من أعلى إلى أسفل</p>
    <section class="trivia-standings" aria-label="ترتيب الفرق">${scoreCards}</section>
  </div>`;
}
window.triviaSetTurn=(code,team)=>db.ref(`rooms/${code}/trivia/turn`).set(team);
window.triviaOpenQuestion=async(code,key)=>{
  try{
    const snapshot=await db.ref(`rooms/${code}/trivia`).once('value');
    const t=snapshot.val();
    if(!t||t.used?.[key])return;
    const separator=key.lastIndexOf('_');
    const catId=key.slice(0,separator),boardIndex=Number(key.slice(separator+1));
    const index=Number(t.questionOverrides?.[key]??boardIndex);
    await db.ref(`rooms/${code}/trivia`).update({phase:'question',notice:null,current:{
      key,catId,index,boardIndex,team:t.turn,revealed:false,points:triviaPointsForIndex(boardIndex),
      challengeTeam:t.pendingChallenge?.team||null
    },pendingChallenge:null});
  }catch(error){console.error('Could not open trivia question:',error);alert('تعذر فتح السؤال. تحقق من الاتصال وحاول مرة أخرى.');}
};
function renderTriviaTeamAidCards(code,t,current){
  const team=current.team||'A';
  return ['A','B'].map(aidTeam=>{
    const isActive=aidTeam===team;
    const teamAids=t.aidsByTeam?.[aidTeam]||[];
    const teamUsed=t.usedAids?.[aidTeam]||{};
    const aidItems=teamAids.map(id=>{
      const aid=TRIVIA_AIDS.find(item=>item.id===id);
      if(!aid)return '';
      const isUsed=!!teamUsed[id];
      if(isActive&&id==='wheel'&&!isUsed){
        return `<button type="button" class="trivia-team-aid trivia-wheel-open" onclick="triviaOpenWheel()"><span>${triviaAidStickerHtml(aid)}</span><b>${aid.name}</b></button>`;
      }
      if(isActive&&!isUsed){
        return `<button type="button" class="trivia-team-aid" onclick="triviaUseAid('${code}','${id}')"><span>${triviaAidStickerHtml(aid)}</span><b>${aid.name}</b></button>`;
      }
      return `<span class="trivia-team-aid ${isUsed?'is-used':'is-inactive'}"><span>${triviaAidStickerHtml(aid)}</span><b>${aid.name}</b></span>`;
    }).join('');
    return `<section class="trivia-team-aids team-${aidTeam.toLowerCase()} ${isActive?'is-active':''}">
      <header><span class="trivia-team-aids-indicator" aria-hidden="true"></span><h2>${escapeHtml(t.teams?.[aidTeam]||(aidTeam==='A'?'الفريق الأول':'الفريق الثاني'))}</h2>${isActive?'<small>دور الفريق</small>':''}</header>
      <div class="trivia-team-aid-list">${aidItems||'<p class="trivia-aids-empty">لا توجد وسائل مساعدة لهذا الفريق.</p>'}</div>
    </section>`;
  }).join('');
}
function renderTriviaQuestionHost(code,t){
  const current=t.current;
  const category=TRIVIA_BANK.find(item=>item.id===current?.catId);
  const question=category?.qs[current?.index];
  if(!question)return renderTriviaBoard(code,t);
  const team=current.team||'A',points=(Number(current.points)||triviaPointsForIndex(current.boardIndex))*(current.double?2:1);
  const aids=t.aidsByTeam?.[team]||[];
  const used=t.usedAids?.[team]||{};
  const teamAidCards=renderTriviaTeamAidCards(code,t,current);
  const answerActions=current.revealed
    ? `${['A','B'].map(scoreTeam=>`<button class="btn trivia-score-team trivia-score-team-${scoreTeam.toLowerCase()}" onclick="triviaScore('${code}','${scoreTeam}',${points})">احتساب ${points} نقطة لـ ${escapeHtml(t.teams?.[scoreTeam]||(scoreTeam==='A'?'الفريق الأول':'الفريق الثاني'))}</button>`).join('')}
       ${current.thrownByTeam?`<button class="btn trivia-b" onclick="triviaScore('${code}','${team}',-${points})">لم يجب الفريق — خصم ${points} نقطة</button>`:''}
       ${current.stealAvailable&&!current.stealPrompted?`<button class="btn btn-ghost" onclick="triviaOfferSteal('${code}')">الإجابة خاطئة — إتاحة السرقة</button>`:''}
       ${current.stealAvailable&&current.stealPrompted?`<button class="btn trivia-b" onclick="triviaScore('${code}','${team==='A'?'B':'A'}',${points})">سرقة النقاط لـ ${escapeHtml(t.teams?.[team==='A'?'B':'A']||'الفريق الآخر')}</button>`:''}
       <button class="btn btn-ghost" onclick="triviaSkip('${code}')">لا نقاط</button>`
    : `<button class="btn" onclick="triviaReveal('${code}')">إظهار الإجابة</button>`;
  document.getElementById('stage').innerHTML=`${triviaExitControlsHtml(code)}<div class="trivia-wrap"><div class="trivia-question-card">
    <header class="trivia-question-header"><span class="trivia-question-points">${points}</span><span class="trivia-question-category">${category.name}</span><div class="trivia-question-turn"><span>دور ${escapeHtml(t.teams?.[team]||'الفريق صاحب الدور')}</span><button type="button" class="trivia-question-turn-switch" onclick="triviaSetQuestionTurn('${code}','${team==='A'?'B':'A'}')">تبديل الدور</button></div></header>
    <div class="trivia-question-layout">
      <aside class="trivia-question-sidebar" aria-label="وسائل مساعدة الفريقين">${teamAidCards}</aside>
      <main class="trivia-question-main">
        ${current.challengeTeam?`<p class="trivia-challenge-notice">تحدي فردي: يلتزم أحد لاعبي ${escapeHtml(t.teams?.[current.challengeTeam]||'الفريق الآخر')} بالصمت وعدم الإجابة في هذا السؤال.</p>`:''}
        ${current.thrownByTeam?`<p class="trivia-challenge-notice">مرّر ${escapeHtml(t.teams?.[current.thrownByTeam]||'الفريق الآخر')} السؤال إلى ${escapeHtml(t.teams?.[team]||'الفريق صاحب الدور')}.</p>`:''}
        <h1>${escapeHtml(question[0])}</h1>
        ${current.hint?`<div class="trivia-hint">${triviaAidStickerHtml(TRIVIA_AIDS.find(aid=>aid.id==='hint'),'trivia-hint-sticker')} ${escapeHtml(question[3])}</div>`:''}
        ${current.letterHint?`<div class="trivia-hint">حرف من الإجابة: <strong>${escapeHtml(current.letterHint)}</strong></div>`:''}
        ${current.revealed?`<div class="trivia-answer">الإجابة الصحيحة: <strong>${escapeHtml(question[1])}</strong></div>`:''}
        ${current.wheelResult?`<p class="trivia-wheel-result" role="status">${escapeHtml(current.wheelResult)}</p>`:''}
        <div class="trivia-actions">${answerActions}<button class="btn btn-ghost" onclick="triviaBack('${code}')">العودة للوحة</button></div>
      </main>
    </div>
    ${aids.includes('wheel')&&!used.wheel?triviaWheelHtml(code):''}
  </div></div>`;
}
window.triviaOpenWheel=()=>{
  const dialog=document.getElementById('triviaWheelDialog');
  if(dialog&&!dialog.open)dialog.showModal();
};
window.triviaSetQuestionTurn=async(code,team)=>{
  try{
    const ref=db.ref(`rooms/${code}/trivia/current`),snapshot=await ref.once('value');
    if(!snapshot.exists())return;
    await ref.child('team').set(team);
  }catch(error){console.error('Could not switch trivia question turn:',error);alert('تعذر تبديل دور الفريق. تحقق من الاتصال وحاول مرة أخرى.');}
};
window.triviaReveal=code=>db.ref(`rooms/${code}/trivia/current/revealed`).set(true);
window.triviaOfferSteal=async code=>{
  try{await db.ref(`rooms/${code}/trivia/current/stealPrompted`).set(true);}
  catch(error){console.error('Could not enable trivia point steal:',error);alert('تعذر إتاحة سرقة النقاط. تحقق من الاتصال وحاول مرة أخرى.');}
};
window.triviaUseAid=async(code,id)=>{
  try{
    const ref=db.ref(`rooms/${code}/trivia`),snapshot=await ref.once('value'),trivia=snapshot.val();
    const current=trivia?.current,team=current?.team||'A';
    if(!current||!(trivia.aidsByTeam?.[team]||[]).includes(id)||trivia.usedAids?.[team]?.[id])return;
    if(id==='skip'){
      const usedAids={A:{...(trivia.usedAids?.A||{})},B:{...(trivia.usedAids?.B||{})}};
      usedAids[team].skip=true;
      await ref.update({
        phase:'board',current:null,usedAids,turn:team==='A'?'B':'A',
        pendingChallenge:current.challengeTeam?{team:current.challengeTeam}:null,
        notice:`مرّر ${trivia.teams?.[team]||'الفريق صاحب الدور'} السؤال دون استهلاكه.`
      });
      return;
    }
    if(id==='wheel')return;
    const patch={};patch[`usedAids/${team}/${id}`]=true;
    if(id==='throw'){
      patch['current/thrownByTeam']=team;
      patch['current/team']=team==='A'?'B':'A';
    }
    if(id==='hint')patch['current/hint']=true;
    if(id==='double')patch['current/double']=true;
    if(id==='steal')patch['current/stealAvailable']=true;
    await ref.update(patch);
  }catch(error){console.error('Could not use trivia aid:',error);alert('تعذر استخدام وسيلة المساعدة. تحقق من الاتصال وحاول مرة أخرى.');}
};
window.triviaScore=(code,team,pts)=>finishTriviaQuestion(code,team,pts);
window.triviaSkip=code=>finishTriviaQuestion(code,null,0);
async function finishTriviaQuestion(code,team,pts,usedAidId=null){
  try{
    const ref=db.ref(`rooms/${code}/trivia`),snapshot=await ref.once('value'),trivia=snapshot.val();
    if(!trivia?.current)return;
    const current=trivia.current,key=current.key,used={...(trivia.used||{}),[key]:true};
    const scores={...(trivia.scores||{A:0,B:0})};
    if(team)scores[team]=(scores[team]||0)+pts;
    const usedAids={A:{...(trivia.usedAids?.A||{})},B:{...(trivia.usedAids?.B||{})}};
    if(usedAidId)usedAids[current.team||'A'][usedAidId]=true;
    const done=Object.keys(used).length>=triviaQuestionLimit(trivia);
    await db.ref(`rooms/${code}`).update({status:'in_game',trivia:{
      ...trivia,phase:done?'done':'board',used,scores,usedAids,current:null,
      turn:current.team==='A'?'B':'A',pendingChallenge:null
    }});
  }catch(error){console.error('Could not finish trivia question:',error);alert('تعذر تسجيل نتيجة السؤال. تحقق من الاتصال وحاول مرة أخرى.');}
}
const TRIVIA_WHEEL_OUTCOMES=[
  {id:'bonus',label:'٥٠ نقطة'},
  {id:'letter',label:'كشف حرف'},
  {id:'challenge',label:'تحدي فردي'},
  {id:'replace',label:'سؤال بديل'}
];
function triviaWheelHtml(code){
  return `<dialog class="trivia-wheel-dialog" id="triviaWheelDialog" aria-labelledby="trivia-wheel-title">
    <section class="trivia-wheel-block" aria-label="عجلة الحظ">
    <header class="trivia-wheel-heading"><h2 id="trivia-wheel-title">عجلة الحظ</h2><button type="button" class="trivia-wheel-close" onclick="document.getElementById('triviaWheelDialog').close()" aria-label="إغلاق">×</button></header>
    <div class="trivia-wheel" id="triviaWheel">
      ${TRIVIA_WHEEL_OUTCOMES.map((outcome,index)=>`<span class="trivia-wheel-label trivia-wheel-label-${index}">${outcome.label}</span>`).join('')}
      <span class="trivia-wheel-center">لَمّة</span>
    </div><button type="button" class="btn trivia-wheel-button" onclick="triviaSpinWheel('${code}',this)">أدر العجلة</button>
  </section></dialog>`;
}
window.triviaSpinWheel=async(code,button)=>{
  const outcomeIndex=Math.floor(Math.random()*TRIVIA_WHEEL_OUTCOMES.length);
  const wheel=document.getElementById('triviaWheel');
  if(button)button.disabled=true;
  try{
    const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(wheel?.animate&&!reduceMotion){
      const spin=wheel.animate(
        [{transform:'rotate(0deg)'},{transform:`rotate(${2160+315-outcomeIndex*90}deg)`}],
        {duration:2600,easing:'cubic-bezier(.12,.72,.16,1)',fill:'forwards'}
      );
      await spin.finished;
    }else await new Promise(resolve=>setTimeout(resolve,900));
    await resolveTriviaWheel(code,outcomeIndex);
  }catch(error){console.error('Could not spin trivia wheel:',error);alert('تعذر تنفيذ عجلة الحظ. حاول مرة أخرى.');if(button)button.disabled=false;}
};
async function resolveTriviaWheel(code,outcomeIndex){
  const outcome=TRIVIA_WHEEL_OUTCOMES[outcomeIndex];
  const ref=db.ref(`rooms/${code}/trivia`),snapshot=await ref.once('value'),trivia=snapshot.val();
  const current=trivia?.current,team=current?.team||'A';
  if(!outcome||!current||!(trivia.aidsByTeam?.[team]||[]).includes('wheel')||trivia.usedAids?.[team]?.wheel)return;
  const usedAids={A:{...(trivia.usedAids?.A||{})},B:{...(trivia.usedAids?.B||{})}};
  usedAids[team].wheel=true;
  if(outcome.id==='letter'){
    const category=TRIVIA_BANK.find(item=>item.id===current.catId);
    const answer=category?.qs[current.index]?.[1]?.replace(/\s/g,'')||'؟';
    const letter=answer[Math.floor(Math.random()*answer.length)];
    await ref.update({usedAids,current:{...current,letterHint:letter,wheelResult:'كشفت العجلة حرفًا من الإجابة.'}});
    return;
  }
  if(outcome.id==='replace'){
    const category=TRIVIA_BANK.find(item=>item.id===current.catId);
    const alternatives=category?.qs.map((_,index)=>index).filter(index=>index!==current.boardIndex&&!trivia.used?.[`${current.catId}_${index}`])||[];
    const alternateBoardIndex=alternatives[Math.floor(Math.random()*alternatives.length)];
    if(alternateBoardIndex===undefined)throw new Error('No replacement question is available.');
    const alternateKey=`${current.catId}_${alternateBoardIndex}`;
    const alternateQuestionIndex=Number(trivia.questionOverrides?.[alternateKey]??alternateBoardIndex);
    const questionOverrides={...(trivia.questionOverrides||{}),[current.key]:alternateQuestionIndex,[alternateKey]:current.index};
    await ref.update({
      phase:'board',current:null,usedAids,questionOverrides,
      pendingChallenge:current.challengeTeam?{team:current.challengeTeam}:null,
      notice:`تغيّر السؤال؛ اختاروا الخانة نفسها مجددًا لعرض السؤال البديل.`
    });
    return;
  }
  const used={...(trivia.used||{}),[current.key]:true};
  const scores={...(trivia.scores||{A:0,B:0})};
  let notice='';
  if(outcome.id==='bonus'){
    scores[team]=(scores[team]||0)+50;
    notice=`كسب ${trivia.teams?.[team]||'الفريق صاحب الدور'} 50 نقطة، وانتهى السؤال.`;
  }else{
    const opponent=team==='A'?'B':'A';
    trivia.pendingChallenge={team:opponent};
    notice=`انتهى السؤال؛ في السؤال التالي يلتزم لاعب من ${trivia.teams?.[opponent]||'الفريق الآخر'} بالصمت وعدم الإجابة.`;
  }
  await db.ref(`rooms/${code}`).update({status:'in_game',trivia:{
    ...trivia,phase:Object.keys(used).length>=triviaQuestionLimit(trivia)?'done':'board',used,scores,usedAids,current:null,
    turn:team==='A'?'B':'A',notice,
    pendingChallenge:outcome.id==='bonus'&&current.challengeTeam?{team:current.challengeTeam}:null
  }});
}
window.triviaBack=async code=>{
  try{
    const ref=db.ref(`rooms/${code}/trivia`),snapshot=await ref.once('value'),trivia=snapshot.val();
    if(!trivia?.current)return;
    await ref.update({
      phase:'board',current:null,
      pendingChallenge:trivia.current.challengeTeam?{team:trivia.current.challengeTeam}:null
    });
  }catch(error){console.error('Could not return to trivia board:',error);alert('تعذر العودة إلى لوحة الفئات. تحقق من الاتصال وحاول مرة أخرى.');}
};
function renderTriviaDone(code,t){
  const a=t.scores?.A||0,b=t.scores?.B||0;
  const winner=a===b?'تعادل!':a>b?(t.teams?.A||'الفريق الأول'):(t.teams?.B||'الفريق الثاني');
  document.getElementById('stage').innerHTML=`${triviaExitControlsHtml(code)}<div class="trivia-wrap trivia-final"><div class="trivia-question-card">${a!==b?winnerCelebrationHtml():''}<span class="host-section-kicker">نهاية الجولة</span><h1>${a===b?'تعادل رائع!':`${iconImageHtml('assets/icons/knowledge-challenge.svg','trivia-winner-sticker')} ${escapeHtml(winner)} يفوز!`}</h1><div class="trivia-scoreboard"><div class="trivia-score team-a"><span>${escapeHtml(t.teams?.A||'الفريق الأول')}</span><b>${a}</b></div><div class="trivia-score team-b"><span>${escapeHtml(t.teams?.B||'الفريق الثاني')}</span><b>${b}</b></div></div><div class="trivia-final-actions"><button class="btn" onclick="triviaReplay('${code}')">إعادة اللعبة بالأسماء نفسها</button></div></div></div>`;
}
window.triviaReplay=async code=>{
  const teams=lastHostRoom?.trivia?.teams;
  await startTriviaSetup(code,teams);
};
function renderTriviaPlayer(code,id,name,room){
  const t=room.trivia||{},a=Number(t.scores?.A)||0,b=Number(t.scores?.B)||0;
  const celebration=t.phase==='done'&&a!==b?winnerCelebrationHtml():'';
  app.innerHTML=`<div class="phone"><div class="card trivia-player">${celebration}<div class="trivia-player-icon">${iconImageHtml('assets/icons/knowledge-challenge.svg','trivia-player-image')}</div><h2>${t.phase==='setup'||t.phase==='categories'?'استعدوا للجولة':t.phase==='done'?'انتهت الجولة':'تحدي الفئات'}</h2><p class="muted">${t.phase==='setup'||t.phase==='categories'?'المنظّم يجهّز الفرق والفئات ووسائل المساعدة.':t.phase==='done'?'يعرض المنظّم النتيجة النهائية.':'تابعوا لوحة اللعب على شاشة المنظّم وساعدوا فريقكم بالإجابة!'}</p>${t.phase==='board'?`<div class="trivia-player-scores"><span>${escapeHtml(t.teams?.A||'الفريق الأول')} <b>${a}</b></span><span>${escapeHtml(t.teams?.B||'الفريق الثاني')} <b>${b}</b></span></div>`:''}</div></div>`;
}
