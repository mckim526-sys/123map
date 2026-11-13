// clock.html 안의 재판 지도: 처음엔 '흐른 시간 + 두 사람', 머리글의 보기(관계도·재판 목록·타임라인·그날 밤)나
// 인물 이름을 누르면 같은 페이지 안에서 v2 재판 지도를 엽니다. 머리글 왼쪽 흐른 시간을 누르면 처음 화면으로.
// 주소: clock.html (처음) · #map #list #timeline #night · #person/<id>/<caseId>
(function () {
  const frame = document.getElementById('appFrame');
  const tools = document.querySelector('.appbar__tools');
  const isApp = h => /^#(map|list|timeline|night)$/.test(h) || /^#person\//.test(h);
  let frameHash = '';

  function sync() {
    const h = location.hash, app = isApp(h);
    document.body.classList.toggle('in-app', app);
    frame.hidden = !app; tools.hidden = !app;
    const view = /^#person\//.test(h) ? '' : h.slice(1);
    document.querySelectorAll('[data-go]').forEach(a => a.setAttribute('aria-current', a.dataset.go === view ? 'page' : 'false'));
    if (!app) return;
    if (!frame.src) { frame.src = 'v2/' + h; frameHash = h; return; }
    if (h !== frameHash) { frameHash = h; frame.contentWindow.location.hash = h; }
  }
  // 재판 지도 안에서 보기·인물을 바꾸면 이 페이지 주소도 같이 (뒤로 가기 기록은 남기지 않음)
  frame.addEventListener('load', () => {
    const w = frame.contentWindow;
    const follow = () => { const h = w.location.hash; if (isApp(h) && h !== location.hash) { frameHash = h; history.replaceState(null, '', h); sync(); } };
    w.addEventListener('hashchange', follow);
    const push = w.history.replaceState.bind(w.history); // v2는 replaceState로 주소를 바꿈
    w.history.replaceState = (...a) => { push(...a); follow(); };
    const pushS = w.history.pushState.bind(w.history);
    w.history.pushState = (...a) => { pushS(...a); follow(); };
  });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-home]')) { e.preventDefault(); history.pushState(null, '', location.pathname); sync(); scrollTo(0, 0); return; }
    const b = e.target.closest('[data-app-btn]');
    if (b) { const t = frame.contentDocument && frame.contentDocument.getElementById(b.dataset.appBtn); if (t) t.click(); }
  });
  addEventListener('hashchange', sync);
  addEventListener('popstate', sync);
  sync();
})();
