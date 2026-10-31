// Android app (Capacitor): stands in for what Electron's window.native gives the desktop app, and for what a WebView lacks.
// Loaded first. On the desktop and the web it only defines CAP = false.
const CAP = !!window.Capacitor?.isNativePlatform?.();
const capCall = (plugin, method, opts = {}) => Capacitor.nativePromise(plugin, method, opts);
const blobB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
// a WebView can't download: write the file, then offer Android's share sheet (Files, Drive, email...)
async function capSave(blob, name) {
  const { uri } = await capCall('Filesystem', 'writeFile', { path: name.replace(/[\\/:*?"<>|]/g, '_'), data: await blobB64(blob), directory: 'CACHE' });
  await capCall('Share', 'share', { title: name, files: [uri] }).catch(e => { if (!/cancel/i.test(e.message)) throw e; });
}
function capBack() { // top-most thing first; the app only closes from Home
  const dlg = document.querySelector('dialog[open]');
  if (dlg) return dlg.close();
  for (const sel of ['#gs', '.ctx', '.inksel']) { const el = document.querySelector(sel); if (el) return el.remove(); }
  if (!$('#calc').hidden) return toggleCalc(false);
  if (!$('#ai').hidden) return void ($('#ai').hidden = true);
  if (['', '#', '#/', '#/home'].includes(location.hash)) return capCall('App', 'exitApp');
  history.back();
}
if (CAP) {
  window.native = {
    info: async () => { const i = await capCall('App', 'getInfo'); return { version: i.version, electron: 'Android', chrome: navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] || '', os: 'Android', portable: false }; },
    async fetchText(url) { // calendar links, without page CORS
      url = String(url).trim().replace(/^webcal:/i, 'https:');
      if (!/^https:\/\//i.test(url)) throw new Error('Use an https:// or webcal:// link');
      const r = await capCall('CapacitorHttp', 'get', { url, responseType: 'text' });
      if (r.status >= 400) throw new Error(`HTTP ${r.status}`);
      return r.data;
    },
    async ai({ key, model, messages }) {
      const r = await capCall('CapacitorHttp', 'post', { url: 'https://api.deepseek.com/chat/completions', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, data: { model, messages }, responseType: 'json' });
      if (r.status >= 400) throw new Error(r.data?.error?.message || `HTTP ${r.status}`);
      return r.data.choices[0].message.content;
    },
    async exportPdf(name, html) { await capCall('LocalPrint', 'print', { name, html }); return false; } // Android's print screen has Save as PDF
  };
  Capacitor.Plugins.App?.addListener('backButton', capBack);
}
