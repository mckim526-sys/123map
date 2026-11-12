const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const {personRoute} = require('../routing.js');
const data = {};
vm.runInNewContext(fs.readFileSync(path.join(root,'reader-data.js'),'utf8')+';this.people=persons;',data);

test('every current person/case permalink resolves to that exact record', () => {
  for (const p of data.people) for (const r of p.records) {
    assert.deepEqual(personRoute('#person/'+p.id+'/'+r.id,data.people),{id:p.id,caseId:r.id});
  }
});
test('malformed or missing defendants never fall back to a different person', () => {
  for (const hash of ['', '#person/missing', '#person/%ZZ', '#wrong/yoon', '#person/yoon/yoon-main/extra']) {
    assert.equal(personRoute(hash,data.people),null);
  }
});
test('a removed case link still opens the requested person', () => {
  assert.deepEqual(personRoute('#person/yoon/removed',data.people),{id:'yoon',caseId:'yoon-main'});
});
test('a completed hearing today is history while an explicitly scheduled hearing remains upcoming', () => {
  const RealDate=Date;
  class Clock extends RealDate { constructor(...args){super(...(args.length?args:['2026-11-11T16:00:00Z']));} }
  const ctx={Date:Clock,Intl,filter:'all',document:{addEventListener(){}}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'timeline.js'),'utf8')+';this.events=timelineEvents;',ctx);
  const people=[{id:'test',records:[
    {id:'held',stages:[['공판 시작 · 선고 전','법원','2026.11.12']]},
    {id:'planned',stages:[['선고 예정','법원','2026.11.12 예정']]},
    {id:'future',stages:[['첫 공판','법원','2026.11.13']]}
  ]}];
  const events=ctx.events(people);
  assert.equal(events.find(e=>e.caseId==='held').upcoming,false);
  assert.equal(events.find(e=>e.caseId==='planned').upcoming,true);
  assert.equal(events.find(e=>e.caseId==='future').upcoming,true);
});
test('ending at appeal and ending at the Supreme Court stay distinct in progress', () => {
  const ctx={};
  vm.runInNewContext(fs.readFileSync(path.join(root,'trial-progress.js'),'utf8')+';this.progress=trialProgress;',ctx);
  for(const stage of [2,3]) assert.equal(ctx.progress({progress:{stage,phase:'final',label:'확정'}}).stage,stage);
});
