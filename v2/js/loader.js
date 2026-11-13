// 데이터 스크립트를 먼저 불러온 뒤, 앱 모듈을 순서대로 붙입니다.
(function boot() {
  const cfg = window.APP_CONFIG;
  const modules = ['js/util.js', 'js/model.js', 'js/layout.js', 'js/progress.js',
    'js/views/map.js', 'js/views/detail.js', 'js/views/list.js', 'js/views/timeline.js', 'js/views/night.js',
    'js/views/relation.js', 'js/views/dialogs.js', 'js/main.js'];

  // 파일을 고치면 VERSION을 올려 브라우저 캐시를 무효화
  const VERSION = '95';
  const load = src => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = false;
    s.onload = resolve; s.onerror = () => reject(new Error('불러오기 실패: ' + src));
    document.body.appendChild(s);
  });

  // (머리글 배경 사진은 쓰지 않음 — 화면 고정 레이아웃)

  load(cfg.DATA_URL)
    .then(() => load(cfg.SOURCE_ORIGIN + '/changelog.js').catch(() => {}))
    .then(() => Promise.all(modules.map(m => load(`${m}?v=${VERSION}`))))
    .catch(err => {
      console.error(err);
      document.getElementById('mapContext').textContent = '· 데이터를 불러오지 못했습니다';
    });
})();
