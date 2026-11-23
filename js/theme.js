/* 外觀設定：主題（13 組，跟學生會數位系統同一套）、深淺色（淺色／深色／跟系統）、動畫（豐富／簡約／關閉）。
   開頁前套好（不會閃一下）；存在這台裝置的 localStorage。設定面板在 js/settings.js。 */
(function () {
  var root = document.documentElement, mq = matchMedia('(prefers-color-scheme: dark)');
  var PALS = [['fin', '米黃'], ['b3', '白藍'], ['ink', '黑白黃'], ['sage', '灰綠'], ['mist', '霧藍'], ['fire', '爐火'], ['pastel', '粉彩'],
    ['neu', '柔光'], ['sun', '暖陽'], ['sakura', '櫻花'], ['forest', '森林'], ['ocean', '海洋'], ['wisteria', '紫藤']];
  function get(k, d) { try { return localStorage.getItem('proposal-' + k) || d; } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem('proposal-' + k, v); } catch (e) {} }
  var st = { pal: get('pal', 'fin'), mode: get('mode', 'system'), motion: get('motion', 'rich') };
  if (!PALS.some(function (p) { return p[0] === st.pal; })) st.pal = 'fin';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches && !get('motion', '')) st.motion = 'off';

  function paint() {
    root.setAttribute('data-pal', st.pal);
    root.setAttribute('data-theme', st.mode === 'system' ? (mq.matches ? 'dark' : 'light') : st.mode);
    root.setAttribute('data-motion', st.motion);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim() || '#f5f0e1');
    document.dispatchEvent(new CustomEvent('appearance', { detail: st }));
  }
  paint();
  mq.addEventListener('change', function () { if (st.mode === 'system') paint(); });

  /* 換外觀：豐富動畫時從按下的地方擴散開來（View Transitions），其他情況直接淡過去或直接換 */
  function apply(k, v, from) {
    if (st[k] === v) return;
    st[k] = v; put(k, v);
    var vt = document.startViewTransition && st.motion !== 'off' && k !== 'motion';
    if (!vt) return paint();
    var t = document.startViewTransition(paint);
    if (st.motion === 'rich' && from) {
      var r = from.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      var end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      t.ready.then(function () {
        root.animate({ clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + end + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' });
      }).catch(function () {});
    }
  }
  window.Appearance = { PALS: PALS, state: st, set: apply };
  window.toggleTheme = function (from) {
    var dark = root.getAttribute('data-theme') === 'dark';
    apply('mode', dark ? 'light' : 'dark', from);
  };
})();
