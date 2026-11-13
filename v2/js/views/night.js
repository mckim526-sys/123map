// 그날 밤: 2024.12.3 밤 사건을 장소별로. 위치는 관계를 보여 주는 개략도이고, 시각·내용은 각 항목의 출처(보도·공소장 인용 보도)를 따릅니다.
// 구성: 지도가 영역 전체를 채우고, 왼쪽 빈자리에 지금 장면(시각·장소·한 문장)을 겹쳐 둠. 아래는 시간 막대 하나.
const NightView = (() => {
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
    ['nec', '과천 중앙선관위', '계엄군 진입', 0.24, 0.48, 'gwacheon', [['p74', 'military-main-p74'], ['audit-134', 'field-audit-134']]],
    ['dsc', '과천 방첩사령부', '체포조 편성', 0.76, 0.72, 'gwacheon', [['p21', 'military-main-p21'], ['audit-133', 'field-audit-133']]],
    ['burger', '안산 햄버거 가게', '‘햄버거 회동’', 0.5, 0.58, 'ansan', [['noh', 'noh-main'], ['audit-138', 'burger-audit-138'], ['p74', 'moon-list']]],
  ].map(([id, name, sub, x, y, inset, cases]) => ({id, name, sub, x, y, inset, cases}));
  const P = Object.fromEntries(PLACES.map(p => [p.id, p]));
  // 이름표 위치: 가까운 점끼리 겹치지 않게 [x, y, 정렬]
  const LABEL = {office: [-16, -14, 'end'], jcs: [16, 30, 'start'], burger: [0, 34, 'middle'], nec: [0, 38, 'middle'], dsc: [0, -24, 'middle']};
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
  const INSETS = {ansan: {x: 250, y: 590, w: 180, h: 140, label: '안산 · 약 30km'}, gwacheon: {x: 470, y: 590, w: 250, h: 140, label: '과천 · 남쪽 약 12km'}};
  const CONTENT = {x: 110, y: 40, w: 870, h: 700}; // 장소·이름표가 차지하는 범위 (빈자리 없이 맞출 기준)
  function pos(p) {
    if (!p.inset) return [X(p.x), Y(p.y)];
    const b = INSETS[p.inset]; return [b.x + p.x * b.w, b.y + p.y * b.h];
  }
  const PHASE = { before: '그 전', night: '12월 3일 밤 → 4일 새벽', after: '그 후' };
  const PHASE_W = { before: 14, night: 68, after: 18 }; // 시간 막대에서 차지하는 너비(%)
  const pane = $('#nightPane');
  let built = false, idx = START, timer = null, focusPlace = null, showAllCases = false;

  // 같은 재판 인원(본인 포함)
  const trialSize = (p, r) => {
    const ids = new Set([p.id, ...(r.members || [])]);
    if (r.family) persons.forEach(v => { if (v.records.some(x => x.family === r.family)) ids.add(v.id); });
    return ids.size;
  };
  // 시간 막대 위 점 위치(%)
  const evX = e => {
    const list = EVENTS.filter(v => v.phase === e.phase), k = list.indexOf(e);
    const start = e.phase === 'before' ? 0 : e.phase === 'night' ? PHASE_W.before : PHASE_W.before + PHASE_W.night;
    return start + PHASE_W[e.phase] * (k + .5) / list.length;
  };

  function build() {
    pane.innerHTML = `
      <div class="nm">
        <figure class="nm-map" id="nmMap">
          <svg id="nmSvg" viewBox="${CONTENT.x} ${CONTENT.y} ${CONTENT.w} ${CONTENT.h}" role="img" aria-label="12월 3일 밤 사건이 벌어진 장소를 표시한 서울 개략도">
            <defs><radialGradient id="nmGlow"><stop offset="0" stop-color="#e5484d" stop-opacity=".6"/><stop offset="1" stop-color="#e5484d" stop-opacity="0"/></radialGradient></defs>
            <path class="nm-river" d="M${HAN.map(([a, b]) => `${X(a).toFixed(1)} ${Y(b).toFixed(1)}`).join(' L')}"/>
            <text class="nm-area river" x="${X(126.951)}" y="${Y(37.5205) + 34}">한강</text>
            <text class="nm-area" x="${X(126.918)}" y="${Y(37.5255) + 26}">여의도</text>
            <text class="nm-area" x="${X(126.975)}" y="${Y(37.5395) - 34}">용산</text>
            <text class="nm-area" x="${X(126.978)}" y="${Y(37.574)}">종로</text>
            ${Object.values(INSETS).map(b => `<g class="nm-inset"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="10"/><text x="${b.x + 12}" y="${b.y + 22}">${esc(b.label)}</text></g>`).join('')}
            <g id="nmTrail"></g>
            ${PLACES.map(p => { const [x, y] = pos(p); const [lx, ly, la] = LABEL[p.id] || [16, -14, 'start']; return `
            <g class="nm-pin" data-place="${p.id}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" tabindex="0" role="button" aria-label="${esc(p.name)} · ${esc(p.sub)}">
              <circle class="glow" r="70" fill="url(#nmGlow)"/><circle class="ring" r="15"/><circle class="dot" r="6"/>
              <text class="name" x="${lx}" y="${ly}" text-anchor="${la}">${esc(p.name)}</text>
              <text class="sub" x="${lx}" y="${ly + 20}" text-anchor="${la}">${esc(p.sub)}</text></g>`; }).join('')}
          </svg>
        </figure>
        <section class="nm-scene" aria-live="polite">
          <p class="nm-date" id="nmDate"></p>
          <p class="nm-clock" id="nmClock"></p>
          <h3 class="nm-place-name" id="nmPlace"></h3>
          <div class="nm-text" id="nmText"></div>
          <p class="nm-src" id="nmSrc"></p>
          <div class="nm-controls">
            <button class="nm-ctl" id="nmPrev" aria-label="이전 장면">‹</button>
            <button class="nm-play" id="nmPlay" aria-pressed="false"><span aria-hidden="true">▶</span> 그날 밤 따라가기</button>
            <button class="nm-ctl" id="nmNext" aria-label="다음 장면">›</button>
          </div>
          <div class="nm-cases" id="nmCases"></div>
        </section>
        <div class="nm-track" role="group" aria-label="시간 순서">
          <div class="nm-track__rail">
            ${Object.keys(PHASE).map(ph => `<span class="nm-track__seg nm-track__seg--${ph}" style="width:${PHASE_W[ph]}%"><i>${PHASE[ph]}</i></span>`).join('')}
            <span class="nm-track__fill" id="nmFill"></span>
            ${EVENTS.map(e => `<button class="nm-track__dot" data-ev="${e.i}" style="left:${evX(e).toFixed(2)}%" aria-label="${esc(e.time)} · ${esc(P[e.place].name)}"><span>${esc(e.time)}</span></button>`).join('')}
          </div>
        </div>
      </div>`;
    built = true;
    fit();
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe($('#nmMap'));
    show(START);
  }

  // 지도가 영역을 가득 채우게: 영역 비율에 맞춰 보이는 범위를 넓히고,
  // 넓은 화면에서는 왼쪽(장면 설명이 겹치는 자리)을 비워 장소들이 오른쪽에 크게 놓이게 함
  function fit() {
    const box = $('#nmMap'), svg = $('#nmSvg'); if (!box || !svg) return;
    const pw = box.clientWidth, ph = box.clientHeight; if (!pw || !ph) return;
    const scene = $('.nm-scene', pane), overlay = getComputedStyle(scene).position === 'absolute';
    const ow = overlay ? scene.offsetWidth + 24 : 0;
    const s = Math.min((pw - ow) / CONTENT.w, ph / CONTENT.h);
    const vw = pw / s, vh = ph / s;
    const x0 = CONTENT.x - ow / s - ((pw - ow) / s - CONTENT.w) / 2, y0 = CONTENT.y - (vh - CONTENT.h) / 2;
    svg.setAttribute('viewBox', `${x0.toFixed(1)} ${y0.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`);
  }

  function caseChips(place) {
    const chips = place.cases.map(([pid, cid]) => {
      const p = persons.find(v => v.id === pid), r = p && p.records.find(x => x.id === cid);
      if (!r) return '';
      const n = trialSize(p, r);
      return `<button class="nm-case" data-id="${esc(pid)}" data-case-link="${esc(cid)}">${avatar(p, 'ava--sm')}<b>${esc(r.label)}</b><small>${esc(p.name)}${n > 1 ? ` 외 ${n - 1}` : ''}</small></button>`;
    }).filter(Boolean);
    const shown = showAllCases ? chips : chips.slice(0, 3);
    return `<p class="nm-cases__title">여기서 이어지는 재판 ${chips.length}건</p><div class="nm-cases__list">${shown.join('')}</div>
      ${chips.length > 3 ? `<button class="nm-more" data-more>${showAllCases ? '접기' : `${chips.length - 3}건 더 보기`}</button>` : ''}`;
  }

  function show(i, opts = {}) {
    if (EVENTS[i] && EVENTS[i].place !== EVENTS[idx]?.place) showAllCases = false;
    idx = Math.max(0, Math.min(EVENTS.length - 1, i));
    const e = EVENTS[idx], place = P[e.place];
    focusPlace = opts.place || null;
    const clock = $('#nmClock');
    clock.textContent = e.time;
    clock.classList.toggle('is-text', !/^\d\d:\d\d$/.test(e.time));
    $('#nmDate').textContent = e.phase === 'night' ? (/^0[0-5]|해제/.test(e.time) ? '2024년 12월 4일 수요일 새벽' : '2024년 12월 3일 화요일 밤') : e.phase === 'before' ? '계엄 이전' : '계엄 이후';
    $('#nmPlace').textContent = place.name;
    $('#nmText').innerHTML = opts.place
      ? `<ol class="nm-list">${EVENTS.filter(v => v.place === opts.place).map(v => `<li><button class="${v.i === idx ? 'is-active' : ''}" data-ev="${v.i}"><time>${esc(v.time)}</time><span>${esc(v.text)}</span></button></li>`).join('')}</ol>`
      : `<p>${esc(e.text)}</p>`;
    const s = SRC[e.src];
    $('#nmSrc').innerHTML = s ? `출처 · <a href="${s[1]}" target="_blank" rel="noopener noreferrer">${esc(s[0])} ↗</a>` : '';
    $('#nmCases').innerHTML = caseChips(place);
    $$('.nm-pin', pane).forEach(g => {
      const id = g.dataset.place, seen = EVENTS.slice(0, idx + 1).some(v => v.place === id);
      g.classList.toggle('is-active', id === e.place); g.classList.toggle('is-seen', seen && id !== e.place);
    });
    $$('.nm-track__dot', pane).forEach(b => { const n = +b.dataset.ev; b.classList.toggle('is-active', n === idx); b.classList.toggle('is-past', n < idx); b.setAttribute('aria-pressed', n === idx); });
    $('#nmFill').style.width = evX(e).toFixed(2) + '%';
    const night = EVENTS.filter(v => v.phase === 'night' && v.i <= idx).map(v => pos(P[v.place]));
    $('#nmTrail').innerHTML = e.phase === 'night' && night.length > 1 ? `<polyline class="nm-trail" points="${night.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}"/>` : '';
  }

  function stop() {
    clearInterval(timer); timer = null;
    const b = $('#nmPlay'); if (!b) return;
    b.setAttribute('aria-pressed', 'false'); b.querySelector('span').textContent = '▶';
  }
  function play() {
    if (timer) return stop();
    if (idx >= EVENTS.length - 1) idx = -1;
    $('#nmPlay').setAttribute('aria-pressed', 'true'); $('#nmPlay').querySelector('span').textContent = '❚❚';
    show(idx + 1);
    timer = setInterval(() => { if (idx >= EVENTS.length - 1 || pane.hidden) return stop(); show(idx + 1); }, 3200);
  }

  pane.addEventListener('click', ev => {
    const t = ev.target;
    if (t.closest('#nmPlay')) return play();
    if (t.closest('#nmPrev')) { stop(); return show(idx - 1); }
    if (t.closest('#nmNext')) { stop(); return show(idx + 1); }
    if (t.closest('[data-more]')) { showAllCases = !showAllCases; $('#nmCases').innerHTML = caseChips(P[EVENTS[idx].place]); return; }
    const b = t.closest('[data-ev]'); if (b) { stop(); return show(+b.dataset.ev, { place: b.closest('.nm-list') ? focusPlace : null }); }
    const g = t.closest('.nm-pin'); if (g) { stop(); return show(EVENTS.find(v => v.place === g.dataset.place).i, { place: g.dataset.place }); }
    if (t.closest('[data-case-link]')) stop(); // 재판 상세는 공용 처리(main.js)가 엶
  });
  pane.addEventListener('keydown', ev => {
    const g = ev.target.closest('.nm-pin');
    if (g && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); g.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
  });

  // 보기가 열릴 때 한 번만 그림 (다른 조건이 바뀌어도 그날 밤 내용은 같음)
  function render() { if (!pane.hidden && !built) build(); if (pane.hidden) stop(); else if (built) requestAnimationFrame(fit); }
  return { render, count: () => PLACES.length };
})();
