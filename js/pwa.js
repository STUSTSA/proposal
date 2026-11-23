/* 安裝成 App／離線可用：註冊 Service Worker（只在 https 或 localhost） */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !window.ProposalApp) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
