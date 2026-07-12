self.addEventListener('install', e => {
  e.waitUntil(caches.open('datadash-v2').then(c => c.addAll(['/','/index.html','/css/style.css','/js/app.js'])));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});
