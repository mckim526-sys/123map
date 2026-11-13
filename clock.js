// 시험 페이지: 22:27 선포 이후 흐른 시간 + 가운데 두 사람 → 누르면 사건이 차례로 펼쳐진다.
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const byId = new Map(persons.map(p => [p.id, p]));
  const START = new Date('2024-12-03T22:27:00+09:00');

  // ── 흐른 시간 ──
  const pad = n => String(n).padStart(2, '0');
  const elapsed = document.getElementById('elapsed');
  function tick() {
    let s = Math.max(0, Math.floor((Date.now() - START) / 1000));
    const d = Math.floor(s / 86400); s %= 86400;
    const h = Math.floor(s / 3600); s %= 3600;
    const m = Math.floor(s / 60); s %= 60;
    elapsed.innerHTML = `<span class="u"><b>${d.toLocaleString('ko-KR')}</b><i>일</i></span><span class="u"><b>${pad(h)}</b><i>시간</i></span><span class="u"><b>${pad(m)}</b><i>분</i></span><span class="u sec"><b>${pad(s)}</b><i>초</i></span>`;
    elapsed.setAttribute('aria-label', `${d}일 ${h}시간 ${m}분 지났습니다`);
  }
  tick(); setInterval(tick, 1000);

  // ── 재판 데이터 도우미 ──
  const CASE_RANK = {'yoon-main': 0, 'yoon-drone': 1, 'yoon-obstruction': 2, 'keon-three': 0, 'keon-gifts': 1, 'case108': 2};
  const AGENCY_RANK = {'내란특검': 0, '종합특검': 1, '해병대 특검': 2, '김건희 특검': 3};
  function trialIds(p, r) {
    const ids = new Set(r.members || []);
    if (r.family) persons.forEach(v => { if (v.records.some(x => x.family === r.family)) ids.add(v.id); });
    ids.delete(p.id);
    return [p.id, ...ids];
  }
  function recordFor(q, p, r) {
    if (q.id === p.id) return r;
    return q.records.find(x => (r.family && x.family === r.family) || (x.members || []).includes(p.id)) || q.records.find(x => x.label === r.label) || null;
  }
  const decided = s => s && s[0] && !/미확인|미도달|판단 전|대기|진행 중|확인 중|없음/.test(s[0]);
  const planned = s => s && /예정/.test((s[0] || '') + (s[2] || ''));
  const tone = t => /예정/.test(t) ? 'next' : /무죄|공소기각/.test(t) ? 'acquit' : /징역|무기|벌금|사형|유죄|자격정지/.test(t) ? 'guilty' : 'muted';
  const stageName = i => (i === 2 ? '대법원' : i + 1 + '심');
  const shortDate = s => ((s && s[2] || '').match(/\d{4}\.\d{2}\.\d{2}/) || [''])[0];
  function headline(r) {
    const st = r.stages || [];
    const n = st.findIndex(planned);
    if (n >= 0) return {text: `${stageName(n)} ${st[n][0]}`, date: shortDate(st[n]), tone: 'next'};
    const last = st.map((s, i) => [s, i]).filter(([s]) => decided(s)).pop();
    if (last) return {text: `${stageName(last[1])} ${last[0][0]}`, date: shortDate(last[0]), tone: tone(last[0][0])};
    return {text: r.status || '진행 확인 중', date: '', tone: 'muted'};
  }
  const face = (p, cls) => p.photo
    ? `<img class="${cls}" src="assets/${esc(p.photoFile || p.id + '.jpg')}" alt="" style="object-position:${esc(p.photoPosition || '50% 25%')}">`
    : `<span class="${cls} initials" aria-hidden="true">${esc(p.name.slice(0, 1))}</span>`;
  const sorted = p => [...p.records].sort((a, b) => (CASE_RANK[a.id] ?? 9) - (CASE_RANK[b.id] ?? 9) || (AGENCY_RANK[a.agency] ?? 9) - (AGENCY_RANK[b.agency] ?? 9) || trialIds(p, b).length - trialIds(p, a).length);

  // ── 가운데 두 사람 ── (사진 교체: file·위치·출처 표기)
  const FIG_PHOTO = {yoon: {file: 'clock-yoon.jpg', pos: '45% 30%', credit: ''}, keon: {file: 'clock-keon.jpg', pos: '50% 35%', credit: ''}};
  const figFace = p => { const o = FIG_PHOTO[p.id]; return o ? `<img class="fig-img" src="assets/${esc(o.file)}" alt="${esc(p.name)}" style="object-position:${esc(o.pos)}">${o.credit ? `<span class="fig-credit">${esc(o.credit)}</span>` : ''}` : face(p, 'fig-img'); };
  const stage = document.getElementById('stage'), list = document.getElementById('cases');
  const FIGS = ['yoon', 'keon'].map(id => byId.get(id));
  stage.innerHTML = FIGS.map(p => `
    <button class="fig" data-fig="${p.id}" aria-pressed="false" aria-controls="cases">
      ${figFace(p)}
      <span class="fig-label"><b>${esc(p.name)}</b><small>${esc(p.role)} · 사건 ${p.records.length}건</small></span>
    </button>`).join('');
  let current = null, openCase = null;
  function trialHtml(p, r) {
    const ids = trialIds(p, r);
    return `<div class="trial">
      ${(r.charges || []).length ? `<p class="charges">${r.charges.map(c => `<span>${esc(c.name)}</span>`).join('')}</p>` : ''}
      <ol class="defendants">${ids.map(id => { const q = byId.get(id), rec = recordFor(q, p, r); if (!rec) return ''; const st = rec.stages || []; return `
        <li><a class="who" href="index.html#person/${encodeURIComponent(q.id)}/${encodeURIComponent(rec.id)}">${face(q, 'who-img')}<span><b>${esc(q.name)}</b><small>${esc(q.role || '')}</small></span></a>
          <ol class="steps">${[0, 1, 2].map(i => { const s = st[i] || []; const t = planned(s) ? 'next' : decided(s) ? tone(s[0]) : 'muted'; return `<li class="${t}"><i>${stageName(i)}</i><b>${esc(s[0] || '—')}</b>${shortDate(s) ? `<small>${esc(shortDate(s))}</small>` : ''}</li>`; }).join('')}</ol></li>`; }).join('')}</ol>
      <p class="trial-foot">${ids.length > 1 ? `함께 재판받는 ${ids.length}명` : '단독 재판'} · 이름을 누르면 재판 상세로 이동합니다</p>
    </div>`;
  }
  function renderCases() {
    stage.querySelectorAll('.fig').forEach(b => { const on = b.dataset.fig === current; b.classList.toggle('on', on); b.classList.toggle('off', !!current && !on); b.setAttribute('aria-pressed', String(on)); });
    document.body.classList.toggle('picked', !!current);
    if (!current) { list.innerHTML = ''; return; }
    const p = byId.get(current);
    list.innerHTML = `<h2 class="cases-title"><b>${esc(p.name)}</b>의 사건 ${p.records.length}건</h2>
      <ol>${sorted(p).map((r, i) => { const h = headline(r), n = trialIds(p, r).length, open = openCase === r.id; return `
        <li class="case ${open ? 'open' : ''}" style="--i:${i}">
          <button class="case-head" data-case="${esc(r.id)}" aria-expanded="${open}">
            <span class="case-no">${pad(i + 1)}</span>
            <span class="case-main"><b>${esc(r.label)}</b><small>${esc(r.agency)}${n > 1 ? ` · 피고인 ${n}명` : ''}</small></span>
            <span class="case-now ${h.tone}">${esc(h.text)}${h.date ? `<small>${esc(h.date)}</small>` : ''}</span>
            <span class="chev" aria-hidden="true">＋</span>
          </button>
          ${open ? trialHtml(p, r) : ''}
        </li>`; }).join('')}</ol>`;
    try { history.replaceState(null, '', '#' + [current, openCase].filter(Boolean).join('/')); } catch {}
  }
  stage.addEventListener('click', e => {
    const b = e.target.closest('.fig'); if (!b) return;
    current = current === b.dataset.fig ? null : b.dataset.fig; openCase = null; renderCases();
    if (current && matchMedia('(max-width: 900px)').matches) setTimeout(() => list.scrollIntoView({block: 'start', behavior: 'smooth'}), 120);
    else if (current) document.getElementById('arena').scrollIntoView({block: 'nearest', behavior: 'smooth'});
  });
  list.addEventListener('click', e => {
    const b = e.target.closest('[data-case]'); if (!b) return;
    openCase = openCase === b.dataset.case ? null : b.dataset.case;
    const keepTop = b.getBoundingClientRect().top;
    list.classList.add('no-stagger'); renderCases();
    const nb = list.querySelector(`[data-case="${CSS.escape(b.dataset.case)}"]`);
    if (nb) window.scrollBy(0, nb.getBoundingClientRect().top - keepTop);
  });
  // #yoon/yoon-main 으로 시작 상태 복원
  const [h1, h2] = location.hash.slice(1).split('/').map(decodeURIComponent);
  if (byId.has(h1) && FIGS.some(p => p.id === h1)) { current = h1; if (byId.get(h1).records.some(r => r.id === h2)) openCase = h2; }
  renderCases();
})();
