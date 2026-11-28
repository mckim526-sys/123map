// 매일 밤 자동 점검(AI 없음) — GitHub Actions(.github/workflows/daily-check.yml)가 실행합니다.
// 평일 22시 정기 갱신이 끝난 뒤(23:30) 돌려서, 아직 반영되지 않은 재판을 이슈 본문(마크다운)으로 정리합니다.
//   node scripts/daily-check.js [--tests-failed] [--date YYYY-MM-DD]   → 표준 출력: 이슈 본문. 확인할 것이 없으면 빈 출력
const { execFileSync } = require('child_process');
const path = require('path');
const di = process.argv.indexOf('--date'); // 시험용: --date YYYY-MM-DD
const out = JSON.parse(execFileSync('node', [path.join(__dirname, 'agenda.js'), '--json', '--evening', ...(di > 0 ? ['--date', process.argv[di + 1]] : [])], { encoding: 'utf8' }));
const testsFailed = process.argv.includes('--tests-failed');

const line = x => `- ${x.date} · **${x.stage} ${x.text}** · ${x.label} (${x.agency}) — ${x.caseOnly ? '사건 기일 · 출석 대상 미확인' : x.people.map(v => v.name).join('·')}${x.court ? ` · ${x.court}` : ''}`;
const parts = [];
if (testsFailed) parts.push('### ⚠️ 회귀 검사 실패\n`node --test tests/navigation.test.cjs tests/public-sources.test.cjs`가 실패했습니다. 데이터 파일이 깨졌거나 MBC 외 주소가 들어갔을 수 있습니다. Actions 실행 기록을 확인하세요.');
if (out.overdue.length) parts.push(`### 지난 일정이 아직 '예정'으로 남음 (${out.overdue.length}건)\n사이트에는 '결과 확인 중'으로 표시되고 있습니다. 결과(또는 연기)를 반영해야 합니다.\n${out.overdue.map(line).join('\n')}`);
if (out.check.length) parts.push(`### 오늘·어제·그저께 예정이던 재판 — 결과 미반영 (${out.check.length}건)\n밤 갱신 때 보도가 아직 없었을 수 있습니다. 다음 갱신에서 확인할 대상입니다.\n${out.check.map(line).join('\n')}`);
if (out.appeal.length) parts.push(`### 선고 후 7~14일 — 항소·상고 여부 미반영 (${out.appeal.length}건)\n${out.appeal.map(line).join('\n')}`);
if (!parts.length) process.exit(0);
console.log(`${out.date} 23:30 자동 점검 (AI 없이 reader-data.js의 일정만 확인)\n\n${parts.join('\n\n')}\n\n---\n다가오는 일정 ${out.upcoming.length}건 · 목록 기준은 \`scripts/agenda.js\` · 모두 반영되면 이 이슈는 자동으로 닫힙니다.`);
