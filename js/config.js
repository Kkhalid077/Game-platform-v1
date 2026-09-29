/* =====================================================================
   SECTION 1 — FIREBASE CONFIGURATION
   ===================================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyBwU4coCgrk1kkzQUfj2vFh5kzoUlFzDnY",
  authDomain: "game-platform-v1.firebaseapp.com",
  databaseURL: "https://game-platform-v1-default-rtdb.firebaseio.com",
  projectId: "game-platform-v1",
  storageBucket: "game-platform-v1.firebasestorage.app",
  messagingSenderId: "1060382508222",
  appId: "1:1060382508222:web:b009f33dba05559806caef",
  measurementId: "G-0BR4SRYKH4"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const app = document.getElementById('app');

/* =====================================================================
   SECTION 2 — GAME CATALOG & WORD BANK WITH IMAGE SUPPORT
   ===================================================================== */
const GAMES_LIST = [
  {
    id: 'mafia', title: 'من هم المافيا؟', icon: 'مافيا', available: true, minPlayers: 4,
    desc: 'لعبة استنتاج اجتماعي: مافيا تتربص بالمجموعة، وشرطي وطبيب يحاولون حمايتها.',
    rules: [
      'كل لاعب يحصل على دور سري (مافيا، شرطي، طبيب، أو مواطن) يظهر على جواله فقط.',
      'كل ليلة يغلق الجميع أعينهم: المافيا يختارون ضحية، ثم يحقق الشرطي، ثم يحمي الطبيب.',
      'بالنهار يناقش الجميع بصوت عالٍ ثم يصوّتون لإخراج أحد المشتبه بهم.',
      'تفوز المافيا إن تساووا عددًا مع الباقين، ويفوز المواطنون إن قُضي على كل المافيا.'
    ]
  },
  {
    id: 'silentdraw', title: 'الرسم الصامت', icon: 'رسم', available: true, minPlayers: 4, needsTeams: true,
    desc: 'فريقان (شخصان لكل فريق): أحدكما يشاهد صورة توضيحية ويوجّه صديقه بالإشارة فقط بلا كلام، والآخر يرسم حتى يكتشف الكلمة بنفسه.',
    rules: [
      'ينقسم اللاعبون إلى فريقين (A و B) بناءً على اختيارهم أو تلقائيًا.',
      'بكل فريق شخص "الموجّه" يشاهد صورة توضيحية وكلمة سرية، والآخر "الرسام" يرسم بدون رؤية أي منهما.',
      'الموجّه يدل صديقه بالإشارة فقط (ممنوع الكلام نهائيًا) حتى يرسم الشكل الصحيح.',
      'الرسام يكتب تخمينه لما يرسمه في أي وقت؛ إذا خمّن الكلمة الصحيحة يفوز فريقه بنقطة فورًا.',
      'الرسام يملك 3 محاولات فقط للتراجع عن آخر خط رسمه إن أخطأ.',
      'أول فريق يخمّن 3 كلمات صحيحة يفوز باللعبة!'
    ]
  },
  { id: 'clicker', title: 'أسرع ضغطة',     icon: 'سرعة', available: false, minPlayers: 2, desc: '', rules: [] },
  { id: 'trivia',  title: 'أسئلة وتحديات', icon: 'أسئلة', available: false, minPlayers: 2, desc: '', rules: [] }
];

const ROLE_META = {
  mafia:   { name:'مافيا',  icon:'مافيا', cls:'role-mafia',   desc:'تعرف على زملائك بالمافيا. كل ليلة تختارون معًا ضحية.' },
  police:  { name:'شرطي',   icon:'شرطي', cls:'role-police',  desc:'كل ليلة تحقق من شخص لتعرف إن كان مافيا.' },
  doctor:  { name:'طبيب',   icon:'طبيب', cls:'role-doctor',  desc:'كل ليلة تحمي شخصًا واحدًا من القتل.' },
  citizen: { name:'مواطن',  icon:'مواطن', cls:'role-citizen', desc:'ناقش، استنتج، وصوّت بذكاء لكشف المافيا.' }
};

// بنك الكلمات والصور
const WORD_BANK = [
  {w:'تفاحة', img:'https://cdn-icons-png.flaticon.com/512/415/415733.png', e:'تفاحة'},
  {w:'سيارة', img:'https://cdn-icons-png.flaticon.com/512/744/744465.png', e:'سيارة'},
  {w:'شمس',   img:'https://cdn-icons-png.flaticon.com/512/869/869869.png', e:'شمس'},
  {w:'بيتزا', img:'https://cdn-icons-png.flaticon.com/512/3595/3595455.png', e:'بيتزا'},
  {w:'موزة',  img:'https://cdn-icons-png.flaticon.com/512/2909/2909761.png', e:'موزة'},
  {w:'نجمة',  img:'https://cdn-icons-png.flaticon.com/512/1828/1828884.png', e:'نجمة'},
  {w:'قطة',   img:'https://cdn-icons-png.flaticon.com/512/616/616430.png', e:'قطة'},
  {w:'كلب',   img:'https://cdn-icons-png.flaticon.com/512/616/616408.png', e:'كلب'},
  {w:'طائرة', img:'https://cdn-icons-png.flaticon.com/512/789/789393.png', e:'طائرة'},
  {w:'بيت',   img:'https://cdn-icons-png.flaticon.com/512/619/619153.png', e:'بيت'},
  {w:'مظلة',  img:'https://cdn-icons-png.flaticon.com/512/3208/3208726.png', e:'مظلة'},
  {w:'كرة',   img:'https://cdn-icons-png.flaticon.com/512/33/33736.png', e:'كرة'},
  {w:'ساعة',  img:'https://cdn-icons-png.flaticon.com/512/2088/2088617.png', e:'ساعة'},
  {w:'هاتف',  img:'https://cdn-icons-png.flaticon.com/512/15/15874.png', e:'هاتف'},
  {w:'مفتاح', img:'https://cdn-icons-png.flaticon.com/512/807/807241.png', e:'مفتاح'},
  {w:'قهوة',  img:'https://cdn-icons-png.flaticon.com/512/751/751621.png', e:'قهوة'}
];
