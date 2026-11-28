const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('timeline distinguishes mixed outcomes from acquittals and other proceedings', () => {
  const pane = { addEventListener() {}, classList: { toggle() {} } };
  const context = {
    $: selector => selector === '#timelinePane' ? pane : null,
    isMobile: () => false,
    innerHeight: 1000, // 데스크톱 기본 높이(칸마다 일정 3개까지)
    todaySeoul: () => '2026.11.15',
    dropMemo: value => value,
    esc: value => value,
    avatar: () => '',
  };
  const timeline = fs.readFileSync(path.join(__dirname, '../v2/js/views/timeline.js'), 'utf8');
  vm.runInNewContext(`${timeline}\nthis.view = TimelineView;`, context);

  const outcomes = [
    ['그림 제공 무죄 / 정치자금 징역 6개월·집행유예 1년', 'mixed', '일부 유죄'],
    ['벌금 1천만 원 / 나머지 무죄', 'mixed', '일부 유죄'],
    ['징역 6개월 / 일부 공소기각', 'mixed', '일부 유죄'],
    ['무죄·공소기각', 'acquit', '공소기각'],
    ['무죄', 'acquit', '무죄'],
    ['공소기각 파기·환송', 'remand', '파기환송'],
    ['징역 7년 확정', 'final', '확정'],
    ['유죄 여부 미확인 · 항소 제기', 'other', '절차'],
    ['선고 예정', 'upcoming'],
  ];
  const records = outcomes.map(([text], index) => ({
    id: String(index),
    stages: [[text, '법원', `2026.11.${String(index + 1).padStart(2, '0')}`]],
  }));
  context.view.render([{ id: 'defendant', name: '피고인', records }], 'all');

  for (const [text, kind, label] of outcomes) {
    assert.ok(pane.innerHTML.includes(`cal-ev--${kind}`), text);
    const badge = label ? `<span class="kind kind--${kind}">${label}</span>` : '';
    assert.ok(pane.innerHTML.includes(`<p class="tl-item__result">${badge}${text}</p>`), text);
  }
});
