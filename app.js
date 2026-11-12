function newsHtml(p,c){const items=c.news||[];return '<section class="mbc-news"><h3>MBC 관련 보도 <small>'+items.length+'건</small></h3>'+(items.length?items.map(n=>'<a class="news-card" href="'+esc(n.url)+'" target="_blank" rel="noopener noreferrer"><span>MBC NEWS · '+esc(n.date)+'</span><b>'+esc(n.title)+'</b><small>기사 원문 보기 ↗</small></a>').join(''):'<p class="news-empty">연결할 MBC 보도를 확인하고 있습니다.</p>')+'</section>'}
let detailOpen=false;
let detailReturnY=null;
let lockedScroll=null;
function lockMobilePage(){if(matchMedia('(max-width:760px)').matches&&lockedScroll===null){lockedScroll=window.scrollY;document.body.style.top=`-${lockedScroll}px`;document.body.classList.add('mobile-locked')}}
function unlockMobilePage(){if(lockedScroll!==null){const y=lockedScroll;lockedScroll=null;document.body.classList.remove('mobile-locked');document.body.style.top='';window.scrollTo(0,y)}}
let filter='all',selected='yoon',caseId='',page=0,mode='map';
const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function img(p,cls=''){return p.photo?`<img class="${cls}" src="assets/${esc(p.photoFile||p.id+'.jpg')}" alt="${esc(p.name)}" style="object-position:${esc(p.photoPosition||'50% 30%')}" loading="lazy">`:`<span class="${cls||'initial'}" aria-label="사진 미확보">${esc(p.name)}<small>사진 준비 중</small></span>`}
function link(s){return `<a href="${esc(s[1])}" target="_blank" rel="noopener">${esc(s[0])} ↗</a>`}
function lookup(id){return persons.find(p=>p.id===id)||persons[0]}
function match(){const q=$('#search').value.trim();return persons.filter(p=>(filter==='all'||p.agencies.includes(filter))&&(!q||[p.name,p.role,...p.records.map(c=>c.title)].join(' ').includes(q)))}
// In an agency view, only that agency's cases may explain a line. relations[3] (optional) scopes a manual relation to one agency.
function connection(a,b,agency=filter){const scope=agency&&agency!=='all'?agency:null;const inScope=c=>!scope||c.agency===scope;const ra=a.records.filter(inScope),rb=b.records.filter(inScope);const explicit=relations.find(r=>((r[0]===a.name&&r[1]===b.name)||(r[1]===a.name&&r[0]===b.name))&&(!scope||!r[3]||r[3]===scope));if(explicit)return explicit[2];const shared=ra.find(c=>(c.members||[]).includes(b.id))||rb.find(c=>(c.members||[]).includes(a.id));if(shared)return shared.label;const family=ra.find(c=>c.family&&rb.some(d=>d.family===c.family));if(family)return family.label;if((!scope||scope==='내란특검')&&['yoon','kim'].includes(a.id)&&['kim','noh','gun','cho','bong','mok','seung'].includes(b.id))return '내란 본류';return null}
// Announced totals at each special counsel's final briefing; the site lists only defendants named in reporting.
const AGENCY_TOTALS={'내란특검':[27,'출범 전 검찰·군검찰 기소 인물 포함 수록'],'김건희 특검':[76,'실명 미공개 피고인·양평고속도로 사건 등 미수록'],'해병대 특검':[33,'단체대화방 위증 기소 2명 미수록'],'종합특검':[58,'법인 포함 발표 인원']};
function agencyRoot(){return filter==='김건희 특검'?'keon':filter==='해병대 특검'?'park-jh':'yoon'}
function draw(){
if(typeof closeRelationPopup==='function')closeRelationPopup();
const list=match();$('#resultCount').textContent=`${list.length}명`;const center=lookup(selected);
const anchors=filter==='해병대 특검'?[['park-jh',45,48],['yoon',20,28],['p102',25,66],['p115',70,28],['p120',76,66]]:[['yoon',46,42],['kim',26,23],['noh',23,56],['keon',67,39],['myung',82,20],['park-jh',49,79]];
const positions=[];const included=new Set();let agencyEdges=null;const rootId=agencyRoot();
function add(p,x,y,major=false){if(!p||included.has(p.id))return;included.add(p.id);positions.push({p,x,y,major})}
if(filter!=='all'||$('#search').value.trim()){
const layout=agencyMapLayout(list,rootId,connection);
layout.positions.forEach(v=>{included.add(v.p.id);positions.push(v)});agencyEdges=layout.edges;
}else if(!$('#search').value.trim()){
anchors.forEach(([id,x,y])=>add(persons.find(p=>p.id===id),x,y,true));
const chiefs=positions.slice();
const occupied=new Set(chiefs.map(v=>v.p.id));
chiefs.forEach((a,k)=>{let candidates=list.filter(p=>!occupied.has(p.id)&&connection(a.p,p));
if(k===0)candidates=candidates.filter(p=>!chiefs.slice(1).some(b=>connection(b.p,p)));
candidates.slice(0,k===0?14:8).forEach((p,i,arr)=>{occupied.add(p.id);const angle=2*Math.PI*i/arr.length;add(p,a.x+(k===0?16:11)*Math.cos(angle),a.y+(k===0?29:18)*Math.sin(angle))})});
}else{const pool=list;pool.forEach((p,i)=>{const a=i*2.39996,rad=7+Math.sqrt(i)*6;add(p,50+rad*Math.cos(a),48+rad*Math.sin(a),i===0)})}
if(detailOpen){const related=list.filter(p=>p.id!==selected&&connection(center,p));add(center,46,47,true);related.filter(p=>!included.has(p.id)).forEach((p,i,arr)=>{let a=2*Math.PI*i/arr.length;add(p,50+42*Math.cos(a),48+40*Math.sin(a))});}
const selectedLinks=positions.filter(v=>v.p.id!==selected&&connection(center,v.p));
$('#nodes').innerHTML=positions.map(({p,x,y,major})=>`<button class="node ${p.id===selected?'selected':''} ${p.id===rootId?'center':''} ${major?'major':'satellite'} ${detailOpen&&p.id!==selected&&!connection(center,p)?'muted-node':''}" data-id="${p.id}" style="left:${x}%;top:${y}%" aria-label="${esc(p.name)} 재판 보기">${img(p,'portrait')}<span class="dot"></span><strong>${esc(p.name)}</strong><small>${esc(p.role)}<br>${esc(p.records[0]?.status||'기록 확인 중')}</small></button>`).join('');
// Measure actual rendered name boxes so font size, viewport and detail width all count.
const graphRect=$('.graph').getBoundingClientRect();
if(graphRect.width&&graphRect.height){
const elements=[...$('#nodes').children];
const boxes=elements.map((el,i)=>{
const v=positions[i],ax=graphRect.left+v.x*graphRect.width/100,ay=graphRect.top+v.y*graphRect.height/100;
const label=el.querySelector('strong').getBoundingClientRect(),dot=el.querySelector('.dot').getBoundingClientRect();
return {left:Math.min(label.left,dot.left)-ax,right:Math.max(label.right,dot.right)-ax,top:Math.min(label.top,dot.top)-ay,bottom:Math.max(label.bottom,dot.bottom)-ay};
});
separateMapLabels(positions,rootId,graphRect.width,graphRect.height,boxes);
elements.forEach((el,i)=>{el.style.left=positions[i].x+'%';el.style.top=positions[i].y+'%'});
}
// Overview uses one nearest hub per satellite; selection reveals every direct relation.
const edgePairs=[];
if(detailOpen){const a=positions.find(v=>v.p.id===selected);if(a)positions.forEach(b=>{if(b!==a&&connection(a.p,b.p))edgePairs.push([a,b])});}
else if(agencyEdges){edgePairs.push(...agencyEdges)}
else{
 const hubs=positions.filter(v=>v.major);
 hubs.forEach((b,i)=>{const a=hubs.slice(0,i).filter(a=>connection(a.p,b.p)).sort((a,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(c.x-b.x,c.y-b.y))[0];if(a)edgePairs.push([a,b]);});
 positions.filter(v=>!v.major).forEach(b=>{const a=hubs.filter(a=>connection(a.p,b.p)).sort((a,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(c.x-b.x,c.y-b.y))[0];if(a)edgePairs.push([a,b]);});
}
const edges=edgePairs.map(([a,b])=>{const label=connection(a.p,b.p),x1=a.x*9,y1=a.y*6.2,x2=b.x*9,y2=b.y*6.2,dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1,bend=Math.min(24,len*.08),cx=(x1+x2)/2-dy/len*bend,cy=(y1+y2)/2+dx/len*bend;return `<g class="edge ${detailOpen?'active-edge':''}" tabindex="0" role="button" aria-label="${esc(a.p.name+' · '+b.p.name+' : '+label)}" data-relation="${esc(a.p.name+' · '+b.p.name+' — '+label)}" data-from="${esc(a.p.id)}" data-to="${esc(b.p.id)}"><path class="edge-hit" d="M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}"/><path class="edge-stroke" d="M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}"/><title>${esc(label)}</title></g>`});
$('#edges').innerHTML=edges.join('');$('#mapContext').textContent=detailOpen?`${center.name}의 연결 · ${selectedLinks.length}명 표시`:(filter==='all'?'주요 연결만 표시 · 인물을 선택하면 직접 연결 전체 보기':filter+' · 수록 인물 전체 표시');
$('#pageLabel').textContent=`${positions.length}명 표시`;$('#prevPage').hidden=true;$('#nextPage').hidden=true;
$('#list').innerHTML=list.length?list.map(p=>`<button data-id="${p.id}"><b>${esc(p.name)}</b><span>${esc(p.agencies.join(' · '))}<small>${esc([...new Set(p.records.map(c=>c.label))].join(' / '))}</small></span><span>재판 보기 ↗</span></button>`).join(''):'<p class="empty">검색 결과가 없습니다.</p>';
$('#searchResults').innerHTML=$('#search').value.trim()?list.map(p=>`<button data-id="${p.id}">${esc(p.name)}</button>`).join(''):'';
if(typeof renderTimeline==='function')renderTimeline();
}
function body(p,c,wide=false){const related=persons.filter(v=>v.id!==p.id&&connection(p,v));return `<p class="eyebrow">${esc(c.agency)} / 재판 기록</p><div class="detail-top">${img(p)}<div><h2>${esc(p.name)}</h2><p>${esc(p.role)}</p></div></div>${wide?'':`<div class="case-tabs">${p.records.map(v=>`<button data-case="${v.id}" class="${v.id===c.id?'active':''}">${esc(v.label)}</button>`).join('')}</div>`}${trialProgressHtml(c)}<span class="status">${esc(c.status)}</span>${c.lastChecked?`<p class="checked-date">정보 확인 ${esc(c.lastChecked)}</p>`:''}<h3 class="case-title">${esc(c.title)}</h3>${wide?'':'<button class="expand" data-expand>1·2·3심 나란히 비교 ↗</button>'}<div class="verdict three">${c.stages.map((s,i)=>`<div><span>${i+1}심${s[2]?' · '+esc(s[2]):''}</span><b>${esc(s[0])}</b><small>${esc(s[1])}</small></div>`).join('')}</div><h3 class="judgment-heading">혐의별 판단 <small>기소 내용과 법원 판단 구분</small></h3>${c.charges.map(v=>`<article class="charge"><h4>${esc(v.name)}</h4><p class="allegation"><b>기소 내용</b>${esc(v.act)}</p><div class="judgments">${v.judgments.map((j,i)=>`<div class="judgment"><b>${i+1}심</b><p>${esc(j)}</p></div>`).join('')}</div></article>`).join('')}${c.note?`<p class="case-note">${esc(c.note)}</p>`:''}${newsHtml(p,c)}${p.photoSource?`<p class="photo-credit">사진: <a href="${esc(p.photoSource)}" target="_blank" rel="noopener noreferrer">MBC 보도 사진</a></p>`:''}${related.length?`<h3 class="judgment-heading">연결된 인물</h3><div class="related-people">${related.map(v=>`<button data-id="${v.id}" ${wide?'':`data-related-to="${p.id}" aria-haspopup="dialog"`}>${esc(v.name)} <small>${esc(connection(p,v))}</small></button>`).join('')}</div>`:''}<p class="source-note">‘미확인’은 무죄나 재판 미진행을 뜻하지 않습니다. 사건별 확인 시점이 다르며, 형량을 다른 사건과 합산하지 않습니다.</p>`}
function select(id,cid){const p=lookup(id);selected=p.id;const c=p.records.find(c=>c.id===cid)||p.records.find(c=>c.agency===filter)||p.records[0];if(!c)return;if(!detailOpen)detailReturnY=window.scrollY;caseId=c.id;detailOpen=true;lockMobilePage();document.body.classList.add('detail-open');$('#detailBackdrop').hidden=false;$('#detail').innerHTML='<button class="detail-close" aria-label="재판 상세 닫기">×</button>'+body(p,c);$('#detail').scrollTop=0;page=0;draw();if(matchMedia('(min-width:761px)').matches)requestAnimationFrame(()=>{if(detailOpen)window.scrollTo({top:Math.max(0,$('.workspace').getBoundingClientRect().top+window.scrollY-16),behavior:'instant'})})}
function go(id,cid){$('#search').value='';const p=lookup(id);history.pushState(null,'',`#person/${p.id}${cid?'/'+cid:''}`);select(p.id,cid)}
document.addEventListener('click',e=>{if(e.target.closest('.detail-close')||e.target.closest('#detailBackdrop')){closeDetail();return}const edge=e.target.closest('[data-relation]');if(edge){showRelationPopup(edge.dataset.from,edge.dataset.to,edge,true);return}const relation=relationTarget(e.target);if(relation){showRelationPopup(relation.a,relation.b,relation.anchor,true);return}const p=e.target.closest('[data-id]');if(p){if($('#comparison').open)$('#comparison').close();go(p.dataset.id);return}const c=e.target.closest('[data-case]');if(c){go(selected,c.dataset.case);return}if(e.target.closest('[data-expand]')){const p=lookup(selected);$('#comparisonBody').innerHTML=body(p,p.records.find(c=>c.id===caseId),true);$('#comparison').showModal()}});
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;selected=agencyRoot();page=0;document.querySelectorAll('[data-filter]').forEach(v=>v.classList.toggle('selected',v===b));if(detailOpen)closeDetail();else draw();centerMobileMap()});let searchTimer;$('#search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{page=0;draw()},120)};$('#prevPage').onclick=()=>{page--;draw()};$('#nextPage').onclick=()=>{page++;draw()};$('#resetMap').onclick=()=>{filter='all';$('#search').value='';document.querySelectorAll('[data-filter]').forEach(v=>v.classList.toggle('selected',v.dataset.filter==='all'));selected='yoon';closeDetail();centerMobileMap()};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{mode=b.dataset.view;document.querySelectorAll('[data-view]').forEach(v=>v.classList.toggle('active',v===b));$('#map').hidden=mode!=='map';$('#list').hidden=mode!=='list';$('#timeline').hidden=mode!=='timeline';if(mode==='timeline')renderTimeline();document.querySelector('#trial-map').scrollIntoView({block:'start',behavior:'instant'})});$('#sourceBtn').onclick=()=>$('#sources').showModal();document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).close());$('#sourceLinks').innerHTML=catalogSources.map(link).join('');$('#totalPeople').textContent=persons.length;$('#coverage').innerHTML=agencies.map(a=>{const t=AGENCY_TOTALS[a];return `<div><b>${persons.filter(p=>p.agencies.includes(a)).length}</b><span>${a}</span>${t?`<small>특검 발표 기소 ${t[0]}명${t[1]?' · '+esc(t[1]):''}</small>`:''}</div>`}).join('');window.addEventListener('hashchange',()=>{const s=location.hash.split('/');if(s[1])select(s[1],s[2]);else closeDetail()});const start=location.hash.split('/');if(start[1])select(start[1],start[2]);else draw();
function closeDetail(){const returnY=detailReturnY;detailReturnY=null;detailOpen=false;document.body.classList.remove('detail-open');$('#detailBackdrop').hidden=true;unlockMobilePage();history.replaceState(null,'',location.pathname+location.search);draw();if(returnY!==null&&matchMedia('(min-width:761px)').matches)window.scrollTo({top:returnY,behavior:'instant'})}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDetail();if((e.key==='Enter'||e.key===' ')&&e.target.dataset.relation){e.preventDefault();showRelationPopup(e.target.dataset.from,e.target.dataset.to,e.target,true)}});

function centerMobileMap(){if(matchMedia('(max-width:760px)').matches){const map=$('#map');map.scrollLeft=Math.max(0,760*(filter==='all'?.46:.5)-map.clientWidth/2)}}
centerMobileMap();

// Refit names when opening a side panel or changing window size.
let graphSize='',resizeTimer;
new ResizeObserver(entries=>{const r=entries[0].contentRect,key=Math.round(r.width)+'x'+Math.round(r.height);if(r.width&&r.height&&key!==graphSize){graphSize=key;clearTimeout(resizeTimer);resizeTimer=setTimeout(draw,80)}}).observe($('.graph'));
