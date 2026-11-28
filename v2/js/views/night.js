// 그날 밤: 2024.12.3 밤 사건을 장소별로. 위치는 관계를 보여 주는 개략도이고, 시각·내용은 1심 판결문과 공소장만 따릅니다(언론 기사 인용 없음).
// 구성: 지도가 영역 전체를 채우고, 왼쪽 빈자리에 지금 장면(시각·장소·한 문장)을 겹쳐 둠. 아래는 시간 막대 하나.
const NightView = (() => {
  // 서울중앙지법 2026.2.19 선고 2025고합129 등. 쪽수는 법원 공개 판결문에 인쇄된 번호를 따릅니다.
  const SRC = { verdict: '1심 판결문 요약', indict: '특검 공소사실과 1심 판단' };
  const sourceText = event => `${SRC[event.src]} · 2025고합129 등 · ${event.pages}쪽`;
  // [id, 이름, 설명, 경도, 위도, 보조지도, 이어지는 재판 [인물id, 재판id]…]
  const PLACES = [
    ['office', '용산 대통령실', '국무회의·계엄 선포', 126.9773, 37.5321, null, [['yoon', 'yoon-main'], ['p62', 'case67'], ['p56', 'case71'], ['p68', 'case78'], ['p63', 'case69']]],
    ['jcs', '국방부·합참', '계엄사령부 지휘', 126.9812, 37.5297, null, [['kim', 'kim-main'], ['audit-129', 'military-main-audit-129']]],
    ['assembly', '국회', '봉쇄·진입·해제 의결', 126.9145, 37.5317, null, [['cho', 'cho-main'], ['p29', 'military-main-p29'], ['audit-131', 'field-audit-131'], ['p76', 'case138']]],
    ['safehouse', '삼청동 안가', '비상대권 언급 · 경찰 수뇌부 호출', 126.9822, 37.5858, null, [['cho', 'cho-main'], ['p64', 'case72'], ['p65', 'case73']]],
    ['residence', '한남동 관저', '사령관들과 식사', 127.0040, 37.5370, null, [['yoon', 'yoon-main'], ['kim', 'kim-main'], ['p21', 'military-main-p21'], ['audit-130', 'military-main-audit-130'], ['p29', 'military-main-p29']]],
    ['nec', '과천 중앙선관위', '계엄군 진입', 0.24, 0.48, 'gwacheon', [['p74', 'military-main-p74'], ['audit-134', 'field-audit-134']]],
    ['dsc', '과천 방첩사령부', '체포조 편성', 0.76, 0.72, 'gwacheon', [['p21', 'military-main-p21'], ['audit-133', 'field-audit-133']]],
    ['burger', '안산 롯데리아', '‘햄버거 회동’', 0.5, 0.58, 'ansan', [['noh', 'noh-main'], ['audit-138', 'burger-audit-138'], ['p74', 'moon-list']]],
  ].map(([id, name, sub, x, y, inset, cases]) => ({id, name, sub, x, y, inset, cases}));
  const P = Object.fromEntries(PLACES.map(p => [p.id, p]));
  // 이름표 위치: 가까운 점끼리 겹치지 않게 [x, y, 정렬]
  const LABEL = {office: [-16, -14, 'end'], jcs: [16, 30, 'start'], burger: [0, 34, 'middle'], nec: [0, 38, 'middle'], dsc: [0, -24, 'middle']};
  // phase: before(계엄 이전) / night(12.3 밤~4일 새벽). 시각은 문서에 적힌 대로(‘경’ 생략).
  const EVENTS = [
    ['before', '2024.3.29', 'safehouse', '특검은 3월 29일쯤 윤석열 당시 대통령이 삼청동 안가에서 비상대권과 군의 역할을 언급했다고 기소했습니다. 1심 재판부는 모임 시기를 3월 말~4월 초로 보고 비상대권과 비상조치의 필요성을 언급한 취지를 인정했습니다. 군이 나서야 한다거나 비상계엄이 필요하다는 말은 증거가 부족해 인정하기 어렵다고 판단했습니다.', 'indict', '709~710, 1094'],
    ['before', '2024.10.1', 'residence', '1심 재판부는 국군의 날 행사 뒤 한남동 관저에서 윤 대통령이 김용현·여인형·곽종근·이진우와 식사하며 언론·노동계 일부를 비판하고, 비상대권 행사가 필요하다는 취지로 말했다고 봤습니다.', 'verdict', '14, 715~716'],
    ['before', '2024.11.17', 'burger', '1심 재판부는 노상원이 김용현 장관을 만난 뒤 안산 롯데리아에서 문상호·정성욱을 만나 선관위 관련 임무 준비를 점검했다고 봤습니다. 노상원은 법정에서 임무 준비를 확인하거나 물품 구입을 재촉한 사실을 부인했습니다.', 'verdict', '16, 27, 888~899'],
    ['before', '2024.12.1', 'burger', '노상원이 김용현 장관 공관을 다녀온 뒤 12:18~12:58 같은 롯데리아에서 문상호·김봉규·정성욱을 다시 만난 것으로 판결문에 적혀 있습니다.', 'verdict', '19, 29'],
    ['before', '12.3 낮', 'burger', '판결문은 14:49~16:03 같은 롯데리아에서 노상원이 김용군에게 “오늘이 계엄이다”라고 말하며 제2수사단 조직도 등이 적힌 문서를 보여 줬다고 기록합니다. 구삼회·방정환도 합류했다고 적었습니다.', 'verdict', '32~33, 889'],
    ['night', '19:20', 'safehouse', '1심 재판부는 윤 대통령이 조지호 경찰청장과 김봉식 서울경찰청장에게 “오늘 밤 22시에 비상계엄을 선포해야겠다”고 말했고, 김용현 장관이 국회·민주당사 등의 출동 시각과 장소가 적힌 문서를 건넸다고 판단했습니다.', 'verdict', '38~39'],
    ['night', '22:16', 'office', '중소벤처기업부 장관이 도착해 국무회의 구성원 11명이 모였습니다. 판결문은 윤 대통령이 계엄을 선포하겠다는 취지로 말하고 22:18쯤 대접견실을 떠났다고 기록합니다.', 'verdict', '43'],
    ['night', '22:27', 'office', '윤 대통령이 대통령실 브리핑룸에서 22:23부터 대국민담화를 발표하고, 22:27 비상계엄을 선포했습니다.', 'verdict', '45'],
    ['night', '22:28', 'jcs', '판결문은 김용현 장관이 합참 지하 전투통제실에서 전군주요지휘관회의를 열고, 22:33쯤 이진우 수방사령관에게 별도로 전화해 국회 출동과 도착 보고를 지시했다고 기록합니다. 1심 재판부는 그 임무가 국회를 봉쇄해 계엄 해제 요구안 의결을 막는 것이었다고 판단했습니다.', 'verdict', '48, 63, 787'],
    ['night', '22:30', 'nec', '판결문은 정보사 대원 10명이 과천 중앙선관위 청사 당직실에 들어가 휴대전화를 빼앗고 유선전화 선을 뽑은 뒤, 서버실을 사진으로 찍고 폐쇄했다고 기록합니다.', 'verdict', '89~90'],
    ['night', '22:48', 'assembly', '경찰 기동대와 국회경비대가 국회 출입문을 막기 시작했습니다. 23:07쯤 국회의원 출입을 잠시 허용했습니다.', 'verdict', '54~55, 59~60'],
    ['night', '23:23', 'jcs', '박안수 계엄사령관이 김용현 장관에게서 받은 ‘계엄사령부 포고령(제1호)’을 공고했습니다.', 'verdict', '48'],
    ['night', '23:33', 'assembly', '1심 재판부는 윤 대통령이 이진우 사령관에게 23:33쯤 전화해 국회 주변 상황을 물었고, 이후 00:32~00:36쯤 통화에서 본회의장에 있는 국회의원을 끌어내라는 취지로 지시했다고 판단했습니다. 윤 전 대통령은 의원들을 끌어내라는 지시를 부인했습니다.', 'verdict', '788~793'],
    ['night', '23:37', 'assembly', '판결문에는 계엄 포고령을 근거로 국회의원을 포함한 모든 사람의 국회 출입을 통제하라는 지시가 내려졌다고 적혀 있습니다.', 'verdict', '57~58'],
    ['night', '23:49', 'assembly', '판결문은 707특임단 등 96명을 태운 헬기 12대가 00:11쯤까지 국회의사당 뒤 운동장에 차례로 내렸다고 기록합니다.', 'verdict', '72'],
    ['night', '00:24', 'assembly', '판결문은 수방사 35특임대대 선발대가 국회 7문 옆 담을 넘어 들어갈 때 경찰이 도왔다고 기록합니다.', 'verdict', '64'],
    ['night', '00:32', 'assembly', '판결문은 00:32~00:34쯤 김현태 707특임단장 등 19명이 국회의사당 233호 유리창을 깨고 본관 2층으로 들어갔다고 기록합니다.', 'verdict', '75'],
    ['night', '00:33', 'dsc', '1심 재판부는 김용현 장관이 여인형 방첩사령관에게 이재명·우원식·한동훈을 우선 체포하라고 지시했다고 봤습니다. 판결문에는 00:38쯤 방첩사 출동조에 체포한 뒤 수방사 구금시설로 이동하라는 지시가 전달됐다고 적혀 있습니다.', 'verdict', '87~88'],
    ['night', '00:40', 'nec', '판결문은 3공수여단 병력 138명이 01:08쯤까지 선관위 과천청사에 도착했고, 이 중 52명이 1층 로비를 점거했다고 기록합니다.', 'verdict', '96'],
    ['night', '01:03', 'assembly', '00:49쯤 본회의가 열려 01:01쯤 해제 요구안이 상정됐습니다. 1심 판결문은 01:03쯤 재석 의원 190명 전원의 찬성으로 가결됐다고 기록합니다.', 'verdict', '101, 643'],
    ['night', '01:06', 'assembly', '1심 재판부는 해제 요구안 가결 뒤 윤 대통령이 이진우 수도방위사령관에게 전화해 “총을 쏴서라도 문을 부수고 들어가라”고 말했다고 판단했습니다. 이 전 사령관은 법정에서 ‘총’이라는 말은 기억했지만 이 문구 전체는 기억나지 않는다고 진술했습니다.', 'verdict', '794~796'],
    ['night', '01:13', 'assembly', '1심 재판부는 윤 대통령이 이진우 수도방위사령관에게 “결의안이 통과되었다고 하더라도 내가 두 번, 세 번 계엄하면 되니까 너네는 계속해라”라는 취지로 지시했다고 판단했습니다. 윤 전 대통령은 해당 지시를 부인했습니다.', 'verdict', '788, 796~799'],
    ['night', '01:16', 'jcs', '판결문은 윤 대통령이 합참 지하 결심지원실에서 김용현 장관·박안수 계엄사령관 등과 01:47쯤까지 논의했다고 기록합니다.', 'verdict', '101'],
    ['night', '01:45', 'assembly', '경찰은 국회 출입 차단을 풀고 일부 기동대를 철수시키기 시작했습니다. 판결문에는 이날 국회 출입 통제에 경찰 기동대 29개, 약 2,036명이 동원됐다고 적혀 있습니다.', 'verdict', '59~60'],
    ['night', '04:26', 'office', '윤 대통령이 계엄 해제 방침을 발표했습니다. 04:27~04:29 국무회의에서 참석자 13명 전원 합의로 해제안이 의결됐고, 04:32 국방부는 모든 병력이 복귀했다고 발표했습니다.', 'verdict', '101~102'],
  ].map(([phase, time, place, text, src, pages], i) => ({i, phase, time, place, text, src, pages}));
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
  const PHASE = { before: '그 전', night: '12월 3일 밤 → 4일 새벽' };
  const PHASE_W = { before: 24, night: 76 }; // 시간 막대에서 차지하는 너비(%)
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
    const start = e.phase === 'before' ? 0 : PHASE_W.before;
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
          <p class="nm-src" id="nmSrc"></p>
          <div class="nm-text" id="nmText"></div>
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
            ${EVENTS.map(e => `<button class="nm-track__dot${evX(e) < 8 ? ' is-start' : evX(e) > 92 ? ' is-end' : ''}" data-ev="${e.i}" style="left:${evX(e).toFixed(2)}%" aria-label="${esc(e.time)} · ${esc(P[e.place].name)}"><span>${esc(e.time)}</span></button>`).join('')}
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
    $('#nmDate').textContent = e.phase === 'night' ? (/^0[0-5]|해제/.test(e.time) ? '2024년 12월 4일 수요일 새벽' : '2024년 12월 3일 화요일 밤') : '계엄 이전';
    $('#nmPlace').textContent = place.name;
    $('#nmText').innerHTML = opts.place
      ? `<ol class="nm-list">${EVENTS.filter(v => v.place === opts.place).map(v => `
        <li><button class="${v.i === idx ? 'is-active' : ''}" data-ev="${v.i}">
          <time>${esc(v.time)}</time><span><small class="nm-list-source">${esc(sourceText(v))}</small>${esc(v.text)}</span>
        </button></li>`).join('')}</ol>`
      : `<p>${esc(e.text)}</p>`;
    const source = $('#nmSrc');
    source.hidden = !!opts.place;
    source.textContent = sourceText(e);
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
