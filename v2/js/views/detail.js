// 재판 상세 (오른쪽 패널 / 모바일 시트 / 나란히 비교 대화상자)
// 흐름: 인물 → 사건 선택 → 사건 요약(상태 + 심급별 결과 타임라인) → 혐의별 판단(접기) → 연결된 인물 → 관련 보도
const DetailView = (() => {
  const panel = $('#detail');

  const section = (title, aside = '', id = '') =>
    `<h3 class="section-title"${id ? ` data-sec="${id}"` : ''}>${title}${aside ? `<small>${aside}</small>` : ''}</h3>`;

  // 판단이 실제로 나온 마지막 심급 ("항소심 판단 전", "판단 미확인" 등은 제외)
  const PENDING = /판단 전|미확인|확인 중|대조 중|해당 없음|미도달|없음|취하|^\s*[-–]?\s*$/; // 판단이 아니거나 열리지 않은 심급
  function latestRuling(judgments) {
    for (let i = judgments.length - 1; i >= 0; i--) {
      if (!PENDING.test(judgments[i] || '')) return { stage: i + 1, text: String(judgments[i]).split(/\s+[—–-]\s+/)[0] };
    }
    return null;
  }
  const rulingKind = t => /무죄|공소기각|면소/.test(t) ? 'acquit' : /유죄|징역|벌금/.test(t) ? 'guilty' : 'other';

  function relatedPeople(person, agency) {
    return Model.people
      .filter(v => v.id !== person.id && Model.linkLabel(person, v, agency))
      .sort((x, y) => Model.triedTogether(person, y, agency) - Model.triedTogether(person, x, agency));
  }

  // 심급별 결과: 진행 단계(완료·현재·확정·예정)를 결과 목록에 함께 표시
  // 열리지 않은 심급: 앞 심급에서 확정됐거나, 취하·없음·미도달로 적힌 경우
  // ("미도달"은 아직 그 심급에 이르지 않았다는 뜻이라 열리지 않은 것으로 보지 않음 → 진행 전 점선)
  const NOT_HELD = /취하|없음|해당 없음|불필요/;

  // 심급의 날짜 칸에는 "2026.09.11 / 2025고합1602"처럼 사건번호가 섞여 올 때가 있음 → 날짜와 나머지로 나눔
  function splitWhen(raw) {
    const text = String(raw || '').trim();
    const ymd = (text.match(/\d{4}\.\d{2}\.\d{2}/) || [''])[0];
    const planned = /예정/.test(text);
    const rest = text.replace(ymd, '').replace(/예정/, '').replace(/^[\s\/·,]+|[\s\/·,]+$/g, '').trim();
    return { date: ymd ? ymd + (planned ? ' 예정' : '') : '', extra: rest };
  }

  function verdictTimeline(record) {
    const prog = Progress.of(record);
    const rows = [0, 1, 2].map(i => {
      const s = record.stages[i] || ['', '', ''];
      const n = i + 1;
      let state = prog.stage === null ? 'unknown' : n < prog.stage ? 'done' : n === prog.stage ? (prog.phase === 'final' ? 'final' : 'current') : 'todo';
      if ((prog.phase === 'final' && n > prog.stage) || (state !== 'final' && state !== 'current' && NOT_HELD.test(s[0] || ''))) state = 'skip';
      return { s, n, state };
    });
    // 이음선: 다음 심급이 실제로 열렸을 때만 (열린 심급 → 실선, 아직 진행 전 → 점선, 열리지 않음 → 끊김)
    const items = rows.map(({ s, n, state }, i) => {
      const next = rows[i + 1];
      const link = !next || next.state === 'skip' ? '' : ['done', 'current', 'final'].includes(next.state) ? 'link-on' : 'link-pending';
      const tag = { current: '현재', final: '확정' }[state];
      const when = splitWhen(s[2]);
      const court = [s[1], when.extra].filter(Boolean).join(' · '); // 사건번호는 재판부 줄 끝으로
      return `
        <li class="verdict__item is-${state} ${link}"${n === prog.stage ? ' aria-current="step"' : ''}>
          <span class="verdict__mark" aria-hidden="true">${state === 'done' ? '✓' : n}</span>
          <div class="verdict__text">
            <p class="verdict__stage">${n}심${when.date ? ` <time>${esc(when.date)}</time>` : ''}${tag ? `<span class="verdict__tag">${tag}</span>` : ''}</p>
            <b class="verdict__result">${esc(s[0] || '기록 없음')}</b>
            ${court ? `<span class="verdict__court">${esc(court)}</span>` : ''}
          </div>
        </li>`;
    }).join('');
    return `<ol class="verdict" aria-label="심급별 결과 · ${esc(prog.label)}">${items}</ol>`;
  }

  function chargeList(record) {
    return record.charges.map((c, k) => {
      const last = latestRuling(c.judgments);
      return `
      <details class="charge"${k === 0 ? ' open' : ''}>
        <summary class="charge__head">
          <span class="charge__name">${esc(c.name)}</span>
          <span class="charge__latest charge__latest--${last ? rulingKind(last.text) : 'none'}">${last ? `${last.stage}심 ${esc(last.text)}` : '판단 전'}</span>
        </summary>
        <div class="charge__body">
          <div class="charge__act"><span class="field-label">기소 내용</span><p>${esc(c.act)}</p></div>
          <dl class="charge__rulings">${c.judgments.map((j, i) => `<div class="ruling"><dt>${i + 1}심</dt><dd>${esc(j)}</dd></div>`).join('')}</dl>
        </div>
      </details>`;
    }).join('');
  }

  function newsCards(record) {
    return (record.news || []).map(n => `
      <a class="news-card" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer">
        <span class="news-card__meta">${esc(n.publisher || 'MBC')} · ${esc(n.date)}</span>
        <b class="news-card__title">${esc(n.title)}</b>
        <span class="news-card__cta">기사 원문 보기 ↗</span>
      </a>`).join('');
  }

  const profile = (person, record) => `
    <header class="profile">
      ${portrait(person)}
      <div>
        <h2 class="profile__name">${esc(person.name)}</h2>
        <p class="profile__role">${esc(person.role)}</p>
        <p class="profile__agencies">${person.agencies.map(esc).join(' · ')}</p>
      </div>
    </header>`;

  // 오른쪽 패널 본문
  function markup(person, record, agency) {
    const related = relatedPeople(person, agency);
    const news = record.news || [];

    const byAgency = Model.agencies.map(a => [a, person.records.filter(r => r.agency === a)])
      .concat([['기타', person.records.filter(r => !Model.agencies.includes(r.agency))]])
      .filter(([, rs]) => rs.length);
    const tabs = person.records.length < 2 ? '' : `
      <section class="case-picker" aria-label="사건 선택">
        <p class="field-label">사건 ${person.records.length}건</p>
        ${byAgency.map(([a, rs]) => `
          <div class="case-group">
            <span class="case-group__label">${esc(a)}</span>
            <div class="case-tabs" role="tablist" aria-label="${esc(a)} 사건">${rs.map(r =>
              `<button role="tab" aria-selected="${r.id === record.id}" data-case="${esc(r.id)}" class="${r.id === record.id ? 'is-active' : ''}">${esc(r.label)}</button>`).join('')}</div>
          </div>`).join('')}
      </section>`;

    const people = related.map(v => {
      const co = Model.triedTogether(person, v, agency);
      return `<button class="person-chip ${co ? 'is-co' : ''}" data-id="${esc(v.id)}" data-related-to="${esc(person.id)}" aria-haspopup="dialog">
        ${avatar(v, 'ava--sm')}<b>${esc(v.name)}</b><span>${co ? '함께 기소 · ' : ''}${esc(Model.linkLabel(person, v, agency))}</span></button>`;
    }).join('');

    return `
      ${profile(person, record)}
      ${tabs}
      <section class="case-card" data-sec="verdict">
        <p class="eyebrow">${esc(record.agency)}</p>
        <h3 class="case-card__title">${esc(record.title)}</h3>
        <div class="case-card__meta">
          <span class="badge">${esc(record.status)}</span>
          ${record.lastChecked ? `<span class="caption">정보 확인 ${esc(record.lastChecked)}</span>` : ''}
        </div>
        ${verdictTimeline(record)}
        <button class="btn btn--secondary btn--block" data-compare>혐의별 1·2·3심 판단 나란히 보기</button>
      </section>
      ${section('혐의별 판단', `${record.charges.length}건 · 눌러서 펼치기`, 'charges')}
      <div class="stack">${chargeList(record)}</div>
      ${record.note ? `<p class="callout">${esc(record.note)}</p>` : ''}
      ${people ? section('연결된 인물', `${related.length}명 · 누르면 관계 설명`, 'people') + `<div class="person-chips">${people}</div>` : ''}
      ${section('관련 보도', `${news.length}건`, 'news')}
      ${news.length ? `<div class="stack">${newsCards(record)}</div>` : '<p class="caption">연결할 보도를 확인하고 있습니다.</p>'}
      <div class="detail__fineprint">
        <p class="caption">‘미확인’은 무죄나 재판 미진행을 뜻하지 않습니다. 사건별 확인 시점이 다르며, 형량을 다른 사건과 합산하지 않습니다.</p>
        ${person.photoSource ? `<p class="caption photo-credit">사진: <a href="${esc(person.photoSource)}" target="_blank" rel="noopener noreferrer">MBC 보도 사진</a></p>` : ''}
      </div>`;
  }

  // 패널 안 이동 메뉴
  function nav(person, record, agency) {
    const links = [
      ['verdict', '판결'],
      ['charges', `혐의 ${record.charges.length}`],
      ['people', `연결 인물 ${relatedPeople(person, agency).length}`],
      ['news', `보도 ${(record.news || []).length}`],
    ].filter(([id]) => id !== 'people' || relatedPeople(person, agency).length);
    return `<nav class="detail__nav" aria-label="상세 내용 바로가기">${links.map(([id, t]) => `<button data-jump="${id}">${t}</button>`).join('')}</nav>`;
  }

  function show(person, record, agency) {
    panel.innerHTML = `
      <div class="detail__bar">
        <button class="sheet-handle" data-sheet-toggle aria-label="상세 크게 보기 / 작게 보기"><i></i></button>
        <div class="detail__bar-row">
          <span class="detail__bar-title">재판 기록 · ${esc(person.name)}</span>
          <button class="icon-btn" data-close-detail aria-label="재판 상세 닫기">×</button>
        </div>
        ${nav(person, record, agency)}
      </div>
      <div class="detail__body">${markup(person, record, agency)}</div>`;
    panel.scrollTop = 0;
  }

  panel.addEventListener('click', e => {
    const b = e.target.closest('[data-jump]');
    if (!b) return;
    const target = panel.querySelector(`[data-sec="${b.dataset.jump}"]`);
    const bar = panel.querySelector('.detail__bar');
    if (target) panel.scrollTo({ top: target.offsetTop - bar.offsetHeight - 12, behavior: reducedMotion() ? 'auto' : 'smooth' });
  });

  // 나란히 비교: 혐의(행) × 심급(열) 표
  function compare(person, record) {
    const stages = [0, 1, 2].map(i => record.stages[i] || ['', '', '']);
    const head = stages.map((s, i) => { const w = splitWhen(s[2]); return `<th scope="col"><span>${i + 1}심${w.date ? ` · ${esc(w.date)}` : ''}</span><b>${esc(s[0] || '기록 없음')}</b></th>`; }).join('');
    const rows = record.charges.map(c => `
      <tr>
        <th scope="row"><b>${esc(c.name)}</b><span>${esc(c.act)}</span></th>
        ${[0, 1, 2].map(i => {
          const j = c.judgments[i] || '';
          const pending = PENDING.test(j);
          return `<td class="${pending ? 'is-pending' : 'is-' + rulingKind(j)}">${esc(j || '—')}</td>`;
        }).join('')}
      </tr>`).join('');
    $('#compareEyebrow').textContent = `${person.name} · ${record.agency} · 혐의별 1·2·3심 판단`;
    $('#compareTitle').textContent = record.title;
    $('#compareBody').innerHTML = `
      <div class="compare-wrap">
        <table class="compare">
          <thead><tr><th scope="col">혐의</th>${head}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${record.note ? `<p class="callout">${esc(record.note)}</p>` : ''}`;
    $('#compareDialog').showModal();
  }

  return { show, compare, markup };
})();
