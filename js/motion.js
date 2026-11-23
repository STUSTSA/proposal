/* 動畫（與窄螢幕步驟列的自動捲動）：跟著外觀面板的「動畫」設定（<html data-motion="rich|calm|off">）。
   rich（豐富）：按鈕水波、卡片跟著游標微傾、步驟數字翻動、預覽換頁翻面、統計數字滾動、匯出完成灑彩帶。
   calm（簡約）：只留淡入淡出與數字翻動。off（關閉）：全部不動（CSS 也一併關掉過渡）。
   全部用 Web Animations，只動 transform／opacity。 */
(function () {
  var root = document.documentElement;
  function mode() { return root.getAttribute('data-motion') || 'rich'; }
  function rich() { return mode() === 'rich'; }
  function on() { return mode() !== 'off'; }
  var EASE = 'cubic-bezier(.2,.8,.2,1)', SPRING = 'cubic-bezier(.34,1.56,.64,1)';

  /* ---- 按鈕水波（豐富） ---- */
  var RIPPLE = '.btn,.tag,.tab,.step,.card,.chip,.round,.pal-btn,.seg button,.x';
  document.addEventListener('pointerdown', function (e) {
    if (!rich() || e.button > 0) return;
    var el = e.target.closest && e.target.closest(RIPPLE);
    if (!el || el.disabled) return;
    // 樣式直接寫在元素上，不靠 app.css（網站更新時瀏覽器可能先拿到新的 JS、舊的 CSS）。
    // 水波畫在 body 上的獨立圖層（蓋在按鈕上、裁成按鈕的圓角），不塞進按鈕裡：按鈕由畫面引擎重畫，塞進去的元素會被改寫
    var r = el.getBoundingClientRect(), d = Math.hypot(r.width, r.height) * 2, cs = getComputedStyle(el);
    var host = document.createElement('span');
    host.className = 'ripple-host';
    host.style.cssText = 'position:fixed;z-index:95;overflow:hidden;pointer-events:none;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;border-radius:' + cs.borderRadius + ';color:' + cs.color;
    var s = document.createElement('span');
    s.className = 'ripple';
    s.style.cssText = 'position:absolute;border-radius:50%;background:currentColor;pointer-events:none;transform:scale(0);width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
    host.appendChild(s);
    document.body.appendChild(host);
    var gone = function () { host.remove(); };
    s.animate({ transform: ['scale(0)', 'scale(1)'], opacity: [.3, 0] }, { duration: 650, easing: 'cubic-bezier(.1,.6,.3,1)' }).finished.then(gone, gone);
  }, { passive: true });

  /* ---- 卡片跟著游標微傾（豐富，只在有滑鼠的裝置） ---- */
  var TILT = '.card,.stat,.up';
  if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
    document.addEventListener('pointermove', function (e) {
      var el = e.target.closest && e.target.closest(TILT);
      if (!el || !rich()) return;
      var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      el.style.transform = 'perspective(700px) rotateX(' + (-y * 6).toFixed(2) + 'deg) rotateY(' + (x * 8).toFixed(2) + 'deg) translateY(-2px)';
      el.classList.add('tilting');
    }, { passive: true });
    document.addEventListener('pointerout', function (e) {
      var el = e.target.closest && e.target.closest(TILT);
      if (el && !el.contains(e.relatedTarget)) { el.style.transform = ''; el.classList.remove('tilting'); }
    });
  }

  /* ---- 畫面變化時的動畫：觀察整個 App 的重畫 ---- */
  var last = { step: null, page: null, cur: null, done: false, stats: {} };
  function roll(el, dir) {
    el.animate({ transform: ['translateY(' + (dir * 40) + '%)', 'none'], opacity: [0, 1] }, { duration: rich() ? 480 : 260, easing: rich() ? SPRING : EASE });
  }
  function countUp(el, to) {
    var txt = el.firstChild;
    if (!txt || txt.nodeType !== 3) return;
    var from = last.stats[el.dataset.k] || 0, t0 = performance.now(), dur = 600, fmt = function (n) { return Math.round(n).toLocaleString('en-US'); };
    (function tick(t) {
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      txt.nodeValue = fmt(from + (to - from) * e);
      if (p < 1 && el.isConnected) requestAnimationFrame(tick);
    })(t0);
  }
  var lastCur = null;
  function check() {
    // 窄螢幕的橫捲步驟列：換步驟時把目前那一顆捲到看得到的地方（不論動畫設定）
    var c = document.querySelector('.step.is-cur');
    if (c && c !== lastCur) {
      lastCur = c;
      var list = c.closest('.steps'), li = c.parentElement;
      if (list && list.scrollWidth > list.clientWidth + 4)
        list.scrollTo({ left: Math.max(0, li.offsetLeft - (list.clientWidth - li.offsetWidth) / 2), behavior: on() ? 'smooth' : 'auto' });
    }
    if (!on()) return;
    // 步驟大數字翻動
    var big = document.querySelector('.bigdate');
    if (big && big.firstChild) {
      var n = parseInt(big.firstChild.nodeValue, 10);
      if (last.step !== null && n !== last.step) roll(big, n > last.step ? 1 : -1);
      last.step = n;
    }
    // 目前步驟的膠囊彈一下
    var cur = document.querySelector('.step.is-cur');
    if (cur && cur !== last.cur) {
      if (last.cur && rich()) cur.animate({ transform: ['scale(.9)', 'scale(1.04)', 'none'] }, { duration: 420, easing: SPRING });
      last.cur = cur;
    }
    // 預覽換頁：翻面
    var tab = document.querySelector('.tab.is-on'), paper = document.querySelector('article.paper');
    var pg = tab ? tab.textContent : null;
    if (paper && pg !== last.page) {
      if (last.page !== null) {
        if (rich()) paper.animate({ transform: ['perspective(1400px) rotateY(-14deg) translateX(18px)', 'none'], opacity: [.2, 1] }, { duration: 520, easing: SPRING });
        else paper.animate({ opacity: [0, 1] }, { duration: 220 });
      }
      last.page = pg;
    }
    // 經費統計數字滾動（豐富）
    document.querySelectorAll('.stat .v').forEach(function (v, i) {
      v.dataset.k = i;
      var t = v.firstChild && v.firstChild.nodeType === 3 ? v.firstChild.nodeValue : '';
      var num = parseInt(String(t).replace(/[^\d-]/g, ''), 10) || 0;
      if (rich() && last.stats[i] !== undefined && last.stats[i] !== num && !v.dataset.rolling) {
        v.dataset.rolling = '1';
        countUp(v, num);
        setTimeout(function () { delete v.dataset.rolling; }, 650);
      }
      last.stats[i] = num;
    });
    // 匯出完成：灑彩帶（豐富）
    var done = !!document.querySelector('.linebar.done');
    if (done && !last.done && rich()) confetti(document.querySelector('.linebar.done'));
    last.done = done;
  }
  var queued = false;
  var mo = new MutationObserver(function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; check(); });
  });
  function start() {
    var host = document.getElementById('dc-root');
    if (!host) return;
    mo.observe(host, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    check();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 50); });
  else start();

  /* ---- 彩帶 ---- */
  function confetti(anchor) {
    var cs = getComputedStyle(root), cols = ['--acc', '--acc2', '--ok', '--late', '--pri'].map(function (v) { return cs.getPropertyValue(v).trim(); });
    var r = anchor ? anchor.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
    var layer = document.createElement('div');
    layer.className = 'confetti';
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:90;overflow:hidden';
    document.body.appendChild(layer);
    var all = [];
    for (var i = 0; i < 70; i++) {
      var p = document.createElement('i');
      var w = 6 + Math.random() * 6;
      p.style.cssText = 'position:absolute;display:block;left:' + (r.left + r.width * Math.random()) + 'px;top:' + r.top + 'px;width:' + w + 'px;height:' + (w * (Math.random() < .5 ? .45 : 1)) + 'px;background:' + cols[i % cols.length] + ';border-radius:' + (Math.random() < .3 ? '50%' : '2px');
      layer.appendChild(p);
      var dx = (Math.random() - .5) * 420, up = 120 + Math.random() * 220, rot = (Math.random() - .5) * 900;
      all.push(p.animate([
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        { transform: 'translate(' + dx * .6 + 'px,' + (-up) + 'px) rotate(' + rot * .4 + 'deg)', opacity: 1, offset: .35 },
        { transform: 'translate(' + dx + 'px,' + (innerHeight * .5) + 'px) rotate(' + rot + 'deg)', opacity: 0 }
      ], { duration: 1500 + Math.random() * 900, easing: 'cubic-bezier(.2,.6,.4,1)' }).finished);
    }
    Promise.all(all).then(function () { layer.remove(); }, function () { layer.remove(); });
  }
  window.__confetti = confetti;
})();
