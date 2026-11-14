// 공용 도우미
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
// 심급 이름은 모든 화면에서 같게: 1심 · 2심 · 대법원 (3심이라고 쓰지 않음)
const stageName = n => (+n === 3 ? '대법원' : n + '심');
// 아직 이르지 않은 심급(날짜 없음)의 '미확인·미도달·판단 전'은 화면에서 '진행 전' 하나로 (데이터는 그대로)
const NOT_YET = /^(미확인|미도달(\s*확인 당시)?|판단 전)$/;
const stageText = s => (!s || !s[0] ? '' : NOT_YET.test(s[0].trim()) && !/\d{4}\.\d{2}\.\d{2}/.test(s[2] || '') ? '진행 전' : s[0]);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ESC_MAP[c]);

const isMobile = () => matchMedia('(max-width:760px)').matches;
const canHover = () => matchMedia('(hover: hover)').matches;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// 인물 사진 또는 이름 자리표시
function portrait(person, cls = 'avatar') {
  if (person.photo) {
    const file = person.photoFile || person.id + '.jpg';
    return `<img class="${cls}" src="${esc(APP_CONFIG.ASSET_BASE + file)}" alt="${esc(person.name)}"
      style="object-position:${esc(person.photoPosition || '50% 30%')}" loading="lazy">`;
  }
  return `<span class="${cls} ${cls}--empty" aria-label="사진 미확보">${esc(person.name)}<small>사진 준비 중</small></span>`;
}

// 원형 아바타: 사진이 있으면 사진, 없거나 불러오지 못하면 이름 글자 (작은 크기는 한 글자)
function avatar(person, cls = '') {
  const name = String(person.name || '');
  const given = name.length > 2 ? name.slice(-2) : name;
  const ini = /ava--sm/.test(cls) ? given.slice(0, 1) : given;
  const img = person.photo
    ? `<img src="${esc(APP_CONFIG.ASSET_BASE + (person.photoFile || person.id + '.jpg'))}" alt="" loading="lazy" decoding="async"
        style="object-position:${esc(person.photoPosition || '50% 25%')}" onerror="this.remove()">`
    : '';
  return `<span class="ava ${cls}" aria-hidden="true"><span class="ava__ini">${esc(ini)}</span>${img}</span>`;
}

// 서울 기준 오늘 날짜 (YYYY.MM.DD)
function todaySeoul() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date()).replaceAll('-', '.');
}
