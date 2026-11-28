// 데이터 스크립트를 먼저 불러온 뒤, 앱 모듈을 순서대로 붙입니다.
(function boot() {
  const cfg = window.APP_CONFIG;
  const modules = ['js/util.js', 'js/model.js', 'js/layout.js', 'js/progress.js',
    'js/views/map.js', 'js/views/detail.js', 'js/views/list.js', 'js/views/timeline.js', 'js/views/night.js',
    'js/views/relation.js', 'js/views/ego.js', 'js/views/dialogs.js', 'js/main.js'];

  // 파일을 고치면 VERSION을 올려 브라우저 캐시를 무효화
  const VERSION = '20261129-1400';
  const load = src => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = false;
    s.onload = resolve; s.onerror = () => reject(new Error('불러오기 실패: ' + src));
    document.body.appendChild(s);
  });

  // (머리글 배경 사진은 쓰지 않음 — 화면 고정 레이아웃)

  // 처음 화면(clock.html) 안에서 열릴 때는 처음 화면이 이미 받은 데이터 주소(?v= 포함)를 그대로 씀 → 브라우저 캐시 재사용, 버전은 clock.html 한 곳에서 관리
  // 따로 열었을 때는 이 파일의 VERSION으로 캐시 무효화
  const parentSrc = name => {
    try {
      if (window.parent === window) return null;
      const el = [...window.parent.document.scripts].find(s => new URL(s.src, location.href).pathname.endsWith('/' + name));
      return el ? el.src : null;
    } catch (_) { return null; }
  };
  load(parentSrc('reader-data.js') || cfg.DATA_URL + '?v=' + VERSION) // 데이터도 캐시 무효화 (사진·재판 기록을 고쳤을 때 옛 데이터가 남지 않게)
    .then(() => load(parentSrc('stale.js') || cfg.SOURCE_ORIGIN + '/stale.js?v=' + VERSION)) // 날짜가 지난 '예정'은 화면에서만 '결과 확인 중'으로
    .then(() => Promise.all(modules.map(m => load(`${m}?v=${VERSION}`))))
    .catch(err => {
      console.error(err);
      document.getElementById('mapContext').textContent = '· 데이터를 불러오지 못했습니다';
    });
})();
