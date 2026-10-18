/* AI Use Assessment · Admin (/admin/) and Profile (/profile/) pages.
   Separate from aua.js so the assessment screens stay as they are. The server checks every request;
   these pages only show what it returns. */
(function () {
'use strict';
const AREA = /^\/admin(\/|$)/.test(location.pathname) ? 'admin' : 'profile';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* Dates follow the Profile choice of date format and time zone, as on the assessment screens. */
const DF_OPTS = { long: { day: 'numeric', month: 'short', year: 'numeric' }, short: { day: 'numeric', month: 'short', year: 'numeric' }, numeric: { day: '2-digit', month: '2-digit', year: 'numeric' } };
const fmtLocal = iso => { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return iso; const u = SRV.user || {}, tz = u.timeZone || undefined, df = u.dateFormat || 'long';
  try { if (df === 'iso') { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}, ` + d.toLocaleTimeString('en-AU', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }); }
    return d.toLocaleDateString('en-AU', Object.assign({ timeZone: tz }, DF_OPTS[df] || DF_OPTS.long)) + ', ' + d.toLocaleTimeString('en-AU', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }); } catch (e) { return d.toLocaleString('en-AU'); } };
const tzList = () => { try { return Intl.supportedValuesOf('timeZone'); } catch (e) { return ['Australia/Brisbane', 'Australia/Sydney', 'Australia/Melbourne', 'Australia/Adelaide', 'Australia/Perth', 'Australia/Hobart', 'Australia/Darwin', 'Pacific/Auckland', 'Asia/Singapore', 'Asia/Hong_Kong', 'Europe/London', 'America/New_York', 'UTC']; } };
const initials = s => String(s || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join('');
const badge = (l, c) => { l = String(l == null ? '' : l); return `<span class="badge ${c}">${esc(l.charAt(0).toUpperCase() + l.slice(1))}</span>`; };
function toast(msg) { const t = document.getElementById('toast'); if (!t || !msg) return; t.textContent = msg; t.className = 'toast'; clearTimeout(toast._t); toast._t = setTimeout(() => { t.className = 'vh'; }, 3400); }
async function api(method, path, body) {
  let r;
  try { r = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin', redirect: 'manual', cache: 'no-store' }); }
  catch (e) { return { ok: false, status: 0, error: 'The server could not be reached. Check your connection.' }; }
  if (r.type === 'opaqueredirect' || r.status === 401) return { ok: false, status: 401, error: 'Your sign-in has expired. Reload the page to sign in again.' };
  let j = null; try { j = await r.json(); } catch (e) {}
  if (!r.ok) return { ok: false, status: r.status, error: (j && j.error) || ('The server returned an error (' + r.status + ').'), code: j && j.code };
  return { ok: true, status: r.status, body: j };
}

const SRV = { checked: false, on: false, user: null, roles: [], site: '', code: '', reason: '' };
const ADM = { loaded: false, users: [], roles: [], perms: [], requests: [], audit: [], editing: null, adding: false, draft: null, err: '' };
const PRF = { err: '', msg: '', emailErr: '', prefMsg: '' };
let TAB = (location.hash.slice(1) === 'activity') ? 'activity' : 'users';
const roleLong = id => ((ADM.roles.length ? ADM.roles : SRV.roles).find(r => r.id === id) || {}).name || id;

function header() {
  const u = SRV.user, tabs = AREA === 'admin' && u && u.isAdmin ? [['users', 'Users and roles'], ['activity', 'Activity']] : [];
  return `<header class="hdr"><div class="hdr-in">
    <a class="brand" href="/" aria-label="Triodian · back to the assessment" style="text-decoration:none"><img class="logo" src="/triodian-logo.svg" alt="Triodian" style="height:22px;width:auto;display:block"></a>
    <span class="vrule" aria-hidden="true"></span><span class="apptitle">${AREA === 'admin' ? 'Admin' : 'Profile'}</span>
    ${tabs.length ? `<nav class="steps area-tabs" aria-label="Admin">${tabs.map(t => `<button data-tab="${t[0]}" ${TAB === t[0] ? 'aria-current="page"' : ''}>${t[1]}</button>`).join('')}</nav>` : ''}
    <div class="hdr-r"><a class="lnk hdr-back" href="/">Back to the assessment</a>${u ? `<a class="avatar-link" href="/profile/" title="${esc(u.name || u.email)}" ${AREA === 'profile' ? 'aria-current="page"' : ''}><span class="avatar" aria-hidden="true">${esc(initials(u.name || u.email))}</span><span class="vh">Your profile</span></a>` : ''}</div>
  </div></header>${SRV.site ? `<div class="examplebar" style="background:#FDF0E1;color:#8A4B08;border-color:#F0D2AE">${esc(SRV.site)} · for trying things out · not the live assessment</div>` : ''}`;
}
const opening = (eb, h1, sub) => `<div class="opening"><div class="eyebrow">${eb}</div><h1 class="h1">${h1}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>`;
const msg = (title, text) => `<div class="adm-msg"><h1 class="h1" style="font-size:30px">${esc(title)}</h1><p class="soft">${text}</p><p style="margin-top:18px"><a class="btn" href="/">Back to the assessment</a></p></div>`;

function render() {
  const ae = document.activeElement, fid = ae && ae.id;
  let main;
  if (!SRV.checked) main = '<p class="soft" style="padding:40px 0">Loading…</p>';
  else if (!SRV.on) main = msg(SRV.code === 'no_access' ? 'No access' : 'Could not connect', esc(SRV.reason) + (SRV.code === 'no_access' ? ' <a href="/cdn-cgi/access/logout">Sign out</a>' : ''));
  else if (AREA === 'profile') main = screenProfile();
  else if (!SRV.user.isAdmin) main = msg('Administrators only', 'Admin is for administrators. Ask an administrator if you need a user added or a role changed.');
  else main = TAB === 'activity' ? screenActivity() : screenUsers();
  document.getElementById('app').innerHTML = header() + `<main id="main" tabindex="-1" class="area-main"><div class="wrap">${main}</div></main>`;
  if (fid) { const el = document.getElementById(fid); if (el) el.focus({ preventScroll: true }); }
  else if (ADM.adding || ADM.editing) { const f = document.getElementById('f-email'); if (f) f.focus(); }
}

/* ---------- admin ---------- */
async function loadAdmin() {
  const [u, a] = await Promise.all([api('GET', '/api/admin/users'), api('GET', '/api/admin/audit')]);
  if (u.ok) { ADM.users = u.body.users; ADM.roles = u.body.roles; ADM.perms = u.body.permissions; ADM.requests = u.body.accessRequests || []; } else ADM.err = u.error;
  ADM.audit = a.ok ? a.body.entries : []; ADM.loaded = true; render();
}
function userForm(u, isNew) {
  const has = r => (u.roles || []).includes(r);
  return `<form class="adm-form" id="userForm" data-id="${esc(u.id || '')}" novalidate>
    <label class="f">Email<input class="in" id="f-email" type="email" autocomplete="off" value="${esc(u.email || '')}"></label>
    <label class="f">Name<input class="in" id="f-name" value="${esc(u.name || '')}"></label>
    <label class="f">Organisation<input class="in" id="f-org" value="${esc(u.organisation || '')}"></label>
    <fieldset class="adm-roles" style="border:0;padding:0;margin:4px 0 0"><legend class="mini" style="margin-bottom:4px">ROLES IN THE ASSESSMENT · a person may hold more than one</legend>
      ${ADM.roles.map(r => `<label class="cb small"><input type="checkbox" name="f-role" value="${esc(r.id)}" ${has(r.id) ? 'checked' : ''}> ${esc(r.name)}</label>`).join('')}</fieldset>
    <div class="acts2"><label class="cb"><input type="checkbox" id="f-admin" ${u.isAdmin ? 'checked' : ''}> Administrator (users and roles; also set-up)</label>
      ${isNew ? '' : `<label class="cb"><input type="checkbox" id="f-active" ${u.active !== false ? 'checked' : ''}> Active (can sign in)</label>`}</div>
    ${u.pendingEmail ? `<p class="small soft acts2">Has asked to change their email to ${esc(u.pendingEmail)} (not yet confirmed).</p>` : ''}
    ${ADM.err ? `<p class="err acts2" role="alert">${esc(ADM.err)}</p>` : ''}
    <div class="acts2"><button class="btn primary sm" type="submit">${isNew ? 'Add user' : 'Save changes'}</button><button class="btn sm" type="button" data-act="cancel">Cancel</button></div>
  </form>`;
}
function screenUsers() {
  if (!ADM.loaded) return '<p class="soft" style="padding:40px 0">Loading…</p>';
  const me = SRV.user, active = ADM.users.filter(u => u.active).length;
  const rows = ADM.users.map(u => ADM.editing === u.id ? `<tr class="adm-edit"><td colspan="6">${userForm(ADM.draft || u, false)}</td></tr>` : `<tr class="${u.active ? '' : 'off'}">
      <td><strong>${esc(u.name || '—')}</strong>${u.id === me.id ? ' ' + badge('you', 'b-aub') : ''}<div class="em">${esc(u.email)}</div>${u.organisation ? `<div class="small soft">${esc(u.organisation)}</div>` : ''}</td>
      <td>${(u.roles || []).length ? u.roles.map(r => esc(roleLong(r))).join('<br>') : '<span class="soft">None</span>'}</td>
      <td>${u.isAdmin ? badge('Admin', 'b-aub') : ''}</td>
      <td>${u.active ? badge('Active', 'b-green') : badge('Inactive', 'b-grey')}</td>
      <td class="adm-hide-sm small soft">${u.lastSeenAt ? fmtLocal(u.lastSeenAt) : 'Never'}</td>
      <td style="text-align:right"><button class="btn sm" data-act="edit" data-id="${esc(u.id)}">Edit</button></td></tr>`).join('');
  const reqs = ADM.requests.length ? `<section class="adm-sec"><h2>Waiting for access</h2>
    <p class="small soft" style="margin:4px 0 12px">These people signed in but are not users, so they could not open the assessment.</p>
    <div class="tw"><table class="lg"><thead><tr><th>Email</th><th>Last tried</th><th class="adm-hide-sm">Attempts</th><th></th></tr></thead><tbody>
    ${ADM.requests.map(r => `<tr><td class="em">${esc(r.email)}</td><td class="small">${fmtLocal(r.last_at)}</td><td class="adm-hide-sm small">${esc(r.attempts)}</td>
      <td style="text-align:right;white-space:nowrap"><button class="btn sm primary" data-act="grant" data-email="${esc(r.email)}">Add as user</button> <button class="btn sm" data-act="dismiss" data-email="${esc(r.email)}">Dismiss</button></td></tr>`).join('')}
    </tbody></table></div></section>` : '';
  const short = n => n.replace(/ \((Triodian|insurer)\)/, '');
  const perms = `<section class="adm-sec"><h2>Roles and permissions</h2>
    <p class="small soft" style="margin:4px 0 12px">What each role can change. The server checks every save against these rules, including the ones that depend on who did what.</p>
    <div class="tw"><table class="lg perm"><thead><tr><th>Can change</th>${ADM.roles.map(r => `<th class="r">${esc(short(r.name))}</th>`).join('')}</tr></thead><tbody>
    ${ADM.perms.map(p => `<tr><td>${esc(p.what)}</td>${ADM.roles.map(r => p.roles.includes(r.id) ? '<td class="y" aria-label="yes">✓</td>' : '<td class="n" aria-label="no">·</td>').join('')}</tr>`).join('')}
    </tbody></table></div>
    <p class="small soft" style="margin-top:10px">A user with no role can read the assessment but not change it. Administrators can also keep set-up.</p></section>`;
  return `${opening('Admin · users', 'Users and roles', '')}
  ${reqs}
  <section class="adm-sec">
    <div class="row between"><p class="small soft" style="margin:0">${active} active of ${ADM.users.length}. Only active users can open the assessment. Their roles decide what they can change, and everyone with a role appears under People in set-up.</p>
    ${ADM.adding ? '' : '<button class="btn primary" data-act="add">Add user</button>'}</div>
    ${ADM.adding ? `<div class="card" style="margin:14px 0"><h3 class="sh">New user</h3>${userForm(ADM.draft || { isAdmin: false, roles: [] }, true)}</div>` : ''}
    <div class="tw" style="margin-top:12px"><table class="lg adm-users"><thead><tr><th>Name and email</th><th>Roles</th><th>Admin</th><th>Status</th><th class="adm-hide-sm">Last seen</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div>
    <p class="small soft" style="margin-top:10px">Users are deactivated rather than deleted, so their names stay on the work they recorded.</p>
  </section>${perms}`;
}
const AUDIT_NAME = { 'user.create': 'Added user', 'user.update': 'Changed user', 'user.profile': 'Updated own profile', 'user.email_requested': 'Asked to change email', 'user.email': 'Confirmed new email', 'engagement.create': 'Started the assessment', 'engagement.save': 'Saved the assessment', 'engagement.refused': 'Save refused' };
function auditDetail(e) {
  const d = e.detail || {}, v = (k, x) => x === null || x === '' || x === undefined ? '—' : k === 'roles' ? String(x).split(', ').filter(Boolean).map(roleLong).join(', ') || '—' : x;
  if (e.action === 'user.create') return `${d.email || ''}${(d.roles || []).length ? ' · ' + d.roles.map(roleLong).join(', ') : ''}${d.isAdmin ? ' · admin' : ''}${d.reason ? ' · ' + d.reason : ''}`;
  if (e.action === 'user.update' || e.action === 'user.profile') return `${d.email || ''}: ` + Object.entries(d.changed || {}).map(([k, c]) => `${k} ${v(k, c.from)} → ${v(k, c.to)}`).join('; ');
  if (e.action === 'user.email_requested' || e.action === 'user.email') return `${d.from} → ${d.to}`;
  if (e.action === 'engagement.save' || e.action === 'engagement.create') return `revision ${d.revision}${d.changes ? ' · ' + d.changes + ' change' + (d.changes === 1 ? '' : 's') : ''}${d.mergedWith ? ' · merged with changes by ' + d.mergedWith : ''}`;
  if (e.action === 'engagement.refused') return d.reason || '';
  return '';
}
function screenActivity() {
  if (!ADM.loaded) return '<p class="soft" style="padding:40px 0">Loading…</p>';
  return `${opening('Admin · activity', 'Activity', 'User changes and assessment saves, newest first. Detailed edits are in the assessment’s own history.')}
    ${ADM.audit.length ? `<div class="tw"><table class="lg adm-log"><thead><tr><th>When</th><th>Who</th><th>What</th><th class="adm-hide-sm">Details</th></tr></thead><tbody>
    ${ADM.audit.map(e => `<tr><td class="when">${fmtLocal(e.at)}</td><td>${esc(e.actor)}</td><td>${esc(AUDIT_NAME[e.action] || e.action)}</td><td class="adm-hide-sm">${esc(auditDetail(e))}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="soft small">Nothing yet.</p>'}`;
}

/* ---------- profile ---------- */
function screenProfile() {
  const u = SRV.user;
  return `${opening('Your profile', esc(u.name || u.email), '')}
  <div class="stack" style="max-width:720px">
  <section class="card"><h2 class="sh">Your details</h2>
    <form id="profileForm" class="adm-form" novalidate>
      <label class="f">Name<input class="in" id="p-name" value="${esc(u.name)}" autocomplete="name"></label>
      <label class="f">Organisation<input class="in" id="p-org" value="${esc(u.organisation)}" autocomplete="organization"></label>
      ${PRF.err ? `<p class="err acts2" role="alert">${esc(PRF.err)}</p>` : ''}${PRF.msg ? `<p class="small acts2" style="color:var(--green)" role="status">${esc(PRF.msg)}</p>` : ''}
      <div class="acts2"><button class="btn primary sm" type="submit">Save</button><span class="small soft">Your name is shown on the work you record.</span></div>
    </form></section>
  <section class="card"><h2 class="sh">Email address</h2>
    <p>You sign in as <strong>${esc(u.email)}</strong>.</p>
    ${u.pendingEmail ? `<div class="scope" style="margin-top:12px"><span aria-hidden="true">✉</span><span>You asked to change your email to <strong>${esc(u.pendingEmail)}</strong>. To confirm, <a href="/cdn-cgi/access/logout">sign out</a> and sign in again with the new address; a code is sent there. Until then, keep using ${esc(u.email)}. <button class="lnk" data-act="cancelEmail">Cancel the change</button></span></div>`
    : `<form id="emailForm" class="adm-form" novalidate style="margin-top:12px">
      <label class="f">New email address<input class="in" id="p-email" type="email" autocomplete="email"></label>
      ${PRF.emailErr ? `<p class="err acts2" role="alert">${esc(PRF.emailErr)}</p>` : ''}
      <div class="acts2"><button class="btn sm" type="submit">Change email</button><span class="small soft">You confirm it by signing in with the new address.</span></div></form>`}
  </section>
  <section class="card"><h2 class="sh">Dates and times</h2>
    <div class="fgrid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
      <label class="f" for="p-df">Date format<select class="in" id="p-df" data-pref="1">${[['long', '18 October 2026'], ['short', '18 Oct 2026'], ['numeric', '18/10/2026'], ['iso', '2026-10-18']].map(o => `<option value="${o[0]}" ${(u.dateFormat || 'long') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>
      <label class="f" for="p-tz">Time zone<select class="in" id="p-tz" data-pref="1"><option value="">Automatic · this device (${esc(Intl.DateTimeFormat().resolvedOptions().timeZone)})</option>${tzList().map(z => `<option value="${esc(z)}" ${u.timeZone === z ? 'selected' : ''}>${esc(z.replace(/_/g, ' '))}</option>`).join('')}</select></label>
    </div>
    <p class="small soft" style="margin-top:8px">Used on the assessment screens wherever a date or time is shown, for example ${esc(fmtLocal(new Date().toISOString()))}. Outputs always use the full form, such as 18 October 2026.</p>
    ${PRF.prefMsg ? `<p class="small" style="color:var(--green)" role="status">${esc(PRF.prefMsg)}</p>` : ''}</section>
  <section class="card"><h2 class="sh">Access</h2>
    <dl class="kv"><dt>Roles</dt><dd>${(u.roles || []).length ? u.roles.map(r => esc(roleLong(r))).join('<br>') : 'None. You can read the assessment but not change it.'}</dd>
    <dt>Administrator</dt><dd>${u.isAdmin ? 'Yes · <a href="/admin/">open Admin</a>' : 'No'}</dd></dl>
    <p class="small soft" style="margin-top:10px">Roles are given by an administrator.</p></section>
  <p><a class="btn ghost" href="/cdn-cgi/access/logout">Sign out</a></p>
  </div>`;
}

/* ---------- events ---------- */
document.addEventListener('click', async ev => {
  const tab = ev.target.closest('[data-tab]'); if (tab) { TAB = tab.dataset.tab; history.replaceState(null, '', '#' + TAB); render(); return; }
  const el = ev.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act, d = el.dataset;
  if (a === 'add') { ADM.adding = true; ADM.editing = null; ADM.draft = null; ADM.err = ''; render(); }
  else if (a === 'edit') { ADM.editing = d.id; ADM.adding = false; ADM.draft = null; ADM.err = ''; render(); }
  else if (a === 'cancel') { ADM.editing = null; ADM.adding = false; ADM.draft = null; ADM.err = ''; render(); }
  else if (a === 'grant') { ADM.adding = true; ADM.editing = null; ADM.err = ''; ADM.draft = { email: d.email, roles: [], isAdmin: false }; render(); window.scrollTo(0, 0); }
  else if (a === 'dismiss') { await api('POST', '/api/admin/access-requests/dismiss', { email: d.email }); loadAdmin(); }
  else if (a === 'cancelEmail') { const r = await api('DELETE', '/api/me/email'); if (r.ok) SRV.user = r.body.user; render(); }
});
document.addEventListener('change', async ev => {
  if (!ev.target.closest('[data-pref]')) return;
  const val = id => (document.getElementById(id) || {}).value || '';
  const r = await api('PUT', '/api/me/prefs', { dateFormat: val('p-df') || 'long', timeZone: val('p-tz'), notify: !SRV.user || SRV.user.notify !== false });
  if (r.ok) { SRV.user = r.body.user; PRF.prefMsg = 'Saved.'; } else PRF.prefMsg = r.error || 'Could not save.';
  render();
});
document.addEventListener('submit', async e => {
  const f = e.target; if (!['userForm', 'profileForm', 'emailForm'].includes(f.id)) return;
  e.preventDefault();
  const val = id => ((document.getElementById(id) || {}).value || '').trim();
  if (f.id === 'profileForm') { PRF.err = PRF.msg = ''; const r = await api('PUT', '/api/me', { name: val('p-name'), organisation: val('p-org') }); if (r.ok) { SRV.user = r.body.user; PRF.msg = 'Saved.'; } else PRF.err = r.error; return render(); }
  if (f.id === 'emailForm') { PRF.emailErr = ''; const r = await api('POST', '/api/me/email', { email: val('p-email') }); if (r.ok) SRV.user = r.body.user; else PRF.emailErr = r.error; return render(); }
  const id = f.dataset.id;
  const v = { email: val('f-email'), name: val('f-name'), organisation: val('f-org'), roles: [...f.querySelectorAll('input[name="f-role"]:checked')].map(x => x.value), isAdmin: !!(document.getElementById('f-admin') || {}).checked, active: document.getElementById('f-active') ? document.getElementById('f-active').checked : true };
  ADM.draft = Object.assign({ id }, v);
  if (!v.email || !v.name) { ADM.err = 'Enter an email address and a name.'; return render(); }
  const r = id ? await api('PUT', '/api/admin/users/' + encodeURIComponent(id), v) : await api('POST', '/api/admin/users', v);
  if (!r.ok) { ADM.err = r.error; return render(); }
  ADM.err = ''; ADM.adding = false; ADM.editing = null; ADM.draft = null;
  if (id === SRV.user.id) { const me = await api('GET', '/api/me'); if (me.ok) SRV.user = me.body.user; }
  toast(id ? 'Saved ' + v.email : 'Added ' + v.email);
  loadAdmin();
});

(async function boot() {
  const tt = document.getElementById('toast'); if (tt) { tt.className = 'vh'; tt.setAttribute('role', 'status'); }
  render();
  const r = await api('GET', '/api/me');
  SRV.checked = true;
  if (r.ok) { SRV.on = true; SRV.user = r.body.user; SRV.roles = r.body.roles || []; SRV.site = r.body.site || ''; if (AREA === 'admin' && SRV.user.isAdmin) loadAdmin(); }
  else { SRV.code = r.code || ''; SRV.reason = r.error; }
  render();
})();
})();
