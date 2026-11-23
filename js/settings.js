/* 外觀面板：主題（13 組）、深淺色、動畫。按頁首右上的設定鈕打開；Esc、點背景、安卓返回鍵都能關。 */
(function () {
  var A = window.Appearance;
  if (!A) return;
  var wrap, sheet, lastFocus;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function seg(key, items) {
    return '<div class="seg" role="radiogroup">' + items.map(function (it) {
      return '<button type="button" role="radio" data-k="' + key + '" data-v="' + it[0] + '">' + esc(it[1]) + '</button>';
    }).join('') + '</div>';
  }
  function build() {
    wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.hidden = true;
    wrap.innerHTML = '<div class="sheet-bg" data-close></div>' +
      '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">' +
      '<div class="sheet-head"><h2 id="sheetTitle" class="sec-h"><span class="en">APPEARANCE</span>外觀</h2>' +
      '<button type="button" class="round" data-close aria-label="關閉"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<section><h3>主題</h3><div class="pal-grid">' + A.PALS.map(function (p) {
        return '<button type="button" class="pal-btn" data-k="pal" data-v="' + p[0] + '" data-pal="' + p[0] + '" role="radio">' +
          '<span class="pal-sw"><span class="pal-card"><i class="d1"></i><i class="d2"></i><b></b></span></span><span class="pal-n">' + esc(p[1]) + '</span></button>';
      }).join('') + '</div></section>' +
      '<section><h3>深淺色</h3>' + seg('mode', [['light', '淺色'], ['dark', '深色'], ['system', '跟系統']]) + '</section>' +
      '<section><h3>動畫</h3>' + seg('motion', [['rich', '豐富'], ['calm', '簡約'], ['off', '關閉']]) + '</section>' +
      '</div>';
    document.body.appendChild(wrap);
    sheet = wrap.querySelector('.sheet');
    wrap.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) return close();
      var b = e.target.closest('[data-k]');
      if (b) A.set(b.getAttribute('data-k'), b.getAttribute('data-v'), b);
    });
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Tab') {   // 焦點留在面板裡
        var f = sheet.querySelectorAll('button'), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    sync();
  }
  function sync() {
    if (!wrap) return;
    wrap.querySelectorAll('[data-k]').forEach(function (b) {
      var on = A.state[b.getAttribute('data-k')] === b.getAttribute('data-v');
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }
  document.addEventListener('appearance', sync);
  function moving() { return document.documentElement.getAttribute('data-motion') !== 'off'; }
  function open(from) {
    if (!wrap) build();
    lastFocus = from || document.activeElement;
    wrap.hidden = false;
    document.documentElement.classList.add('sheet-open');
    if (moving()) {
      var rich = document.documentElement.getAttribute('data-motion') === 'rich', phone = innerWidth < 640;
      wrap.querySelector('.sheet-bg').animate({ opacity: [0, 1] }, { duration: 220, easing: 'ease-out' });
      sheet.animate(phone ? { transform: ['translateY(100%)', 'translateY(0)'] } : { transform: ['translateY(18px) scale(.94)', 'none'], opacity: [0, 1] },
        { duration: rich ? 460 : 260, easing: rich ? 'cubic-bezier(.34,1.4,.64,1)' : 'cubic-bezier(.2,.8,.2,1)' });
      if (rich) sheet.querySelectorAll('.pal-btn').forEach(function (b, i) {
        b.animate({ opacity: [0, 1], transform: ['translateY(10px) scale(.9)', 'none'] }, { duration: 380, delay: 60 + i * 22, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'backwards' });
      });
    }
    var cur = sheet.querySelector('.pal-btn.is-on') || sheet.querySelector('button');
    if (cur) cur.focus({ preventScroll: true });
  }
  function close() {
    if (!wrap || wrap.hidden) return false;
    var done = function () { wrap.hidden = true; document.documentElement.classList.remove('sheet-open'); if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); };
    if (!moving()) { done(); return true; }
    var phone = innerWidth < 640;
    wrap.querySelector('.sheet-bg').animate({ opacity: [1, 0] }, { duration: 200, fill: 'forwards' });
    sheet.animate(phone ? { transform: ['none', 'translateY(100%)'] } : { transform: ['none', 'translateY(12px) scale(.96)'], opacity: [1, 0] },
      { duration: 200, easing: 'ease-in', fill: 'forwards' }).finished.then(function () {
        sheet.getAnimations().forEach(function (a) { a.cancel(); });
        wrap.querySelector('.sheet-bg').getAnimations().forEach(function (a) { a.cancel(); });
        done();
      });
    return true;
  }
  window.__closeSheet = close;
  document.addEventListener('click', function (e) {
    var s = e.target.closest && e.target.closest('[data-settings]');
    if (s) return open(s);
    var t = e.target.closest && e.target.closest('[data-theme-toggle]');
    if (t) window.toggleTheme(t);
  });
})();
