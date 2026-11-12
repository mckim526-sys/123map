// "그날 밤의 지도": 2024.12.3 22:27 대통령실에서 시작해 시간 순서대로 장소에 불이 켜진다.
// 위치는 관계를 보여 주기 위한 개략도다. 시각·내용은 각 항목의 출처(보도·공소장 인용 보도)를 따른다.
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const SRC = {
    sisain: ['시사IN · 헌정 유린 431분의 타임라인', 'https://www.sisain.co.kr/news/articleView.html?idxno=54520'],
    dt: ['디지털타임스 · 국무회의 5분 만에 종료', 'https://www.dt.co.kr/article/11632101'],
    mt: ['머니투데이 · 공소장으로 본 계엄', 'https://www.mt.co.kr/society/2025/12/02/2025112816231532055'],
    seoul: ['서울신문 · 공소장으로 드러난 경찰 동원', 'https://m.seoul.co.kr/news/2025/01/18/20250118500018'],
    newsisJcs: ['뉴시스 · 합참 장교 "다시 걸면 된다" 증언', 'https://www.newsis.com/view/NISX20251209_0003434655'],
    newsisSafe: ['뉴시스 · 박성재·이상민 안가회동', 'https://www.newsis.com/view/NISX20251212_0003439316'],
    newneek: ['뉴닉 · 계엄은 어디서 시작됐을까', 'https://newneek.co/@newneek/article/15861'],
    wikitree: ['위키트리 · 롯데리아 회동 CCTV', 'https://www.wikitree.co.kr/articles/1074295'],
    tf: ['더팩트 · 방첩사 수사단장 "14명 체포 지시"', 'https://news.tf.co.kr/read/life/2209570.htm'],
    newsisArrest: ['뉴시스 · 관저 체포 집행(1.15)', 'https://www.newsis.com/view/NISX20250115_0003032811'],
    newstapaArrest: ['뉴스타파 · 체포 불발(1.3)', 'https://newstapa.org/article/0dSpp'],
  };
  // [id, 이름, 설명, 경도, 위도, 보조지도, 이어지는 재판 [인물id, 재판id]…]
  const PLACES = [
    ['office', '용산 대통령실', '국무회의·계엄 선포', 126.9773, 37.5321, null, [['yoon', 'yoon-main'], ['p62', 'case67'], ['p56', 'case71'], ['p68', 'case78'], ['p63', 'case69']]],
    ['jcs', '국방부·합참', '계엄사령부 지휘', 126.9812, 37.5297, null, [['kim', 'kim-main'], ['audit-129', 'military-main-audit-129']]],
    ['assembly', '국회', '봉쇄·진입·해제 의결', 126.9145, 37.5317, null, [['cho', 'cho-main'], ['p29', 'military-main-p29'], ['audit-131', 'field-audit-131'], ['p76', 'case138']]],
    ['safehouse', '삼청동 안가', '경찰 수뇌부 호출', 126.9822, 37.5858, null, [['cho', 'cho-main'], ['p64', 'case72'], ['p65', 'case73']]],
    ['residence', '한남동 관저', '체포영장 집행 저지', 127.0040, 37.5370, null, [['yoon', 'yoon-obstruction'], ['p70', 'case80'], ['keon', 'case21']]],
    ['nec', '과천 중앙선관위', '계엄군 진입', 0.30, 0.42, 'gwacheon', [['p74', 'military-main-p74'], ['audit-134', 'field-audit-134']]],
    ['dsc', '과천 방첩사령부', '체포조 편성', 0.72, 0.62, 'gwacheon', [['p21', 'military-main-p21'], ['audit-133', 'field-audit-133']]],
    ['burger', '안산 햄버거 가게', '‘햄버거 회동’', 0.5, 0.55, 'ansan', [['noh', 'noh-main'], ['audit-138', 'burger-audit-138'], ['p74', 'moon-list']]],
  ].map(([id, name, sub, x, y, inset, cases]) => ({id, name, sub, x, y, inset, cases}));
  const P = Object.fromEntries(PLACES.map(p => [p.id, p]));
  // 이름표 위치: 가까운 점끼리 겹치지 않게 [x, y, 정렬]
  const LABEL = {office: [-16, -14, 'end'], jcs: [16, 30, 'start'], burger: [0, 34, 'middle'], nec: [14, -12, 'start'], dsc: [-14, 30, 'end']};
  // phase: before(이전) / night(12.3 밤) / after(이후). sort 값은 정렬용 분.
  const EVENTS = [
    ['before', '2024.11.17 · 12.1', 'burger', '노상원 전 정보사령관이 정보사 간부들(정성욱·김봉규 대령 등)과 패스트푸드점에서 만나 선관위 장악 등 계엄 준비를 논의한 것으로 조사됐습니다.', 'newneek'],
    ['before', '12.3 낮', 'burger', '계엄 몇 시간 전, 노상원·김용군·구삼회·방정환 4명이 같은 곳에서 다시 만났습니다. CCTV에 남은 이른바 ‘햄버거 회동’입니다.', 'wikitree'],
    ['night', '19:20', 'safehouse', '윤석열 대통령과 김용현 국방부 장관이 조지호 경찰청장·김봉식 서울경찰청장을 불러, 22시 계엄 선포와 국회 출동 계획이 적힌 A4 문건을 건넸습니다.', 'seoul'],
    ['night', '22:17', 'office', '대통령실 대접견실에서 국무회의가 열렸다가 5분 만인 22:22에 끝났습니다. 참석·배석자는 11명이었습니다.', 'dt'],
    ['night', '22:27', 'office', '윤석열 대통령이 대통령실 브리핑룸에서 비상계엄을 선포했습니다.', 'mt'],
    ['night', '22:30', 'nec', '계엄군 10여 명이 과천 중앙선관위 청사에 들어가 당직자 휴대전화를 빼앗고 출입을 통제했습니다.', 'sisain'],
    ['night', '22:35', 'assembly', '경찰 기동대가 국회 출입문에 배치되며 봉쇄가 시작됐습니다. 22:48부터 18분간은 아무도 들어갈 수 없었습니다.', 'seoul'],
    ['night', '22:43', 'jcs', '김용현 장관이 전군 주요 지휘관 회의를 소집했습니다.', 'sisain'],
    ['night', '23:03', 'assembly', '우원식 국회의장이 담장을 넘어 국회로 들어갔습니다.', 'sisain'],
    ['night', '밤', 'dsc', '여인형 방첩사령관이 이재명·한동훈·우원식 등 14명을 체포하라고 지시했고, 체포조가 국회 쪽으로 출동했다는 증언이 나왔습니다.', 'tf'],
    ['night', '23:48', 'assembly', '무장한 계엄군이 헬기를 타고 국회 경내로 들어오기 시작했습니다.', 'sisain'],
    ['night', '00:30', 'nec', '계엄군 110여 명이 선관위 과천청사에 추가로 진입했습니다. 같은 시간대 관악구 여론조사심의위원회와 수원 선거연수원에도 병력이 들어갔습니다.', 'sisain'],
    ['night', '00:39', 'assembly', '계엄군이 국민의힘 당대표실 유리창을 깨고 국회 본청 안으로 들어갔습니다.', 'sisain'],
    ['night', '01:01', 'assembly', '국회가 재석 의원 190명 전원 찬성으로 계엄 해제 요구 결의안을 가결했습니다.', 'sisain'],
    ['night', '해제 의결 뒤', 'jcs', '윤 대통령이 합참 결심지원실을 찾아 김용현 장관·박안수 계엄사령관과 만났습니다. “다시 걸면 된다”는 말을 했다는 합참 장교의 법정 증언이 있습니다.', 'newsisJcs'],
    ['night', '02:03', 'assembly', '국회 경내 계엄군이 모두 철수했습니다.', 'sisain'],
    ['night', '04:30', 'office', '국무회의에서 계엄 해제안이 의결됐습니다.', 'sisain'],
    ['after', '12.4 저녁', 'safehouse', '계엄 해제 다음 날, 박성재 법무부 장관·이상민 행정안전부 장관 등이 삼청동 안가에서 만났습니다. 특검은 이 자리에 계엄 관련 문건이 오갔다고 봤습니다.', 'newsisSafe'],
    ['after', '2025.1.3', 'residence', '공수처가 관저에서 체포영장 집행에 나섰지만 대통령경호처가 막아 무산됐습니다.', 'newstapaArrest'],
    ['after', '2025.1.15', 'residence', '두 번째 집행 끝에 윤석열 대통령이 관저에서 체포됐습니다.', 'newsisArrest'],
  ].map(([phase, time, place, text, src], i) => ({i, phase, time, place, text, src}));
  const START = EVENTS.findIndex(e => e.time === '22:27');

  // 서울 도심 개략도: 경도 126.895~127.025, 위도 37.512~37.598
  const W = 1000, H = 760, LNG = [126.895, 127.025], LAT = [37.598, 37.512];
  const X = lng => (lng - LNG[0]) / (LNG[1] - LNG[0]) * W;
  const Y = lat => (lat - LAT[0]) / (LAT[1] - LAT[0]) * (H - 190);
  const HAN = [[126.895, 37.556], [126.906, 37.549], [126.918, 37.542], [126.932, 37.535], [126.946, 37.527], [126.960, 37.520], [126.974, 37.5155], [126.989, 37.5135], [127.002, 37.5165], [127.012, 37.5235], [127.025, 37.5285]];
  const INSETS = {gwacheon: {x: 560, y: 600, w: 250, h: 140, label: '과천 · 남쪽 약 12km'}, ansan: {x: 830, y: 600, w: 160, h: 140, label: '안산 · 약 30km'}};
  function pos(p) {
    if (!p.inset) return [X(p.x), Y(p.y)];
    const b = INSETS[p.inset]; return [b.x + p.x * b.w, b.y + p.y * b.h];
  }
  const host = document.getElementById('nightmap');
  if (!host) return;
  host.innerHTML = `
    <div class="nm-copy">
      <p class="kicker"><span class="pulse" aria-hidden="true"></span><span id="nmDate">2024. 12. 3. 화요일 밤</span></p>
      <h1><span class="time" id="nmClock">22:27</span><span class="line" id="nmPlace">용산 대통령실</span></h1>
      <p class="nm-text" id="nmText"></p>
      <p class="nm-src" id="nmSrc"></p>
      <div class="nm-controls">
        <button class="nm-btn" id="nmPrev" aria-label="이전 장면">‹</button>
        <button class="nm-play" id="nmPlay" aria-pressed="false"><span>▶</span> 그날 밤 따라가기</button>
        <button class="nm-btn" id="nmNext" aria-label="다음 장면">›</button>
      </div>
    </div>
    <div class="nm-cases" id="nmCases"></div>
    <figure class="nm-map">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="12월 3일 밤 사건이 벌어진 장소를 표시한 서울 개략도">
        <defs><radialGradient id="nmGlow"><stop offset="0" stop-color="#e5484d" stop-opacity=".55"/><stop offset="1" stop-color="#e5484d" stop-opacity="0"/></radialGradient>
          <pattern id="nmGrid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#ffffff0d"/></pattern></defs>
        <rect width="${W}" height="${H - 180}" fill="url(#nmGrid)"/>
        <path class="nm-river" d="M${HAN.map(([a, b]) => `${X(a).toFixed(1)} ${Y(b).toFixed(1)}`).join(' L')}"/>
        <text class="nm-area river" x="${X(126.951)}" y="${Y(37.5205) + 30}">한강</text>
        <text class="nm-area" x="${X(126.918)}" y="${Y(37.5255) + 22}">여의도</text>
        <text class="nm-area" x="${X(126.975)}" y="${Y(37.5395) - 30}">용산</text>
        <text class="nm-area" x="${X(126.978)}" y="${Y(37.574)}">종로·광화문</text>
        ${Object.entries(INSETS).map(([k, b]) => `<g class="nm-inset"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6"/><text x="${b.x + 10}" y="${b.y + 20}">${esc(b.label)}</text></g>`).join('')}
        <g id="nmTrail"></g>
        ${PLACES.map(p => { const [x, y] = pos(p); return `<g class="nm-place" data-place="${p.id}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" tabindex="0" role="button" aria-label="${esc(p.name)}">
          <circle class="glow" r="46" fill="url(#nmGlow)"/><circle class="ring" r="15"/><circle class="dot" r="6"/>
          ${(([lx, ly, la]) => `<text class="name" x="${lx}" y="${ly}" text-anchor="${la}">${esc(p.name)}</text><text class="sub" x="${lx}" y="${ly + 16}" text-anchor="${la}">${esc(p.sub)}</text>`)(LABEL[p.id] || [14, -12, 'start'])}</g>`; }).join('')}
      </svg>
      <figcaption>위치는 관계를 보여 주기 위한 개략도입니다. 장소를 누르면 그곳에서 벌어진 일을 모아 봅니다.</figcaption>
    </figure>
    <div class="nm-timeline" role="group" aria-label="시간 순서">
      ${['before', 'night', 'after'].map(ph => `<div class="nm-phase ${ph}"><span class="nm-phase-label">${ph === 'before' ? '그 전' : ph === 'night' ? '12월 3일 밤 → 4일 새벽' : '그 후'}</span><ol>${EVENTS.filter(e => e.phase === ph).map(e => `<li><button data-ev="${e.i}" title="${esc(P[e.place].name)}"><span>${esc(e.time)}</span></button></li>`).join('')}</ol></div>`).join('')}
    </div>`;
  const $ = id => document.getElementById(id);
  let idx = START, timer = null, focusPlace = null;
  function caseChips(place) {
    return place.cases.map(([pid, cid]) => {
      const p = persons.find(v => v.id === pid), r = p && p.records.find(x => x.id === cid);
      return r ? `<button data-go-person="${esc(pid)}" data-go-case="${esc(cid)}"><b>${esc(r.label)}</b><small>${esc(p.name)}${typeof trialSize === 'function' && trialSize(p, r) > 1 ? ` 외 ${trialSize(p, r) - 1}명` : ''}</small></button>` : '';
    }).join('');
  }
  function show(i, opts = {}) {
    idx = Math.max(0, Math.min(EVENTS.length - 1, i));
    const e = EVENTS[idx], place = P[e.place];
    focusPlace = opts.place || null;
    $('nmClock').textContent = e.time;
    $('nmClock').classList.toggle('small', !/^\d\d:\d\d$/.test(e.time));
    $('nmDate').textContent = e.phase === 'night' ? (/^0[0-5]|해제/.test(e.time) ? '2024. 12. 4. 수요일 새벽' : '2024. 12. 3. 화요일 밤') : e.phase === 'before' ? '계엄 이전' : '계엄 이후';
    $('nmPlace').textContent = place.name;
    if (opts.place) {
      const evs = EVENTS.filter(v => v.place === opts.place);
      $('nmText').innerHTML = `<ol class="nm-list">${evs.map(v => `<li class="${v.i === idx ? 'on' : ''}"><button data-ev="${v.i}"><time>${esc(v.time)}</time>${esc(v.text)}</button></li>`).join('')}</ol>`;
    } else $('nmText').textContent = e.text;
    const s = SRC[e.src]; $('nmSrc').innerHTML = s ? `출처: <a href="${s[1]}" target="_blank" rel="noopener noreferrer">${esc(s[0])} ↗</a>` : '';
    $('nmCases').innerHTML = `<p>이어지는 재판</p><div>${caseChips(place)}</div>`;
    host.querySelectorAll('.nm-place').forEach(g => {
      const id = g.dataset.place, seen = EVENTS.slice(0, idx + 1).some(v => v.place === id);
      g.classList.toggle('active', id === e.place); g.classList.toggle('seen', seen && id !== e.place);
    });
    host.querySelectorAll('[data-ev]').forEach(b => { const n = +b.dataset.ev; b.classList.toggle('on', n === idx); b.classList.toggle('past', n < idx); });
    // 지나온 경로를 선으로 잇는다 (같은 밤 안에서만).
    const night = EVENTS.filter(v => v.phase === 'night' && v.i <= idx).map(v => pos(P[v.place]));
    $('nmTrail').innerHTML = e.phase === 'night' && night.length > 1 ? `<polyline class="nm-trail" points="${night.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}"/>` : '';
  }
  function stop() { clearInterval(timer); timer = null; $('nmPlay').setAttribute('aria-pressed', 'false'); $('nmPlay').querySelector('span').textContent = '▶'; }
  function play() {
    if (timer) return stop();
    if (idx >= EVENTS.length - 1) idx = -1;
    $('nmPlay').setAttribute('aria-pressed', 'true'); $('nmPlay').querySelector('span').textContent = '❚❚';
    show(idx + 1);
    timer = setInterval(() => { if (idx >= EVENTS.length - 1) return stop(); show(idx + 1); }, 3200);
  }
  host.addEventListener('click', ev => {
    const t = ev.target;
    if (t.closest('#nmPlay')) return play();
    if (t.closest('#nmPrev')) { stop(); return show(idx - 1); }
    if (t.closest('#nmNext')) { stop(); return show(idx + 1); }
    const b = t.closest('[data-ev]'); if (b) { stop(); return show(+b.dataset.ev, {place: focusPlace}); }
    const g = t.closest('.nm-place'); if (g) { stop(); const first = EVENTS.find(v => v.place === g.dataset.place); return show(first.i, {place: g.dataset.place}); }
    const c = t.closest('[data-go-person]'); if (c && typeof window.firstGo === 'function') { stop(); window.firstGo(c.dataset.goPerson, c.dataset.goCase); }
  });
  host.addEventListener('keydown', ev => {
    const g = ev.target.closest('.nm-place'); if (g && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); g.dispatchEvent(new MouseEvent('click', {bubbles: true})); }
  });
  show(START);
})();
