/* 離線快取：網站檔案先用快取、背景更新（stale-while-revalidate）；Google 字型同樣快取。改版時把 VERSION 加一。 */
var VERSION = 'proposal-v9';
var CORE = ['./', 'index.html', 'css/app.css', 'js/theme.js', 'js/pwa.js', 'js/settings.js', 'js/motion.js', 'css/themes.css', 'js/vendor/jszip.min.js', 'js/vendor/html2canvas.min.js',
  'js/vendor/jspdf.umd.min.js', 'js/vendor/morphdom.js', 'js/fill-docx.js', 'js/pdf.js', 'js/template-b64.js', 'js/dc-runtime.js', 'js/app.js',
  'manifest.webmanifest', 'assets/cover-seal.png', 'icons/favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var u = new URL(req.url);
  var mine = u.origin === location.origin, font = /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (!mine && !font) return;
  e.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(req, { ignoreSearch: mine }).then(function (hit) {
      // 背景更新一律跟伺服器確認（不用瀏覽器的 HTTP 快取），避免拿到新舊混在一起的檔案
      var net = fetch(req, mine ? { cache: 'no-cache' } : undefined).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
