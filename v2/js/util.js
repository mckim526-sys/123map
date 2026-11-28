// 공용 도우미
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
// 심급 이름은 모든 화면에서 같게: 1심 · 2심 · 대법원 (3심이라고 쓰지 않음)
const stageName = n => (+n === 3 ? '대법원' : n + '심');
// 아직 이르지 않은 심급(날짜 없음)의 '미확인·미도달·판단 전'은 화면에서 '진행 전' 하나로 (데이터는 그대로)
const NOT_YET = /^(미확인|미도달(\s*확인 당시)?|판단 전)$/;
const stageText = s => (!s || !s[0] ? '' : NOT_YET.test(s[0].trim()) && !/\d{4}\.\d{2}\.\d{2}/.test(s[2] || '') ? '진행 전' : s[0]);
// 심급 칸을 읽는 사람 기준의 말로 (데이터는 그대로). stages: 기록의 심급 3칸, i: 0~2
//  · 앞 심급 선고 전 → '1심 선고 후' / '2심 선고 후'
//  · 앞 심급 선고 뒤, 상소 여부 모름 → '항소 여부 확인 중' / '상고 여부 확인 중'
//  · 상고·항소 제기, 배당, 심리 중(선고 전) → '심리 중'
//  · '상고 없음 · 2심 확정' → '상고 없음'
//  재판부 칸의 내부 메모('후속 MBC 보도 확인 중', '대조 중', '미진행', '미확인' 등)는 숨김
const RULED = /징역|금고|벌금|무죄|유죄|공소기각|집행유예|선고유예|무기|사형|면소|기각|확정|형 면제/;
const ruled = t => RULED.test(t || '') && !/예정|선고 전|판단 전|미확인/.test(t || '');
function stageView(stages, i) {
  const s = stages[i] || ['', '', ''], t = String(s[0] || '').trim();
  const court = String(s[1] || '').split(/\s*·\s*/).filter(x => x && !/확인 중|대조 중|미진행|미확인|미도달/.test(x)).join(' · ');
  const dated = /\d{4}\.\d{2}\.\d{2}/.test(s[2] || '');
  const prev = i > 0 ? String((stages[i - 1] || [])[0] || '') : '';
  const appeal = i === 2 ? '상고' : '항소';
  let text = t;
  if (!t || (NOT_YET.test(t) && !dated)) {
    if (i === 0) text = '진행 전';
    else if (ruled(prev) && !/확정/.test(prev)) text = `${appeal} 여부 확인 중`;
    else if (/확정/.test(prev)) text = '진행 전';
    else text = `${stageName(i)} 선고 후`;
  } else if (/없음|포기|취하/.test(t) && !ruled(t.replace(/\S*\s*확정/, ''))) {
    text = (t.match(/^[^·]*?(없음|포기|취하)/) || [t])[0].trim();
    return { text, court: '', quiet: true }; // 열리지 않은 심급: 재판부·메모 줄 없음
  } else if (!ruled(t) && !/예정/.test(t + (s[2] || '')) && /상고|항소|배당|심리|선고 전|판단 전|미확인/.test(t)) {
    text = '심리 중';
  }
  return { text, court };
}
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ESC_MAP[c]);

const isMobile = () => matchMedia('(max-width:760px)').matches;
const canHover = () => matchMedia('(hover: hover)').matches;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// 인물 사진 또는 이름 자리표시
function portrait(person, cls = 'avatar') {
  if (person.photo) {
    const own = (APP_CONFIG.PHOTO_FILES || {})[person.id];
    const file = own || person.photoFile || person.id + '.jpg';
    return `<img class="${cls}" src="${esc(APP_CONFIG.ASSET_BASE + file)}" alt="${esc(person.name)}"
      style="object-position:${esc(own ? '50% 50%' : person.photoPosition || '50% 30%')}" loading="lazy">`;
  }
  return `<span class="${cls} ${cls}--empty" aria-label="사진 미확보">${esc(person.name)}<small>사진 준비 중</small></span>`;
}

// 원형 아바타: 사진이 있으면 사진, 없거나 불러오지 못하면 이름 글자 (작은 크기는 한 글자)
function avatar(person, cls = '') {
  const name = String(person.name || '');
  const given = name.length > 2 ? name.slice(-2) : name;
  const ini = /ava--sm/.test(cls) ? given.slice(0, 1) : given;
  const own = (APP_CONFIG.PHOTO_FILES || {})[person.id]; // 처음 화면과 같은 사진
  const img = person.photo
    ? `<img src="${esc(APP_CONFIG.ASSET_BASE + (own || person.photoFile || person.id + '.jpg'))}" alt="" loading="lazy" decoding="async"
        style="object-position:${esc(own ? '50% 50%' : person.photoPosition || '50% 25%')}" onerror="this.remove()">`
    : '';
  return `<span class="ava ${cls}" aria-hidden="true"><span class="ava__ini">${esc(ini)}</span>${img}</span>`;
}

// 서울 기준 오늘 날짜 (YYYY.MM.DD)
function todaySeoul() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date()).replaceAll('-', '.');
}

// 확정 단계의 형량을 한눈에: '상고 기각 · 원심 확정'처럼 형량이 없는 확정 문구면 바로 앞 심급의 형량을 가져와 '○○ 확정'으로
// 반환 { main: 보여 줄 판단, note: 원래 확정 문구(형량을 가져온 경우만) }
const SENTENCE = /징역|금고|벌금|무죄|공소기각|집행유예|선고유예|무기|사형|면소|자격정지|추징/;
function finalVerdict(stages, i) {
  const t = String((stages[i] || [])[0] || '');
  if (!/확정/.test(t) || SENTENCE.test(t)) return { main: t, note: '' };
  for (let j = i - 1; j >= 0; j--) {
    const prev = String((stages[j] || [])[0] || '');
    if (SENTENCE.test(prev) && !/예정|미확인/.test(prev)) return { main: `${prev} 확정`, note: t.replace(/\s*·\s*(원심|형)\s*확정$/, '') };
  }
  return { main: t, note: '' };
}
