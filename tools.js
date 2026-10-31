// Trash, global search, read aloud, tables, page templates and citations.
// Loaded before app.js: everything here runs after startup, so it can use app.js's S, save, route, icon...

/* ---------- trash: deleted items wait here for 30 days ---------- */
const TRASH_DAYS = 30;
// a page of an unlocked protected section must not reach disk as plain text: the trash keeps it encrypted
async function sealForTrash(n) {
  const s = secOf(n.sectionId), key = s && secKeys.get(s.id);
  return !s?.lock || !key || n.enc ? n : { ...n, title: '', html: '', ink: [], enc: await encJSON(key, { title: n.title, html: n.html, ink: n.ink || [] }) };
}
const addTrash = (kind, name, parts) => { S.trash.unshift({ id: uid(), kind, name, at: Date.now(), ...parts }); save(); };
async function trashNote(n) {
  const sealed = await sealForTrash(n), name = secOf(n.sectionId)?.lock ? 'Password-protected page' : n.title || 'Untitled page';
  S.notes = S.notes.filter(x => x !== n); addTrash('Page', name, { notes: [sealed] });
}
async function trashSection(s) {
  const notes = await Promise.all(pagesOf(s.id).map(sealForTrash));
  S.notes = S.notes.filter(p => p.sectionId !== s.id); S.sections = S.sections.filter(x => x !== s); addTrash('Section', s.name, { sections: [s], notes });
}
async function trashNotebook(nb) {
  const notes = await Promise.all(S.notes.filter(p => p.notebookId === nb.id).map(sealForTrash)), sections = S.sections.filter(s => s.notebookId === nb.id);
  S.notes = S.notes.filter(p => p.notebookId !== nb.id); S.sections = S.sections.filter(s => s.notebookId !== nb.id); S.notebooks = S.notebooks.filter(x => x !== nb);
  addTrash('Notebook', nb.name, { notebook: nb, sections, notes });
}
const trashFile = f => { S.files = S.files.filter(x => x !== f); addTrash('File', f.name, { file: f }); }; // its PDF/slides data stays in storage until the trash is emptied
const trashBoard = b => { S.boards = S.boards.filter(x => x !== b); addTrash('Whiteboard', b.name, { board: b }); };
async function restoreTrash(t) {
  const secs = t.sections || [], lost = (t.notes || []).some(n => n.enc && !secs.some(s => s.id === n.sectionId) && !secOf(n.sectionId)?.lock);
  if (lost) return toast("Its password-protected section is gone, so this page can't be restored");
  if (t.notebook) S.notebooks.push(t.notebook);
  for (const s of secs) { if (!S.notebooks.some(n => n.id === s.notebookId)) s.notebookId = defaultSection().notebookId; S.sections.push(s); }
  for (const n of t.notes || []) {
    let s = secOf(n.sectionId); if (!s) { s = defaultSection(); n.sectionId = s.id; }
    n.notebookId = s.notebookId;
    const key = n.enc && secKeys.get(s.id); if (key) { Object.assign(n, await decJSON(key, n.enc)); delete n.enc; }
    S.notes.push(n);
  }
  if (t.file) S.files.push(t.file);
  if (t.board) S.boards.push(t.board);
  S.trash = S.trash.filter(x => x !== t); save(); toast(`Restored “${t.name}”`); route();
}
function purgeTrash(t) {
  if (t.file && t.file.type !== 'md') db.transaction('files', 'readwrite').objectStore('files').delete(t.file.id);
  S.trash = S.trash.filter(x => x !== t);
}
function purgeOldTrash() { const old = S.trash.filter(t => Date.now() - t.at > TRASH_DAYS * 864e5); old.forEach(purgeTrash); if (old.length) save(); }
function viewTrash() {
  const left = t => Math.max(1, Math.ceil(TRASH_DAYS - (Date.now() - t.at) / 864e5));
  main.innerHTML = `<div class="page"><div class="row"><h1 style="flex:1">Trash</h1>${S.trash.length ? '<button id="tEmpty">Empty trash</button>' : ''}</div>
    <p class="mut">Deleted pages, sections, notebooks, files and whiteboards stay here for ${TRASH_DAYS} days.</p>
    <div class="trashl">${S.trash.map(t => `<div class="trashi" data-id="${t.id}"><span class="trashn"><b>${esc(t.name)}</b><small class="mut">${esc(t.kind)}${t.notes?.length > 1 ? ` · ${t.notes.length} pages` : ''} · deleted ${ago(t.at)} · ${left(t)} day${left(t) === 1 ? '' : 's'} left</small></span><button data-a="restore">Restore</button><button data-a="del">Delete forever</button></div>`).join('') || `<div class="empty">${icon('trash', 40)}<div>Trash is empty.</div></div>`}</div></div>`;
  main.querySelector('.trashl').onclick = e => {
    const b = e.target.closest('[data-a]'); if (!b) return; const t = S.trash.find(x => x.id === b.closest('.trashi').dataset.id);
    if (b.dataset.a === 'restore') return restoreTrash(t);
    if (confirm(`Delete "${t.name}" forever? This can't be undone.`)) { purgeTrash(t); save(); route(); }
  };
  if ($('#tEmpty')) $('#tEmpty').onclick = () => { if (confirm(`Delete all ${S.trash.length} items forever? This can't be undone.`)) { [...S.trash].forEach(purgeTrash); save(); route(); } };
}

/* ---------- global search (Ctrl+F) and quick switcher (Ctrl+P) ---------- */
const GS_TYPES = [['all', 'All'], ['page', 'Pages'], ['file', 'Files'], ['task', 'Tasks'], ['event', 'Events'], ['board', 'Whiteboards']];
const GS_DATES = [['any', 'Any time', 0], ['week', 'Past week', 7], ['month', 'Past month', 31], ['year', 'Past year', 366]];
function searchItems() {
  const crumbs = n => [S.notebooks.find(b => b.id === n.notebookId)?.name, secOf(n.sectionId)?.name].filter(Boolean).join(' › ');
  const tagsIn = h => [...(h || '').matchAll(/data-tag="(\w+)"/g)].map(m => NTAGS[m[1]]?.name || m[1]);
  return [
    ...openNotes().map(n => ({ type: 'page', ic: 'notes', title: n.title || 'Untitled page', sub: crumbs(n), text: plain(n.html), at: n.updated, tags: tagsIn(n.html), href: pageHref(n) })),
    ...S.files.map(f => ({ type: 'file', ic: 'files', title: f.name, sub: f.type.toUpperCase(), text: f.text || '', at: f.added, tags: f.tags || [], href: `#/files/${f.id}` })),
    ...S.tasks.map(t => ({ type: 'task', ic: 'tasks', title: t.title, sub: t.done ? 'Completed' : t.due ? `Due ${t.due.split('-').reverse().join('/')}` : 'Task', text: '', at: t.due ? +new Date(t.due + 'T00:00') : 0, tags: [], href: '#/tasks' })),
    ...S.events.map(e => ({ type: 'event', ic: 'calendar', title: e.title, sub: e.date.split('-').reverse().join('/'), text: e.notes || '', at: +new Date(e.date + 'T00:00'), tags: [], href: '#/calendar' })),
    ...S.boards.map(b => ({ type: 'board', ic: 'pen', title: b.name, sub: 'Whiteboard', text: (b.items || []).map(i => i.text || '').join(' '), at: b.updated, tags: [], href: `#/board/${b.id}` }))];
}
function snippet(text, words) {
  if (!text) return ''; const lo = text.toLowerCase(), at = words.length ? Math.max(0, lo.indexOf(words[0])) : 0, from = Math.max(0, at - 50);
  let h = esc(text.slice(from, from + 170)); for (const w of words) h = h.replace(new RegExp(esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark>${m}</mark>`);
  return (from ? '…' : '') + h;
}
function openSearch() {
  if ($('#gs')) return $('#gsq').select();
  const all = searchItems(), F = { type: 'all', tag: '', date: 'any' }, tags = [...new Set(all.flatMap(i => i.tags))].sort();
  const el = Object.assign(document.createElement('div'), { id: 'gs' });
  el.innerHTML = `<div class="gsbox"><input id="gsq" placeholder="Search everything, or type to jump to a page…" autocomplete="off" spellcheck="false">
    <div class="gsf"><div class="seg" id="gst">${GS_TYPES.map(([k, t]) => `<button data-t="${k}"${k === 'all' ? ' class="on"' : ''}>${t}</button>`).join('')}</div><span style="flex:1"></span>
    ${tags.length ? `<select id="gstag"><option value="">Any tag</option>${tags.map(t => `<option>${esc(t)}</option>`).join('')}</select>` : ''}<select id="gsd">${GS_DATES.map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></div>
    <div class="gsr" id="gsr"></div><small class="mut gsk">↑↓ move · Enter open · Esc close</small></div>`;
  document.body.append(el);
  const q = $('#gsq'), res = $('#gsr'); let hits = [], sel = 0;
  const close = () => el.remove();
  const open = i => { const h = hits[i]; if (!h) return; close(); if (location.hash === h.href) route(); else location.hash = h.href; };
  const draw = () => {
    res.querySelectorAll('.gsi').forEach((d, i) => d.classList.toggle('on', i === sel));
    res.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  };
  const run = () => {
    const words = q.value.toLowerCase().split(/\s+/).filter(Boolean), days = GS_DATES.find(d => d[0] === F.date)[2], since = days ? Date.now() - days * 864e5 : 0;
    hits = all.filter(i => (F.type === 'all' || i.type === F.type) && (!F.tag || i.tags.includes(F.tag)) && (!since || i.at >= since) && words.every(w => (i.title + ' ' + i.sub + ' ' + i.text + ' ' + i.tags.join(' ')).toLowerCase().includes(w)))
      .map(i => ({ ...i, score: words.filter(w => i.title.toLowerCase().includes(w)).length * 2 + (i.title.toLowerCase().startsWith(words[0] || '\0') ? 1 : 0) }))
      .sort((a, b) => b.score - a.score || b.at - a.at).slice(0, 40);
    sel = 0;
    res.innerHTML = hits.map((h, i) => `<div class="gsi" data-i="${i}">${icon(h.ic, 17)}<span class="gst"><b>${snippet(h.title, words)}</b><small class="mut">${esc(h.sub)}</small>${words.length && h.text ? `<small>${snippet(h.text, words)}</small>` : ''}</span></div>`).join('') || '<p class="mut" style="padding:14px">No matches.</p>';
    draw();
  };
  q.oninput = run;
  q.onkeydown = e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, Math.min(hits.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1))); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); open(sel); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  };
  $('#gst').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; F.type = b.dataset.t; $('#gst').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); run(); q.focus(); };
  if ($('#gstag')) $('#gstag').onchange = e => { F.tag = e.target.value; run(); };
  $('#gsd').onchange = e => { F.date = e.target.value; run(); };
  res.onclick = e => { const d = e.target.closest('.gsi'); if (d) open(+d.dataset.i); };
  el.onpointerdown = e => { if (e.target === el) close(); };
  run(); q.focus();
}

/* ---------- read aloud: the speech voices built into Windows and iPadOS, offline ---------- */
const tts = { btn: null, hash: '' };
const ttsOk = () => CAP || 'speechSynthesis' in window; // Android's WebView has no speech: CAP uses the system voices through a plugin
const texToWords = t => t.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1 over $2').replace(/\^\{?2\}?/g, ' squared').replace(/\^\{?3\}?/g, ' cubed').replace(/\^/g, ' to the power of ').replace(/\\sqrt/g, 'square root of ').replace(/\\([a-zA-Z]+)/g, ' $1 ').replace(/[{}_\\]/g, ' ');
function speakable(el) { // the text of a page: blocks on their own lines, equations in words, tags and checkboxes left out
  const c = el.cloneNode(true);
  c.querySelectorAll('.math').forEach(m => m.replaceWith(texToWords(m.dataset.tex || '')));
  c.querySelectorAll('.ntag,input,canvas,img,.imgbar').forEach(n => n.remove());
  c.querySelectorAll('p,li,h1,h2,h3,div,tr,td,th,blockquote,br').forEach(n => n.append('\n'));
  return c.textContent;
}
function stopSpeech() { if (CAP) capCall('TextToSpeech', 'stop').catch(() => { }); else if (ttsOk()) speechSynthesis.cancel(); tts.btn?.classList.remove('on'); tts.btn = null; }
function speak(text, btn) {
  if (!ttsOk()) return toast("This device doesn't offer read aloud");
  const was = tts.btn; stopSpeech(); if (was && was === btn) return; // pressing it again stops
  const parts = text.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean); // one sentence at a time: long utterances stall in Chromium
  if (!parts.length) return toast('Nothing to read');
  const voice = !CAP && speechSynthesis.getVoices().find(v => v.name === S.settings.ttsVoice), run = {}; tts.run = run;
  tts.btn = btn; tts.hash = location.hash; btn?.classList.add('on');
  const next = i => {
    if (tts.run !== run || !tts.btn) return;
    if (i >= parts.length) return stopSpeech();
    if (CAP) return capCall('TextToSpeech', 'speak', { text: parts[i], rate: S.settings.ttsRate || 1, lang: 'en-GB', ...(S.settings.ttsVoiceAndroid != null ? { voice: S.settings.ttsVoiceAndroid } : {}) }).then(() => next(i + 1), () => { stopSpeech(); });
    const u = new SpeechSynthesisUtterance(parts[i]); if (voice) u.voice = voice;
    u.rate = S.settings.ttsRate || 1; u.onend = () => next(i + 1); u.onerror = e => { if (e.error !== 'canceled' && e.error !== 'interrupted') { stopSpeech(); toast('Read aloud stopped: no voice available'); } };
    speechSynthesis.speak(u);
  };
  next(0);
}
function ttsSettingsHTML() {
  if (!ttsOk()) return '';
  return `<section class="box" data-ch="general"><h3>Read aloud</h3><p class="mut" style="margin-top:0">Uses the voices built into this device. Select text and press <b>Read aloud</b> on a page to hear only that part.</p>
    <div class="row"><select id="ttsV" style="flex:1;min-width:0"><option value="">Default voice</option></select><select id="ttsR">${[.75, 1, 1.25, 1.5, 1.75, 2].map(r => `<option value="${r}"${(S.settings.ttsRate || 1) === r ? ' selected' : ''}>${r}×</option>`).join('')}</select><button id="ttsT">Try it</button></div></section>`;
}
function bindTtsSettings() {
  if (!ttsOk() || !$('#ttsV')) return;
  if (CAP) {
    capCall('TextToSpeech', 'getSupportedVoices').then(({ voices }) => { const v = $('#ttsV'); if (v) v.innerHTML = `<option value="">Default voice</option>${voices.map((x, i) => [x, i]).filter(([x]) => /^en/i.test(x.lang)).map(([x, i]) => `<option value="${i}"${i === S.settings.ttsVoiceAndroid ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}`; }).catch(() => { });
    $('#ttsV').onchange = e => { S.settings.ttsVoiceAndroid = e.target.value === '' ? null : +e.target.value; save(); };
  } else {
    const fill = () => { const v = $('#ttsV'); if (!v) return; v.innerHTML = `<option value="">Default voice</option>${speechSynthesis.getVoices().map(x => `<option${x.name === S.settings.ttsVoice ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}`; };
    fill(); speechSynthesis.onvoiceschanged = fill;
    $('#ttsV').onchange = e => { S.settings.ttsVoice = e.target.value; save(); };
  }
  $('#ttsR').onchange = e => { S.settings.ttsRate = +e.target.value; save(); };
  $('#ttsT').onclick = e => speak('This is how your notes will sound.', e.currentTarget);
}

/* ---------- tables ---------- */
const tableHTML = (rows, cols, header) => `<table class="ntbl"><tbody>${Array.from({ length: rows }, (_, r) => `<tr>${Array.from({ length: cols }, () => r === 0 && header ? '<th><br></th>' : '<td><br></td>').join('')}</tr>`).join('')}</tbody></table><p><br></p>`;
const cellAt = root => { const n = getSelection().anchorNode, c = (n?.nodeType === 3 ? n.parentElement : n)?.closest?.('td,th'); return c && root.contains(c) ? c : null; };
const caretIn = cell => { const r = document.createRange(); r.selectNodeContents(cell); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
function newRow(tr) { const n = tr.cloneNode(false); [...tr.cells].forEach(() => n.append(Object.assign(document.createElement('td'), { innerHTML: '<br>' }))); return n; }
function tableAction(cell, a) {
  const tr = cell.parentElement, tb = tr.closest('table'), i = cell.cellIndex, rows = [...tb.rows];
  if (a === 'rowUp') { const n = newRow(tr); tr.before(n); caretIn(n.cells[i]); }
  if (a === 'rowDown') { const n = newRow(tr); tr.after(n); caretIn(n.cells[i]); }
  if (a === 'colL' || a === 'colR') {
    rows.forEach(r => { const c = document.createElement(r.cells[i].tagName); c.innerHTML = '<br>'; r.cells[i][a === 'colL' ? 'before' : 'after'](c); });
    caretIn(tr.cells[a === 'colL' ? i : i + 1]);
  }
  if (a === 'delRow') { if (rows.length === 1) return tableAction(cell, 'del'); const t = rows[tr.rowIndex + 1] || rows[tr.rowIndex - 1]; tr.remove(); caretIn(t.cells[Math.min(i, t.cells.length - 1)]); }
  if (a === 'delCol') { if (tr.cells.length === 1) return tableAction(cell, 'del'); rows.forEach(r => r.cells[i].remove()); caretIn(tr.cells[Math.min(i, tr.cells.length - 1)]); }
  if (a === 'header') { const first = rows[0], to = first.cells[0].tagName === 'TH' ? 'td' : 'th'; [...first.cells].forEach(c => { const n = document.createElement(to); n.append(...c.childNodes); c.replaceWith(n); }); }
  if (a === 'del') { const p = tb.nextElementSibling; tb.remove(); if (p) caretIn(p); }
}
const TABLE_MENU = [['Add row above', 'rowUp'], ['Add row below', 'rowDown'], ['Add column left', 'colL'], ['Add column right', 'colR'], '-', ['Delete row', 'delRow'], ['Delete column', 'delCol'], ['Header row on / off', 'header'], '-', ['Delete table', 'del']];
const tableMenuItems = (cell, done) => TABLE_MENU.map(it => it === '-' ? it : [it[0], () => { tableAction(cell, it[1]); done(); }]);
function tableTab(cell, back) { // Tab / Shift+Tab: next or previous cell; Tab in the last cell adds a row
  const cells = [...cell.closest('table').querySelectorAll('td,th')], at = cells.indexOf(cell) + (back ? -1 : 1);
  if (at >= cells.length) { tableAction(cell, 'rowDown'); const r = cell.parentElement.nextElementSibling; caretIn(r.cells[0]); return true; }
  if (at >= 0) caretIn(cells[at]);
  return false;
}

/* ---------- page templates ---------- */
const box = t => `<p><input type="checkbox">&nbsp;${t}</p>`;
const PAGE_TEMPLATES = [
  ['Lecture notes', 'Lecture notes', '<p><b>Module:</b> <br><b>Lecturer:</b> <br><b>Date:</b> </p><h2>Key points</h2><ul><li><br></li></ul><h2>Notes</h2><p><br></p><h2>Questions to follow up</h2>' + box('') + '<h2>Summary</h2><p><br></p>'],
  ['Cornell notes', 'Cornell notes', '<table class="ntbl cornell"><tbody><tr><th>Cues and questions</th><th>Notes</th></tr><tr><td><br></td><td><br></td></tr></tbody></table><h2>Summary</h2><p><br></p>'],
  ['Meeting notes', 'Meeting notes', '<p><b>Date:</b> <br><b>Attendees:</b> </p><h2>Agenda</h2><ul><li><br></li></ul><h2>Notes</h2><p><br></p><h2>Decisions</h2><ul><li><br></li></ul><h2>Actions</h2>' + box('')],
  ['Lab report', 'Lab report', '<p><b>Experiment:</b> <br><b>Date:</b> </p><h2>Aim</h2><p><br></p><h2>Hypothesis</h2><p><br></p><h2>Method</h2><ol><li><br></li></ol><h2>Results</h2><table class="ntbl"><tbody><tr><th>Measurement</th><th>Value</th><th>Uncertainty</th></tr><tr><td><br></td><td><br></td><td><br></td></tr></tbody></table><h2>Discussion</h2><p><br></p><h2>Conclusion</h2><p><br></p><h2>References</h2><p><br></p>'],
  ['Essay plan', 'Essay plan', '<p><b>Question:</b> <br><b>Word limit:</b> <br><b>Due:</b> </p><h2>Thesis</h2><p><br></p><h2>Introduction</h2><p><br></p><h2>Argument 1</h2><ul><li>Evidence: </li><li>Analysis: </li></ul><h2>Argument 2</h2><ul><li>Evidence: </li><li>Analysis: </li></ul><h2>Counterargument</h2><p><br></p><h2>Conclusion</h2><p><br></p><h2>References</h2><p><br></p>'],
  ['Reading summary', 'Reading summary', '<p><b>Source:</b> <br><b>Read on:</b> </p><h2>Main argument</h2><p><br></p><h2>Key evidence</h2><ul><li><br></li></ul><h2>Useful quotes</h2><blockquote><br></blockquote><h2>My thoughts</h2><p><br></p>'],
  ['Revision sheet', 'Revision sheet', '<p><b>Topic:</b> <br><b>Exam date:</b> </p><h2>Must know</h2><ul><li><br></li></ul><h2>Key formulas</h2><p><br></p><h2>Definitions</h2><table class="ntbl"><tbody><tr><th>Term</th><th>Meaning</th></tr><tr><td><br></td><td><br></td></tr></tbody></table><h2>Past paper mistakes</h2><ul><li><br></li></ul>'],
  ['Weekly plan', 'Weekly plan', `<table class="ntbl"><tbody><tr><th>Day</th><th>Plan</th><th>Done</th></tr>${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => `<tr><td>${d}</td><td><br></td><td><br></td></tr>`).join('')}</tbody></table><h2>Top priorities</h2>${box('')}${box('')}${box('')}`]];

/* ---------- citations ---------- */
const REF_STYLES = [['apa', 'APA 7'], ['mla', 'MLA 9'], ['harvard', 'Harvard'], ['ieee', 'IEEE'], ['chicago', 'Chicago']];
const REF_FIELDS = { // [field, label, hint]
  book: [['publisher', 'Publisher'], ['place', 'City of publication', 'Harvard, IEEE, Chicago'], ['edition', 'Edition', 'e.g. 2'], ['doi', 'DOI or link', 'optional']],
  journal: [['journal', 'Journal'], ['volume', 'Volume'], ['issue', 'Issue'], ['pages', 'Pages', 'e.g. 45-67'], ['doi', 'DOI or link', 'optional']],
  web: [['site', 'Website name'], ['url', 'Link'], ['accessed', 'Date accessed', 'today if left empty']] };
const REF_TYPES = [['book', 'Book'], ['journal', 'Journal article'], ['web', 'Website']];
const REF_HEADS = { apa: 'References', mla: 'Works Cited', harvard: 'Reference list', ieee: 'References', chicago: 'Bibliography' };
function refAuthors(s) { // "Smith, John; Doe, Jane A." or an organisation
  return (s || '').split(';').map(a => a.trim()).filter(Boolean).map(a => { const [last, first = ''] = a.split(',').map(x => x.trim()); return { last, first, ini: first.split(/[\s.]+/).filter(Boolean).map(p => p[0].toUpperCase() + '.') }; });
}
const refJoin = (l, two, many = two) => l.length < 2 ? l[0] || '' : l.length === 2 ? `${l[0]}${two}${l[1]}` : `${l.slice(0, -1).join(', ')}${many}${l.at(-1)}`;
const refEd = (r, f) => { const n = parseInt(r.edition); return n > 1 ? f(`${n}${n % 100 > 10 && n % 100 < 14 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`) : ''; };
const refDoi = r => { const d = (r.doi || '').trim(); return /^10\./.test(d) ? `https://doi.org/${d}` : d; };
const refDash = p => (p || '').replace(/\s*[-–]\s*/, '–');
const refDate = (r, f) => { const d = r.accessed ? new Date(r.accessed + 'T00:00') : new Date(); return isNaN(d) ? r.accessed : f(d); };
const MON = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'], MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const sent = t => /[.?!]$/.test(t) ? t : t + '.';
function formatRef(r, style) { // -> HTML; every value is escaped first
  const e = {}; for (const k in r) e[k] = esc(r[k] ?? ''); const A = refAuthors(r.authors), y = e.year, t = e.title, it = s => `<i>${s}</i>`, itd = s => /[.?!]$/.test(s) ? it(s) : `${it(s)}.`, doi = esc(refDoi(r)), pp = esc(refDash(r.pages)), url = esc(r.url || '');
  const orgOk = a => a.first ? null : a.last, surIni = a => orgOk(a) ?? `${a.last}, ${a.ini.join(' ')}`, full = (a, i) => orgOk(a) ?? (i ? `${a.first} ${a.last}` : `${a.last}, ${a.first}`), iniFirst = a => orgOk(a) ?? `${a.ini.join(' ')} ${a.last}`;
  const none = v => v || 'n.d.', names = A.map(a => esc(surIni(a)));
  if (style === 'apa') {
    const who = A.length ? `${sent(refJoin(names, ', & ', ', & '))} ` : '', date = `(${none(y)}). `;
    if (r.type === 'journal') return `${who}${date}${sent(t)} ${it(e.journal)}${e.volume ? `, ${it(e.volume)}` : ''}${e.issue ? `(${e.issue})` : ''}${pp ? `, ${pp}` : ''}.${doi ? ` ${doi}` : ''}`;
    if (r.type === 'web') return `${who}${date}${itd(t)}${e.site ? ` ${sent(e.site)}` : ''}${url ? ` ${url}` : ''}`;
    return `${who}${date}${it(t)}${refEd(r, n => ` (${n} ed.)`)}.${e.publisher ? ` ${sent(e.publisher)}` : ''}${doi ? ` ${doi}` : ''}`;
  }
  if (style === 'mla') {
    const fn = A.length > 2 ? [esc(full(A[0], 0))] : A.map((a, i) => esc(full(a, i))), who = A.length ? `${sent(A.length > 2 ? `${fn[0]}, et al` : refJoin(fn, ', and '))} ` : '';
    if (r.type === 'journal') return `${who}"${sent(t)}" ${it(e.journal)}${e.volume ? `, vol. ${e.volume}` : ''}${e.issue ? `, no. ${e.issue}` : ''}${y ? `, ${y}` : ''}${pp ? `, pp. ${pp}` : ''}.${doi ? ` ${doi}.` : ''}`;
    if (r.type === 'web') return `${who}"${sent(t)}"${e.site ? ` ${it(e.site)},` : ''}${y ? ` ${y},` : ''}${url ? ` ${url}.` : ''} Accessed ${refDate(r, d => `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`)}.`;
    return `${who}${itd(t)}${refEd(r, n => ` ${n} ed.,`)}${e.publisher ? ` ${e.publisher},` : ''}${y ? ` ${y}.` : ''}`;
  }
  if (style === 'harvard') {
    const inis = a => orgOk(a) ?? `${a.last}, ${a.ini.join('')}`, who = A.length ? `${refJoin(A.map(a => esc(inis(a))), ' and ')} ` : '', date = `(${none(y)}) `;
    if (r.type === 'journal') return `${who}${date}'${t}', ${it(e.journal)}${e.volume ? `, ${e.volume}` : ''}${e.issue ? `(${e.issue})` : ''}${pp ? `, pp. ${pp}` : ''}.${doi ? ` Available at: ${doi}.` : ''}`;
    if (r.type === 'web') return `${who}${date}${itd(t)}${url ? ` Available at: ${url}` : ''} (Accessed: ${refDate(r, d => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`)}).`;
    return `${who}${date}${itd(t)}${refEd(r, n => ` ${n} edn.`)}${e.place || e.publisher ? ` ${[e.place, e.publisher].filter(Boolean).join(': ')}.` : ''}`;
  }
  if (style === 'ieee') {
    const who = A.length ? `${refJoin(A.map(a => esc(iniFirst(a))), ' and ', ', and ')}, ` : '';
    if (r.type === 'journal') return `${who}"${t}," ${it(e.journal)}${e.volume ? `, vol. ${e.volume}` : ''}${e.issue ? `, no. ${e.issue}` : ''}${pp ? `, pp. ${pp}` : ''}${y ? `, ${y}` : ''}${doi ? `, doi: ${esc((r.doi || '').trim())}` : ''}.`;
    if (r.type === 'web') return `${who}"${t}."${e.site ? ` ${sent(e.site)}` : ''} Accessed: ${refDate(r, d => `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`)}. [Online]. Available: ${url}`;
    return `${who}${it(t)}${refEd(r, n => `, ${n} ed`)}.${e.place ? ` ${e.place}:` : ''}${e.publisher ? ` ${e.publisher},` : ''}${y ? ` ${y}.` : ''}`;
  }
  const fn = A.map((a, i) => esc(full(a, i))), who = A.length ? `${sent(refJoin(fn, ', and ', ', and '))} ` : ''; // Chicago bibliography
  if (r.type === 'journal') return `${who}"${sent(t)}" ${it(e.journal)}${e.volume ? ` ${e.volume}` : ''}${e.issue ? `, no. ${e.issue}` : ''}${y ? ` (${y})` : ''}${pp ? `: ${pp}` : ''}.${doi ? ` ${doi}.` : ''}`;
  if (r.type === 'web') return `${who}"${sent(t)}"${e.site ? ` ${sent(e.site)}` : ''}${y ? ` ${y}.` : ''}${url ? ` ${url}.` : ''}`;
  return `${who}${itd(t)}${refEd(r, n => ` ${n} ed.`)}${e.place ? ` ${e.place}:` : ''}${e.publisher ? ` ${e.publisher}${y ? ',' : '.'}` : ''}${y ? ` ${y}.` : ''}`;
}
function inText(r, style) {
  const L = refAuthors(r.authors).map(a => a.last), y = r.year || 'n.d.', et = style === 'harvard' || style === 'chicago' ? 3 : 2;
  const who = !L.length ? `“${r.title}”` : L.length > et ? `${L[0]} et al.` : refJoin(L, style === 'apa' ? ' & ' : ' and ', style === 'apa' ? ', & ' : ' and ');
  if (style === 'ieee') return `[${S.refs.indexOf(r) + 1}]`;
  return style === 'mla' ? `(${who})` : style === 'chicago' ? `(${who} ${y})` : `(${who}, ${y})`;
}
const refSort = l => [...l].sort((a, b) => (refAuthors(a.authors)[0]?.last || a.title || '').localeCompare(refAuthors(b.authors)[0]?.last || b.title || ''));
function referenceList(style, list = S.refs) {
  const ordered = style === 'ieee' ? list : refSort(list);
  return `<h2>${REF_HEADS[style]}</h2>${ordered.map(r => `<p class="ref">${style === 'ieee' ? `[${S.refs.indexOf(r) + 1}] ` : ''}${formatRef(r, style)}</p>`).join('')}`;
}
function citeDialog(old, onDone) { // new or saved citation; onDone(html) inserts it in the page
  const style = S.settings.citeStyle || 'apa', r0 = old || { type: 'book' }, v = k => esc(r0[k.replace('_j', '')] ?? '');
  const inp = ([k, label, hint]) => `<label class="cf">${label}${hint ? ` <small class="mut">${hint}</small>` : ''}<input name="${k}" value="${v(k)}"></label>`;
  dialog(`<h3>${old ? 'Edit citation' : 'New citation'}</h3><div class="row" style="flex-wrap:nowrap"><select name="type" style="flex:1">${REF_TYPES.map(([k, t]) => `<option value="${k}"${r0.type === k ? ' selected' : ''}>${t}</option>`).join('')}</select><select name="style">${REF_STYLES.map(([k, t]) => `<option value="${k}"${style === k ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
    ${inp(['authors', 'Authors', 'Last, First; Last, First'])}<div class="row cfr" style="flex-wrap:nowrap"><label class="cf" style="flex:1">Title<input name="title" required value="${v('title')}"></label><label class="cf" style="width:84px">Year<input name="year" value="${v('year')}"></label></div>
    ${Object.entries(REF_FIELDS).map(([t, fs]) => `<div class="cfg" data-for="${t}">${fs.map(f => inp([f[0] + (t === 'book' ? '' : t === 'journal' && f[0] === 'doi' ? '_j' : ''), f[1], f[2]])).join('')}</div>`).join('')}
    <div class="refprev" id="refPrev"></div><select name="ins"><option value="cite">Insert the in-text citation</option><option value="full">Insert the full reference</option><option value="none">Just save it</option></select>`,
    d => { const r = readRef(d); Object.assign(old || (S.refs.push(r), r), r, { id: old?.id || r.id }); S.settings.citeStyle = d.style; save(); const it = old || S.refs.at(-1); if (d.ins === 'cite') onDone(esc(inText(it, d.style))); if (d.ins === 'full') onDone(`<p class="ref">${d.style === 'ieee' ? `[${S.refs.indexOf(it) + 1}] ` : ''}${formatRef(it, d.style)}</p>`); },
    old ? () => { S.refs = S.refs.filter(x => x !== old); save(); } : null);
  const f = $('#dlg form'), upd = () => {
    const d = Object.fromEntries(new FormData(f)); f.querySelectorAll('.cfg').forEach(g => g.hidden = g.dataset.for !== d.type);
    const r = readRef(d); $('#refPrev').innerHTML = r.title ? `${formatRef(r, d.style)}<small class="mut">${esc(inText(r, d.style))}</small>` : '<small class="mut">The reference appears here as you type.</small>';
  };
  f.oninput = upd; upd();
}
function readRef(d) {
  const keep = { id: uid(), type: d.type, authors: d.authors.trim(), title: d.title.trim(), year: d.year.trim() };
  for (const [k] of REF_FIELDS[d.type]) { const v = d[k + (d.type === 'journal' && k === 'doi' ? '_j' : '')] ?? d[k]; if (v?.trim()) keep[k] = v.trim(); }
  return keep;
}
