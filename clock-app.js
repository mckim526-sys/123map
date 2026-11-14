// clock.html 안의 재판 지도: 처음엔 '흐른 시간 + 두 사람', 머리글의 보기(관계도·재판 목록·타임라인·그날 밤)나
// 인물 이름을 누르면 같은 페이지 안에서 v2 재판 지도를 엽니다. 머리글 왼쪽 흐른 시간을 누르면 처음 화면으로.
// 주소: clock.html (처음) · #map #list #timeline #night · #person/<id>/<caseId>
(function () {
  const frame = document.getElementById('appFrame');
  const tools = document.querySelector('.appbar__tools');
  const more = document.querySelector('.appbar__more'); // 좁은 화면: 출처·업데이트 기록을 ⋯ 메뉴로
  const isApp = h => /^#(map|list|timeline|night)$/.test(h) || /^#person\//.test(h);
  let frameHash = '', wasApp = false;

  function setMenu(on) { document.body.classList.toggle('tools-open', on); more.setAttribute('aria-expanded', String(on)); }
  function sync() {
    const h = location.hash, app = isApp(h);
    document.body.classList.toggle('in-app', app);
    frame.hidden = !app; tools.hidden = !app; more.hidden = !app; if (!app) setMenu(false);
    // 인물 주소일 때는 지도 안에서 지금 보는 보기를 표시 (처음엔 관계도)
    const entering = app && !wasApp; wasApp = app;
    // 바깥에서 인물 주소로 들어오면 지도 안이 관계도로 바뀌므로 탭도 관계도 (지도 안에서 고른 인물이면 보던 보기)
    const routed = app && frame.src && (h !== frameHash || entering);
    const inner = frame.contentDocument && frame.contentDocument.querySelector('[data-view].is-active');
    const view = /^#person\//.test(h) ? (routed || !inner ? 'map' : inner.dataset.view) : h.slice(1);
    document.querySelectorAll('[data-go]').forEach(a => a.setAttribute('aria-current', a.dataset.go === view ? 'page' : 'false'));
    if (!app) return;
    if (!frame.src) { frame.src = 'v2/' + h; frameHash = h; return; }
    // 바깥에서 들어온 주소: 인물 주소는 지도 안에서 관계도로 엶(ROUTE_FROM_PARENT). 처음 화면에서 같은 주소로 다시 들어와도 다시 적용
    if (h !== frameHash || entering) {
      frameHash = h; const w = frame.contentWindow; w.ROUTE_FROM_PARENT = true;
      // 주소를 바로 바꾸고 즉시 적용(비동기 hashchange를 기다리면 탭 표시가 옛 보기로 남음)
      if (w.location.hash !== h) w.history.replaceState(null, '', h);
      w.dispatchEvent(new HashChangeEvent('hashchange'));
    }
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
  // ── 처음 화면 → 관계도 전환 ──
  // ① 처음 화면이 어둠 속으로 가라앉고 고른 사람 사진만 떠오름 → ② 사진이 관계도 가운데 그 사람 원으로 날아가며 둥글어짐
  // → ③ 그 원에서부터 관계도가 원형으로 퍼지며 드러남. 움직임 줄이기 설정이면 바로 넘어감
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(.65, 0, .35, 1)';
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const frameRect = () => frame.getBoundingClientRect();
  // 관계도 안에서 그 사람 원이 자리를 잡을 때까지 (위치가 몇 프레임 연속 같으면) 기다림
  async function settledNode(id, limit) {
    const t0 = performance.now(); let last = '', same = 0;
    while (performance.now() - t0 < limit) {
      await new Promise(r => requestAnimationFrame(r));
      const d = frame.contentDocument, el = d && d.querySelector(`.node[data-id="${CSS.escape(id)}"] .node__dot`);
      if (!el) continue;
      const r = el.getBoundingClientRect(), k = [r.left, r.top, r.width].map(Math.round).join();
      if (r.width && k === last) { if (++same >= 4) return r; } else { last = k; same = 0; }
    }
    return null;
  }
  async function enterMap(href, row) {
    const id = decodeURIComponent(href.split('/')[1] || '');
    const src = document.querySelector('.fig.on .fig-img');
    const wrap = document.querySelector('.wrap');
    let ghost = null;
    if (src) {
      // 사진 카드가 화면에 보이면 그 자리에서, 목록을 내려 봐서 안 보이면 누른 사건 줄 왼쪽에서 작은 사진으로 떠오름
      let r = src.closest('.fig-photo').getBoundingClientRect();
      if (r.bottom < 56 + r.height / 2 || r.top > innerHeight - r.height / 2) {
        const q = row.getBoundingClientRect(), s = 64;
        r = { left: q.left + 12, top: q.top + (q.height - s) / 2, width: s, height: s };
      }
      ghost = src.cloneNode();
      ghost.className = 'fx-ghost';
      Object.assign(ghost.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', objectPosition: src.style.objectPosition });
      document.body.appendChild(ghost);
      ghost.animate([{ transform: 'none', boxShadow: '0 0 0 rgba(0,0,0,0)' }, { transform: 'scale(1.04)', boxShadow: '0 24px 64px rgba(0,0,0,.5)' }], { duration: 360, easing: EASE, fill: 'forwards' });
    }
    // 처음 화면은 가라앉음
    await Promise.all(['.wrap', '.cue', '.bg-credit', '.foot', '.backdrop'].map(q => document.querySelector(q)).filter(Boolean)
      .map(el => el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: el === wrap ? 'scale(.985)' : 'none' }], { duration: 320, easing: EASE, fill: 'forwards' }).finished));
    // 지도를 열되, 원형으로 드러낼 때까지는 가려 둠
    document.body.classList.add('fx-entering');
    location.hash = href;
    const target = await settledNode(id, frame.dataset.ready ? 1200 : 4000);
    const fr = frameRect();
    const cx = target ? target.left + fr.left + target.width / 2 : innerWidth / 2;
    const cy = target ? target.top + fr.top + target.height / 2 : fr.top + fr.height / 2;
    const ox = cx - fr.left, oy = cy - fr.top, R = Math.hypot(Math.max(ox, fr.width - ox), Math.max(oy, fr.height - oy));
    document.body.classList.remove('fx-entering');
    const reveal = frame.animate([{ clipPath: `circle(0px at ${ox}px ${oy}px)` }, { clipPath: `circle(${R}px at ${ox}px ${oy}px)` }],
      { duration: 900, delay: ghost ? 380 : 0, easing: 'cubic-bezier(.7, 0, .2, 1)', fill: 'backwards' });
    if (ghost) {
      const g = ghost.getBoundingClientRect(), size = target ? target.width : 64;
      const dx = cx - (g.left + g.width / 2), dy = cy - (g.top + g.height / 2);
      ghost.getAnimations().forEach(a => a.cancel());
      await ghost.animate([
        { transform: 'none', borderRadius: '10px', width: g.width + 'px', height: g.height + 'px', opacity: 1 },
        { offset: .85, opacity: 1 },
        { transform: `translate(${dx + (g.width - size) / 2}px, ${dy + (g.height - size) / 2}px)`, borderRadius: '50%', width: size + 'px', height: size + 'px', opacity: 0 },
      ], { duration: 640, easing: EASE, fill: 'forwards' }).finished;
      ghost.remove();
    }
    await reveal.finished.catch(() => {});
  }
  frame.addEventListener('load', () => { frame.dataset.ready = '1'; });
  let entering = false;
  document.addEventListener('click', e => {
    const a = e.target.closest('a.case-head');
    if (!a || reduce || entering || isApp(location.hash) || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    entering = true;
    enterMap(a.getAttribute('href'), a).catch(() => { if (location.hash !== a.getAttribute('href')) location.hash = a.getAttribute('href'); })
      .finally(() => { entering = false; document.body.classList.remove('fx-entering'); ['.wrap', '.cue', '.bg-credit', '.foot', '.backdrop'].forEach(q => document.querySelector(q)?.getAnimations().forEach(x => x.cancel())); document.querySelectorAll('.fx-ghost').forEach(g => g.remove()); });
  }, true);

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
