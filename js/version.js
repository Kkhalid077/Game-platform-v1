/* Keep the footer version in sync with source changes. */
(async function updatePlatformVersion(){
  const footer = document.querySelector('.site-footer');
  if (!footer) return;

  // Show the last known value immediately while the source fingerprint loads.
  try {
    const savedVersion = localStorage.getItem('gamePlatformVersion');
    if (savedVersion) footer.textContent = `رقم الإصدار ${savedVersion}`;
  } catch (_) {}

  const files = [
    'index.html',
    'css/style.css',
    'js/config.js',
    'js/utils.js',
    'js/host.js',
    'js/mafia.js',
    'js/silentdraw.js',
    'js/trivia.js',
    'js/qatara.js',
    'js/buzzer.js',
    'js/player.js',
    'assets/icons/mafia-night.svg',
    'assets/icons/signal-sketch.svg',
    'assets/icons/click-race.svg',
    'assets/icons/knowledge-challenge.svg',
    'assets/icons/question-drip.svg',
    'assets/icons/answer-buzzer.svg',
    'assets/images/cosmic-data.svg',
    'js/version.js'
  ];

  try {
    const contents = await Promise.all(files.map(async file => {
      const response = await fetch(new URL(file, document.baseURI), { cache:'no-store' });
      if (!response.ok) throw new Error(`تعذر قراءة ${file}`);
      return response.text();
    }));

    // FNV-1a hash, used only to detect whether the app source changed.
    let fingerprint = 2166136261;
    for (const char of contents.join('\n')) {
      fingerprint ^= char.codePointAt(0);
      fingerprint = Math.imul(fingerprint, 16777619);
    }
    const currentFingerprint = (fingerprint >>> 0).toString(16);
    const fingerprintKey = 'gamePlatformSourceFingerprint';
    const versionKey = 'gamePlatformVersion';
    const previousFingerprint = localStorage.getItem(fingerprintKey);
    let version = localStorage.getItem(versionKey) || '0.09';

    if (previousFingerprint && previousFingerprint !== currentFingerprint) {
      const [major, minor] = version.split('.').map(Number);
      const next = major * 100 + minor + 1;
      version = `${Math.floor(next / 100)}.${String(next % 100).padStart(2,'0')}`;
    }

    localStorage.setItem(fingerprintKey, currentFingerprint);
    localStorage.setItem(versionKey, version);
    footer.textContent = `رقم الإصدار ${version}`;
  } catch (error) {
    // Keep the visible default version when the host does not allow source fetches.
    console.info('تعذر التحقق من رقم الإصدار تلقائيًا:', error);
  }
})();
