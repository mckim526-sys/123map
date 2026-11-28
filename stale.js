// 날짜가 지난 '예정' 일정을 화면에서만 '결과 확인 중'으로 바꿔 보여 줌 (reader-data.js 파일은 그대로).
// 정기 갱신(평일 22시)이 늦거나 빠져도 이미 지난 선고·공판이 '예정'으로 보이지 않게 하는 안전장치.
//  · 기준: 한국 시간 오늘. 오늘 날짜의 '예정'은 그대로 두고(그날 밤 갱신 전), 어제 이전 것만 바꿈
//  · '선고 예정' → '선고 결과 확인 중', 그 밖의 '…예정' → '결과 확인 중' · 날짜 칸의 '예정' 글자는 뗌
//  · 데이터 원본 값은 s.scheduled에 남김 (필요하면 화면에서 참고)
// clock.html은 reader-data.js 바로 뒤에, v2는 loader.js가 데이터 다음에 불러옴.
(function () {
  if (typeof persons === 'undefined') return;
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '.');
  persons.forEach(p => p.records.forEach(r => [...(r.stages || []), ...(r.next || [])].forEach(s => {
    const d = (String(s[2] || '').match(/\d{4}\.\d{2}\.\d{2}/) || [])[0];
    if (!d || d >= today || !/예정/.test(String(s[0] || '') + String(s[2] || ''))) return;
    s.scheduled = [s[0], s[2]];
    s[0] = /선고/.test(s[0] || '') ? '선고 결과 확인 중' : '결과 확인 중';
    s[2] = String(s[2]).replace(/\s*예정/g, '').trim();
  })));
})();
