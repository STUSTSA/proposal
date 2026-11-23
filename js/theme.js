/* 深淺色：開頁前套好（不會閃一下）。存在這台裝置；沒選過就跟系統。按右上圓鈕切換。 */
(function () {
  var KEY = 'proposal-theme', root = document.documentElement;
  function sys() { return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function paint(t) {
    root.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'dark' ? '#000000' : '#f5f0e1');
  }
  paint(saved() || sys());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (!saved()) paint(sys()); });
  window.toggleTheme = function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, next); } catch (e) {}
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(function () { paint(next); });
    else paint(next);
  };
})();
document.addEventListener('click', function (e) {
  if (e.target.closest && e.target.closest('[data-theme-toggle]')) window.toggleTheme();
});
