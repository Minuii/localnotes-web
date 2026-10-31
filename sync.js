// PC ↔ iPad sync through a private GitHub repo; everything is encrypted here before it leaves the device. Format: SYNC.md
// Loaded before app.js: everything here runs after startup.
const SYNC_API = 'https://api.github.com', SYNC_ROUNDS = 600000, SYNC_MAX_FILE = 70e6; // base64 makes a file a third bigger, and GitHub stops at 100 MB
const SYNC_COLLS = ['notebooks', 'sections', 'notes', 'tasks', 'events', 'boards', 'files', 'trash', 'refs', 'templates']; // merged record by record
const SYNC_SKIP = new Set(['ics', 'migratedSections', 'settings']); // the rest of the state is merged key by key
const SYNC_LOCAL_SETTINGS = new Set(['aiKey', 'collapsed', 'collapsedNarrow', 'cals', 'ttsVoice', 'ttsVoiceAndroid']); // stay on this device
let syncCfg = null, syncBase = null, syncBusy = false, syncTimer = null, syncKeyMemo = null, syncMsg = '', syncLoop = false;

/* ---------- three-way merge: a record only changed on one side wins; changed on both is a conflict ---------- */
function stable(v) { // same JSON for the same data whatever order its keys were added in
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).filter(k => k[0] !== '_' && k !== 'enc' && v[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v) ?? 'null';
}
const shaHex = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
async function stateHashes(st) { // { coll: { id: hash }, single: { key: hash }, set: { key: hash } }
  const h = { coll: {}, single: {}, set: {} };
  for (const c of SYNC_COLLS) { h.coll[c] = {}; for (const r of st[c] || []) h.coll[c][r.id] = await shaHex(stable(r)); }
  for (const k of Object.keys(st)) if (!SYNC_COLLS.includes(k) && !SYNC_SKIP.has(k)) h.single[k] = await shaHex(stable(st[k]));
  for (const k of Object.keys(st.settings || {})) if (!SYNC_LOCAL_SETTINGS.has(k)) h.set[k] = await shaHex(stable(st.settings[k]));
  return h;
}
const newer = (l, r) => (l.updated || l.at || 0) > (r.updated || r.at || 0);
function mergeKeys(keys, B, LH, RH, L, R, out, took) { // key-by-key part: a change on one side wins; on both, the remote one
  for (const k of keys) {
    const b = B[k], l = LH[k], r = RH[k];
    const remote = l === r ? false : l === b ? true : r === b ? false : true;
    if (remote) { took.push(k); if (r === undefined) delete out[k]; else out[k] = R[k]; } else if (l !== undefined) out[k] = L[k];
  }
}
function mergeStates(base, local, remote, lh, rh) { // pure: nothing here touches S
  const out = { settings: {} }, took = { coll: [], single: [], set: [] }, copies = [];
  for (const c of SYNC_COLLS) {
    const L = new Map((local[c] || []).map(r => [r.id, r])), R = new Map((remote[c] || []).map(r => [r.id, r])), list = [], B = base?.coll[c] || {};
    for (const id of new Set([...R.keys(), ...L.keys()])) {
      const l = L.get(id), r = R.get(id), hl = lh.coll[c][id], hr = rh.coll[c][id], hb = B[id];
      const useRemote = () => { took.coll.push([c, id]); if (r) list.push(r); };
      if (hl === hr || (hr === hb && hb !== undefined) || (!r && hb === undefined)) { if (l) list.push(l); continue; } // same, or only changed here (deleted here stays deleted)
      if (hl === hb && hb !== undefined) { useRemote(); continue; } // only changed there (or deleted there)
      if (!l) { took.coll.push([c, id]); list.push(r); continue; } // new there
      if (!r) { list.push(l); continue; } // deleted there, edited here: the edit wins
      if (newer(l, r)) list.push(l); else useRemote();
      if (c === 'notes') { const lost = newer(l, r) ? r : l; copies.push({ ...lost, id: uid(), title: lost.title ? `${lost.title} (conflict copy)` : 'Conflict copy', order: (lost.order ?? 0) + .5 }); }
    }
    out[c] = list;
  }
  out.notes.push(...copies);
  mergeKeys(new Set([...Object.keys(lh.single), ...Object.keys(rh.single)]), base?.single || {}, lh.single, rh.single, local, remote, out, took.single);
  mergeKeys(new Set([...Object.keys(lh.set), ...Object.keys(rh.set)]), base?.set || {}, lh.set, rh.set, local.settings || {}, remote.settings || {}, out.settings, took.set);
  return { merged: out, took, copies };
}
async function openIfUnlocked(n) { // a protected page arriving for a section open here; one that can't be decrypted just stays encrypted
  const key = n.enc && secKeys.get(n.sectionId); if (!key) return;
  try { Object.assign(n, await decJSON(key, n.enc)); delete n.enc; } catch (e) { console.warn('sync: could not open a protected page', e); }
}
async function applyMerge({ merged, took, copies }, snap) { // bring this device's live state up to date, keeping the objects open editors hold
  for (const [c, id] of took.coll) {
    const incoming = merged[c].find(r => r.id === id), cur = S[c].find(r => r.id === id);
    if (cur && snap[c]?.find(r => r.id === id)?.updated !== cur.updated && (cur.updated ?? 0) > 0 && c === 'notes') continue; // edited while syncing: the next sync sends it
    if (!incoming) { S[c] = S[c].filter(r => r !== cur); continue; }
    const rec = cur || incoming; if (cur) { for (const k of Object.keys(cur)) delete cur[k]; Object.assign(cur, incoming); } else S[c].push(incoming);
    if (c === 'notes') await openIfUnlocked(rec);
  }
  for (const n of copies) { await openIfUnlocked(n); S.notes.push(n); }
  for (const k of took.single) { if (k in merged) S[k] = merged[k]; else delete S[k]; }
  for (const k of took.set) { if (k in merged.settings) S.settings[k] = merged.settings[k]; else delete S.settings[k]; }
  return took.coll.length + took.single.length + took.set.length + copies.length;
}

/* ---------- encryption: AES-256-GCM, key from the passphrase with PBKDF2-SHA256; each file is 12-byte IV + ciphertext ---------- */
async function syncKey(meta) {
  const id = syncCfg.pass + meta.salt; if (syncKeyMemo?.id === id) return syncKeyMemo.key;
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(syncCfg.pass), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: fromB64(meta.salt), iterations: meta.rounds, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  syncKeyMemo = { id, key }; return key;
}
async function sealBytes(key, bytes) { const iv = crypto.getRandomValues(new Uint8Array(12)), ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes)), out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out; }
const openBytes = (key, buf) => { const u = new Uint8Array(buf); return crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.subarray(0, 12) }, key, u.subarray(12)); };

/* ---------- GitHub contents API ---------- */
async function gh(path, opt = {}, raw = false) {
  let r; try { r = await fetch(`${SYNC_API}/repos/${syncCfg.repo}${path && '/' + path}`, { cache: 'no-store', ...opt, headers: { Authorization: `Bearer ${syncCfg.token}`, Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', ...opt.headers } }); }
  catch { throw new Error("Couldn't reach GitHub"); }
  if (r.status === 401) throw new Error('GitHub rejected the token');
  if (r.status === 403) throw new Error('The token lacks access, or GitHub is rate limiting');
  return r;
}
async function ghInfo(path) { const r = await gh(`contents/${path}`); if (r.status === 404) return null; if (!r.ok) throw new Error(`GitHub error ${r.status}`); return r.json(); }
async function ghRead(sha) { const r = await gh(`git/blobs/${sha}`, {}, true); if (!r.ok) throw new Error(`GitHub error ${r.status}`); return r.arrayBuffer(); }
async function ghWrite(path, bytes, sha, message) {
  const r = await gh(`contents/${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, content: toB64(bytes), ...(sha ? { sha } : {}) }) });
  if (r.status === 409 || r.status === 422) return false; // someone else wrote first
  if (!r.ok) throw new Error(`GitHub error ${r.status}`);
  return true;
}
async function ghDelete(path, sha) { await gh(`contents/${path}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Remove file', sha }) }); }

/* ---------- one sync ---------- */
async function syncMeta() {
  const info = await ghInfo('meta.json');
  if (info) { const meta = JSON.parse(new TextDecoder().decode(await ghRead(info.sha))); if (meta.format !== 1) throw new Error('This repo was written by a newer LocalNotes: update this device'); return meta; }
  const repo = await gh(''); if (repo.status === 404) throw new Error('Repo not found, or the token can’t see it');
  const meta = { format: 1, salt: toB64(crypto.getRandomValues(new Uint8Array(16))), rounds: SYNC_ROUNDS };
  if (!await ghWrite('meta.json', new TextEncoder().encode(JSON.stringify(meta)), null, 'Set up LocalNotes sync')) return syncMeta();
  return meta;
}
const blobStamp = f => `${f.size}:${f.blobAt || f.added}`;
async function syncBlobs(key, st) { // PDFs and slides: one encrypted file each under files/
  const dir = await gh('contents/files'), there = new Map(dir.ok ? (await dir.json()).map(f => [f.name, f.sha]) : []);
  const wanted = [...st.files, ...st.trash.flatMap(t => t.file ? [t.file] : [])].filter(f => f.type !== 'md'), sent = syncCfg.sent ||= {}, tooBig = [];
  for (const f of wanted) {
    const local = await idbGet('files', f.id), sha = there.get(f.id);
    if (local && (!sha || sent[f.id] !== blobStamp(f))) {
      if (local.size > SYNC_MAX_FILE) { tooBig.push(f.name); continue; }
      if (await ghWrite(`files/${f.id}`, await sealBytes(key, new Uint8Array(await local.arrayBuffer())), sha, `File ${f.id}`)) sent[f.id] = blobStamp(f);
    }
    else if (!local && sha) { await idbPut('files', f.id, new Blob([await openBytes(key, await ghRead(sha))])); sent[f.id] = blobStamp(f); }
  }
  for (const [id, sha] of there) if (!wanted.some(f => f.id === id)) { await ghDelete(`files/${id}`, sha); delete sent[id]; }
  return tooBig;
}
function syncPayload(st) { const settings = Object.fromEntries(Object.entries(st.settings).filter(([k]) => !SYNC_LOCAL_SETTINGS.has(k))); const { ics, ...rest } = st; return { ...rest, settings }; }
async function syncOnce() {
  const meta = await syncMeta(), key = await syncKey(meta);
  await window.flushNow();
  const snap = JSON.parse(JSON.stringify(syncPayload(await sealState())));
  const info = await ghInfo('state.enc');
  let remote = null;
  if (info) {
    try { remote = JSON.parse(new TextDecoder().decode(await openBytes(key, await ghRead(info.sha)))).state; }
    catch { throw new Error('Wrong passphrase: it must match the one on your other device'); }
  }
  const lh = await stateHashes(snap), rh = remote ? await stateHashes(remote) : null;
  const m = remote ? mergeStates(syncBase, snap, remote, lh, rh) : { merged: snap, took: { coll: [], single: [], set: [] }, copies: [] };
  syncSkipped = await syncBlobs(key, m.merged);
  const mh = await stateHashes(m.merged);
  if (!remote || stable(mh) !== stable(rh)) {
    const bytes = new TextEncoder().encode(JSON.stringify({ format: 1, savedAt: Date.now(), state: m.merged }));
    if (bytes.length > 95e6) throw new Error('Your notes are over GitHub’s 100 MB file limit');
    if (!await ghWrite('state.enc', await sealBytes(key, bytes), info?.sha, 'Sync')) return null; // the other device got in first: merge again
  }
  const changed = await applyMerge(m, snap); // only now: if the upload lost a race, this device is untouched and merges again
  syncBase = mh; await idbPut('kv', 'syncBase', mh);
  syncCfg.last = Date.now(); await idbPut('kv', 'sync', syncCfg);
  return changed;
}
let syncSkipped = [];
function setSyncMsg(t) { syncMsg = t; const el = $('#syncSt'); if (el) el.textContent = t; }
async function syncNow(manual) {
  if (syncBusy) return scheduleSync(); // edits made during a sync go in the next one
  if (!syncCfg?.repo || IS_WIDGET) return; syncBusy = true; clearTimeout(syncTimer); setSyncMsg('Syncing…');
  try {
    let changed = null; for (let i = 0; i < 4 && changed === null; i++) changed = await syncOnce();
    if (changed === null) throw new Error('Another device keeps writing. Try again in a moment');
    setSyncMsg(`Synced ${new Date().toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit' })}${syncSkipped.length ? `, but too big for GitHub: ${syncSkipped.join(', ')}` : ''}`);
    if (manual) toast(changed ? 'Synced: changes came in from your other device' : 'Everything is in sync');
    if (changed) { save(); document.activeElement?.matches('input,textarea,[contenteditable=true]') && view !== 'settings' ? renderSide(...sideArgs) : route(); }
  } catch (e) { console.warn('sync', e); setSyncMsg(`Not synced: ${e.message}`); if (manual) toast(e.message); }
  syncBusy = false;
}
// after edits, once you've paused: each sync is a commit, so not after every keystroke
function scheduleSync() {
  if (!syncCfg?.repo || !syncCfg.auto || IS_WIDGET) return; clearTimeout(syncTimer);
  syncTimer = setTimeout(() => Date.now() - lastInput < 5000 ? scheduleSync() : syncNow(), 60e3);
}
async function startSync() {
  if (IS_WIDGET) return;
  syncCfg = await idbGet('kv', 'sync') || null; syncBase = await idbGet('kv', 'syncBase') || null;
  if (!syncCfg?.repo) return;
  setTimeout(syncNow, 1500); if (syncLoop) return; syncLoop = true;
  setInterval(() => syncNow(), 5 * 60e3);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (syncTimer) { clearTimeout(syncTimer); syncNow(); } } // leaving the app with edits waiting: send them now
    else if (Date.now() - (syncCfg?.last || 0) > 60e3) syncNow();
  });
}
// a restored backup isn't a mass delete: forget the last sync, so the next one merges instead of removing what the backup lacks
function forgetSyncBase() { syncBase = null; if (db) { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete('syncBase'); } }

/* ---------- Settings → Sync ---------- */
const syncSettingsHTML = () => `<section class="box" data-ch="sync"><h3>Sync between PC and iPad</h3>
  <p class="mut" style="margin-top:0">Keeps this device in step with your others through a <b>private GitHub repo</b>. Notes and files are encrypted on this device first, so GitHub only ever holds unreadable data. Setup steps are in <b>SYNC.md</b>.</p>
  <div class="syncf"><label>Repo<input id="syRepo" placeholder="your-name/localnotes-data" value="${esc(syncCfg?.repo || '')}" autocomplete="off" spellcheck="false"></label>
  <label>GitHub token<input id="syTok" type="password" autocomplete="off" placeholder="${syncCfg?.token ? 'Saved on this device' : 'github_pat_…'}"></label>
  <label>Sync passphrase <small class="mut">use the same one on every device; it can't be recovered</small><input id="syPass" type="password" autocomplete="off" placeholder="${syncCfg?.pass ? 'Saved on this device' : ''}"></label>
  <label class="syncc"><input type="checkbox" id="syAuto"${syncCfg?.auto === false ? '' : ' checked'}> Sync automatically</label></div>
  <div class="row"><button class="pri" id="sySave">${syncCfg?.repo ? 'Sync now' : 'Connect and sync'}</button>${syncCfg?.repo ? '<button id="syOff">Disconnect this device</button>' : ''}<small class="mut" id="syncSt" style="align-self:center">${esc(syncMsg)}</small></div></section>`;
function bindSyncSettings() {
  if (!$('#sySave')) return;
  $('#sySave').onclick = async () => {
    const repo = $('#syRepo').value.trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, ''), token = $('#syTok').value.trim() || syncCfg?.token, pass = $('#syPass').value || syncCfg?.pass;
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return toast('Repo should look like your-name/repo-name');
    if (!token || !pass || pass.length < 8) return toast('Enter the token and a passphrase of at least 8 characters');
    const first = !syncCfg?.repo; syncCfg = { ...syncCfg, repo, token, pass, auto: $('#syAuto').checked }; await idbPut('kv', 'sync', syncCfg);
    await syncNow(true); if (first && syncCfg.last) { route(); startSync(); }
  };
  $('#syAuto').onchange = async e => { if (syncCfg?.repo) { syncCfg.auto = e.target.checked; await idbPut('kv', 'sync', syncCfg); } };
  if ($('#syOff')) $('#syOff').onclick = async () => {
    if (!confirm("Stop syncing this device? Its notes stay here, and the data on GitHub isn't touched.")) return;
    syncCfg = null; syncBase = null; clearTimeout(syncTimer); const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete('sync'); t.objectStore('kv').delete('syncBase'); setSyncMsg(''); route();
  };
}
