// 관련 보도 모아보기 대화상자
const Dialogs = {
  init() {
    $('#coverage').innerHTML = Model.agencies.map(a => {
      const t = Model.AGENCY_TOTALS[a];
      const n = Model.people.filter(p => p.agencies.includes(a)).length;
      return `<div><b>${n}</b><span>${esc(a)}</span>${t ? `<small>특검 발표 기소 ${t[0]}명${t[1] ? ' · ' + esc(t[1]) : ''}</small>` : ''}</div>`;
    }).join('');
    // 보도 목록: 제목 앞의 날짜("2026-11-11 · …")를 떼어 최신순으로 (날짜 없는 보도는 맨 뒤)
    const items = Model.sources.map(([title, url]) => {
      const m = String(title).match(/^(\d{4})-(\d{2})-(\d{2})\s*·\s*/);
      return { date: m ? `${m[1]}.${m[2]}.${m[3]}` : '', title: m ? title.slice(m[0].length) : title, url };
    }).sort((a, b) => (b.date || '0').localeCompare(a.date || '0'));
    $('#sourceLinks').innerHTML = items.map(s => `
      <a href="${esc(s.url)}" target="_blank" rel="noopener">
        <time>${esc(s.date || '날짜 미상')}</time><span>${esc(s.title)} ↗</span>
      </a>`).join('');
    $('#sourcesBtn').addEventListener('click', () => $('#sourcesDialog').showModal());
    $$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
    // 바깥(배경) 클릭으로 닫기
    $$('dialog.modal').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
  },
};
