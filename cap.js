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
// the next alarms, soonest first: tasks at 9:00 on their due day, timed events 15 minutes before, all-day events at 9:00
function reminderList(tasks, events, now, max = 60) { // ponytail: only the next 60 are armed, and they refresh when the app saves; fine unless 60+ fall between two uses of the app
  const at = (date, time, before) => new Date(`${date}T${time || '09:00'}`).getTime() - before * 60000, out = [];
  for (const t of tasks) if (!t.done && t.due) out.push({ at: at(t.due, '', 0), title: t.title || 'Task', body: 'Task due today', href: '#/tasks' });
  for (const e of events) if (e.date) out.push({ at: at(e.date, e.time, e.time ? 15 : 0), title: e.title || 'Event', body: e.time ? `Starts at ${e.time}` : 'Today', href: '#/calendar' });
  return out.filter(r => r.at > now).sort((a, b) => a.at - b.at).slice(0, max);
}
const reminderId = r => { let h = 7; for (const c of r.at + r.title) h = h * 31 + c.charCodeAt(0) | 0; return (h & 0x7fffffff) || 1; }; // from the content, not the list position: reusing an id wipes a reminder already showing
let remindSig = '';
async function syncReminders() { // Android keeps these and fires them with the app closed, so they are rebuilt whenever the data changes
  if (!CAP) return;
  const list = S.settings.reminders === false ? [] : reminderList(S.tasks, [...S.events, ...S.settings.cals.filter(c => !c.hidden).flatMap(c => S.ics[c.id] || [])], Date.now()), sig = JSON.stringify(list);
  if (sig === remindSig) return; remindSig = sig;
  try {
    if (list.length && (await capCall('LocalNotifications', 'requestPermissions')).display !== 'granted') return;
    const { notifications: old } = await capCall('LocalNotifications', 'getPending');
    const had = new Set(old.map(n => +n.id)), keep = new Set(list.map(reminderId)), gone = [...had].filter(id => !keep.has(id)), fresh = list.filter(r => !had.has(reminderId(r)));
    if (gone.length) await capCall('LocalNotifications', 'cancel', { notifications: gone.map(id => ({ id })) });
    if (fresh.length) await capCall('LocalNotifications', 'schedule', { notifications: fresh.map(r => ({ id: reminderId(r), title: r.title, body: r.body, schedule: { at: new Date(r.at).toISOString(), allowWhileIdle: true }, extra: { href: r.href } })) });
  } catch (e) { console.warn('reminders', e); }
}
const SHARE_EXT = { 'application/pdf': '.pdf', 'text/markdown': '.md', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx' };
async function capShared({ files = [], failed, text, subject }) { // from another app: documents go to Files, pictures and text into a new note
  if (failed) toast('Could not read a shared file');
  const named = f => { const ext = SHARE_EXT[f.type]; return ext && !f.name.toLowerCase().endsWith(ext) && !(ext === '.md' && /\.markdown$/i.test(f.name)) ? f.name + ext : f.name; }; // some apps send a name with no extension
  const got = await Promise.all(files.map(async f => new File([await (await fetch(Capacitor.convertFileSrc(f.path))).blob()], named(f), { type: f.type || '' })));
  const pics = got.filter(f => f.type.startsWith('image/')), plain = got.filter(f => f.type.startsWith('text/') && !SHARE_EXT[f.type] && !/\.(md|markdown)$/i.test(f.name)), docs = got.filter(f => !pics.includes(f) && !plain.includes(f)), before = S.files.length;
  if (plain.length) text = [text, ...await Promise.all(plain.map(f => f.text()))].filter(Boolean).join('\n');
  if (docs.length) { await addFiles(docs); if (S.files.length > before) location.hash = `#/files/${S.files.at(-1).id}`; }
  if (!pics.length && !text) return;
  const lines = (text || '').split('\n').map(l => `<p>${esc(l).replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}">${u}</a>`) || '<br>'}</p>`).join('');
  const imgs = (await Promise.all(pics.map(shrinkImage))).filter(Boolean).map(src => `<p><img src="${src}" style="max-width:100%;border-radius:10px"></p>`).join('');
  newNote(S.sections.find(s => !isSealed(s))?.id, { title: subject || (text || '').split('\n')[0].slice(0, 60), html: (text ? lines : '') + imgs });
}
function capStart() { // once the data has loaded: anything sent while the app was closed arrives now
  if (!CAP) return;
  syncReminders();
  Capacitor.addListener('LocalNotifications', 'localNotificationActionPerformed', a => { const h = a.notification?.extra?.href; if (h) location.hash = h; });
  Capacitor.addListener('ShareIn', 'shared', s => capShared(s).catch(e => { console.warn(e); toast('Could not open what was shared'); }));
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
  addEventListener('hashchange', () => { if (inkState.mode === 'draw') inkState.mode = 'pen'; }); // "Draw (all input)" lasts for one page, or a phone's next scroll draws. Runs before the router, so the new page shows Stylus draws
}
