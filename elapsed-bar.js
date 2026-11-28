// 머리글 왼쪽: MBC 로고 + 아래 줄 '계엄 후 N일 hh:mm:ss' (clock.html · v2 공용). 누르면 처음 화면(clock.html)으로 갑니다.
// 쓰는 법: <a class="appbar__brand appbar__clock" data-elapsed href="…clock.html"></a>
(function () {
  const START = new Date('2024-12-03T22:27:00+09:00').getTime();
  const pad = n => String(n).padStart(2, '0');
  const els = [...document.querySelectorAll('[data-elapsed]')];
  if (!els.length) return;
  // 로고 주소는 이 파일(루트) 기준 → clock.html·v2 어디서 불러도 같은 그림
  const me = document.currentScript || document.querySelector('script[src*="elapsed-bar.js"]');
  const logo = new URL('assets/mbc-wordmark-white.png', me ? me.src : location.href).href;
  els.forEach(el => { el.innerHTML = `<img class="brand-logo" src="${logo}" alt="MBC" width="118" height="34"><small class="brand-time">계엄 후 <strong class="d"></strong>일 <em class="t"></em></small>`; });
  function tick() {
    let s = Math.max(0, Math.floor((Date.now() - START) / 1000));
    const d = Math.floor(s / 86400); s %= 86400;
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    els.forEach(el => {
      el.querySelector('.d').textContent = d.toLocaleString('ko-KR');
      el.querySelector('.t').textContent = `${pad(h)}:${pad(m)}:${pad(sec)}`;
      el.setAttribute('aria-label', `MBC 12·3 재판 지도 · 비상계엄 이후 ${d}일 ${h}시간 ${m}분 · 처음 화면으로`);
    });
  }
  tick(); setInterval(tick, 1000);
})();
