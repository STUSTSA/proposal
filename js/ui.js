/* 窄螢幕的橫捲步驟列：換步驟時把目前那一顆捲到看得到的地方 */
(function () {
  var last = null;
  new MutationObserver(function () {
    var cur = document.querySelector('.step.is-cur');
    if (!cur || cur === last) return;
    last = cur;
    var list = cur.closest('.steps');
    if (list && list.scrollWidth > list.clientWidth + 4) {
      var li = cur.parentElement, left = li.offsetLeft - (list.clientWidth - li.offsetWidth) / 2;
      list.scrollTo({ left: Math.max(0, left), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }).observe(document.getElementById('dc-root'), { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
})();
