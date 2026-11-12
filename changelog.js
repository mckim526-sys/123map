// Reader-facing record of what changed on the site. Add one plain-language line per published change
// (newest first). The "recently checked trials" list below it is built automatically from lastChecked.
const SITE_CHANGES = [
  ['2026-11-12', '첫 화면에 윤석열·김건희 사진과 사건 목록을 두고, 사건을 고르면 함께 재판받는 피고인별 진행 상황을 보여 주도록 했습니다.'],
  ['2026-11-12', '조태용 대법원 선고·김기현 부부 항소심 일정을 추가하고, 군검사 상고와 국정원 지휘부 공판준비 경과를 보완했습니다. 공개 기사 링크는 MBC 원문으로 정리했습니다.'],
  ['2026-11-12', '재판 상세에서 기소 내용을 사건 이름 바로 아래로 옮기고, 아래 혐의 카드에는 법원 판단만 남겼습니다.'],
  ['2026-11-12', '재판 상세와 연결 팝업에서 기소 내용을 색과 굵은 글씨로 구분해 법원 판단과 헷갈리지 않게 했습니다.'],
  ['2026-11-12', '법률 용어 풀이와 이 업데이트 기록을 추가했습니다.'],
  ['2026-11-12', '같은 재판 연결선을 누르면 그 재판 피고인 전원의 기소 내용과 최근 판단을 함께 보여 주도록 했습니다.'],
  ['2026-11-12', '윤석열 체포방해 재판과 경호처 4명 재판을 서로 다른 재판으로 분리했습니다.'],
  ['2026-11-12', '재판 묶음을 전수 점검했습니다. 한덕수·이상민 재판을 각각 별도 재판으로 바로잡고, 창원 공천·군검사 영장·정보사 명단 누설·IMS·통일교 정교유착 재판의 공동 피고인을 묶었습니다.'],
  ['2026-11-12', '윤석열 ‘한덕수 재판 위증’ 사건을 ‘법정 위증’으로 이름을 바꾸고, 윤석열 본인이 피고인인 별개 재판임을 밝혔습니다.'],
  ['2026-11-12', '11월 12일까지의 재판 진행 상황을 반영하고, 인물·재판별 고정 주소를 복원했습니다.'],
  ['2026-11-12', '관계도에서 같은 재판 피고인을 실선, 그 밖의 관계를 점선으로 구분하고, 재판 탭을 고르면 그 재판 인물만 강조하도록 했습니다.'],
  ['2026-11-12', '선고·확정·예정 일정을 날짜순으로 보는 타임라인을 추가했습니다.'],
  ['2026-11-12', '특검별 지도에서 다른 특검 사건이 연결선 이름으로 표시되던 오류를 고치고, 특검 발표 기소 인원과 아직 수록하지 못한 범위를 표시했습니다.'],
];
(function () {
  const dlg = document.getElementById('changelog');
  if (!dlg) return;
  const checked = persons.flatMap(p => p.records.filter(r => r.lastChecked).map(r => ({p, r})))
    .sort((a, b) => b.r.lastChecked.localeCompare(a.r.lastChecked) || a.p.name.localeCompare(b.p.name, 'ko')).slice(0, 15);
  dlg.querySelector('.changelog-body').innerHTML = `
    <h3>최근 확인한 재판 기록</h3>
    <p class="source-note">재판마다 마지막으로 원문 보도와 대조한 날짜입니다. 이름을 누르면 해당 재판으로 이동합니다.</p>
    <ul class="checked-list">${checked.map(({p, r}) => `<li><time>${esc(r.lastChecked)}</time><button data-changelog-person="${esc(p.id)}" data-changelog-case="${esc(r.id)}">${esc(p.name)}</button><span>${esc(r.label)} · ${esc(r.status || '')}</span></li>`).join('')}</ul>
    <h3>사이트 변경 기록</h3>
    <ul class="change-list">${SITE_CHANGES.map(([d, t]) => `<li><time>${esc(d)}</time><span>${esc(t)}</span></li>`).join('')}</ul>
    <p class="source-note">전체 수정 이력은 <a href="https://github.com/mckim526-sys/123map/commits/main" target="_blank" rel="noopener noreferrer">GitHub 저장소 기록 ↗</a>에서 볼 수 있습니다.</p>`;
  document.addEventListener('click', e => {
    if (e.target.closest('[data-open-changelog]')) { dlg.showModal(); return; }
    const b = e.target.closest('[data-changelog-person]');
    if (b) { dlg.close(); go(b.dataset.changelogPerson, b.dataset.changelogCase); }
  });
})();
