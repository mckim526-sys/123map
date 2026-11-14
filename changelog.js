// Reader-facing record of what changed on the site. Add one plain-language line per published change
// (newest first). The "recently checked trials" list below it is built automatically from lastChecked.
const SITE_CHANGES = [
  ['2026-11-14', '관계도에서 혼자 재판받는 사건 이름표를 그 사람 가까이에 두고 점선으로 이어, 누구의 사건인지 바로 보이게 했습니다. 내용이 긴 사건 설명은 화면 안에 들어오도록 옆에 띄웁니다.'],
  ['2026-11-14', '관계도에서 사건 이름표(내란 본류, 수사 외압 등)에 마우스를 올리면 어떤 사건인지, 왜 이 사람들이 함께 묶였는지, 특검이 기소한 혐의와 지금 단계를 말풍선으로 보여 줍니다.'],
  ['2026-11-14', '처음 화면에서 관계도로 넘어갈 때 버벅이던 문제를 줄였습니다. 관계도를 미리 불러 두고, 인물을 고르면 미리 그려 둡니다.'],
  ['2026-11-14', '윤석열·김건희 사진을 처음 화면과 같은 사진으로 관계도·재판 목록·상세에서도 보여 줍니다.'],
  ['2026-11-14', '처음 화면에서 사건을 누르면 인물 사진이 관계도의 그 사람 자리로 날아가며 관계도가 펼쳐지는 전환을 넣었습니다.'],
  ['2026-11-14', '처음 화면에서 사건을 누르면 곧바로 관계도와 그 재판 상세가 열리도록 한 단계를 줄였습니다. 피고인별 1심·2심·대법원 표는 관계도 상세에서 봅니다.'],
  ['2026-11-14', '처음 화면이나 공유받은 주소에서 인물·재판 링크를 누르면, 직전에 보던 화면과 상관없이 늘 관계도에서 재판 상세가 열리도록 했습니다.'],
  ['2026-11-14', '처음 화면을 새로 다듬었습니다. 대표 주소로 들어와도 처음 화면이 열리고, 머리글에 사이트 이름을 늘 보여 줍니다. 심급 이름은 모든 화면에서 1심·2심·대법원으로, 아직 이르지 않은 심급은 "진행 전"으로 통일했습니다. 달력은 칸에 이름만 두고 결과는 아래 목록에서 보도록 바꿨습니다.'],
  ['2026-11-13', '윤석열·신원식의 계엄 정당화 사건 첫 공판과 한덕수 조건부 보석 의견서 제출을 반영했습니다. 공판 중 주장·의견서 제출은 판결이나 보석 결정과 구분했습니다.'],
  ['2026-11-13', '타임라인을 달력으로도 볼 수 있게 했습니다. 일정이 있는 달로 바로 이동하고, 날짜를 누르면 그날의 선고를 모아 봅니다.'],
  ['2026-11-13', '같은 재판 연결 창을 이름·받은 형·지금 단계(확정, 2심 선고일 등)만 보이는 짧은 표로 바꿨습니다.'],
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
