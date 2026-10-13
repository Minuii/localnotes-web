// LocalNotes offline cache. scripts/build-web.js fills in VERSION and FILES; a new build = a new cache.
const VERSION = '7c22632b8854';
const FILES = ["./","apple-touch-icon.png","icon-192.png","icon-512.png","icon.png","index.html","lib/jszip/dist/jszip.min.js","lib/katex/dist/fonts/KaTeX_AMS-Regular.woff2","lib/katex/dist/fonts/KaTeX_Caligraphic-Bold.woff2","lib/katex/dist/fonts/KaTeX_Caligraphic-Regular.woff2","lib/katex/dist/fonts/KaTeX_Fraktur-Bold.woff2","lib/katex/dist/fonts/KaTeX_Fraktur-Regular.woff2","lib/katex/dist/fonts/KaTeX_Main-Bold.woff2","lib/katex/dist/fonts/KaTeX_Main-BoldItalic.woff2","lib/katex/dist/fonts/KaTeX_Main-Italic.woff2","lib/katex/dist/fonts/KaTeX_Main-Regular.woff2","lib/katex/dist/fonts/KaTeX_Math-BoldItalic.woff2","lib/katex/dist/fonts/KaTeX_Math-Italic.woff2","lib/katex/dist/fonts/KaTeX_SansSerif-Bold.woff2","lib/katex/dist/fonts/KaTeX_SansSerif-Italic.woff2","lib/katex/dist/fonts/KaTeX_SansSerif-Regular.woff2","lib/katex/dist/fonts/KaTeX_Script-Regular.woff2","lib/katex/dist/fonts/KaTeX_Size1-Regular.woff2","lib/katex/dist/fonts/KaTeX_Size2-Regular.woff2","lib/katex/dist/fonts/KaTeX_Size3-Regular.woff2","lib/katex/dist/fonts/KaTeX_Size4-Regular.woff2","lib/katex/dist/fonts/KaTeX_Typewriter-Regular.woff2","lib/katex/dist/katex.min.css","lib/katex/dist/katex.min.js","lib/marked/lib/marked.umd.js","lib/pdfjs-dist/build/pdf.min.mjs","lib/pdfjs-dist/build/pdf.worker.min.mjs","manifest.webmanifest"];
const CACHE = 'localnotes-' + VERSION;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('localnotes-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// cache first (everything is versioned with the build), the network only for what isn't cached
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true })
    .then(r => r || (e.request.mode === 'navigate' ? caches.match('./') : null))
    .then(r => r || fetch(e.request)));
});
