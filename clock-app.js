// clock.html 안의 재판 지도: 처음엔 '흐른 시간 + 두 사람', 머리글의 보기(관계도·재판 목록·타임라인·그날 밤)나
// 인물 이름을 누르면 같은 페이지 안에서 v2 재판 지도를 엽니다. 머리글 왼쪽 흐른 시간을 누르면 처음 화면으로.
// 주소: clock.html (처음) · #map #list #timeline #night · #person/<id>/<caseId>
(function () {
  const frame = document.getElementById('appFrame');
  const tools = document.querySelector('.appbar__tools');
  const more = document.querySelector('.appbar__more'); // 좁은 화면: 출처·업데이트 기록을 ⋯ 메뉴로
  const isApp = h => /^#(map|list|timeline|night)$/.test(h) || /^#person\//.test(h);
  let frameHash = '';

  function setMenu(on) { document.body.classList.toggle('tools-open', on); more.setAttribute('aria-expanded', String(on)); }
  function sync() {
    const h = location.hash, app = isApp(h);
    document.body.classList.toggle('in-app', app);
    frame.hidden = !app; tools.hidden = !app; more.hidden = !app; if (!app) setMenu(false);
    // 인물 주소일 때는 지도 안에서 지금 보는 보기를 표시 (처음엔 관계도)
    const inner = frame.contentDocument && frame.contentDocument.querySelector('[data-view].is-active');
    const view = /^#person\//.test(h) ? (inner ? inner.dataset.view : 'map') : h.slice(1);
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
    // 지도가 이미 열려 있으면 머리글 탭은 지도 안의 보기만 바꿈 (고른 인물·상세는 그대로)
    const go = e.target.closest('[data-go]');
    const innerTab = go && isApp(location.hash) && frame.contentDocument && frame.contentDocument.querySelector(`[data-view="${go.dataset.go}"]`);
    if (innerTab) { e.preventDefault(); innerTab.click(); sync(); return; }
    if (e.target.closest('.appbar__more')) { setMenu(!document.body.classList.contains('tools-open')); return; }
    if (!e.target.closest('.appbar__tools')) setMenu(false);
    const b = e.target.closest('[data-app-btn]');
    if (b) { setMenu(false); const t = frame.contentDocument && frame.contentDocument.getElementById(b.dataset.appBtn); if (t) t.click(); }
  });
  // 큰 흐른 시간이 보이는 동안은 머리글 시간을 숨김 (clock.css)
  const big = document.getElementById('elapsed');
  if (big && 'IntersectionObserver' in window) new IntersectionObserver(([e]) => document.body.classList.toggle('hero-visible', e.isIntersecting), {rootMargin: '-56px 0px 0px 0px'}).observe(big);
  addEventListener('hashchange', sync);
  addEventListener('popstate', sync);
  sync();
})();
