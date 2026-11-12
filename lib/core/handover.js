// The hand-over (development plan task 7.4, part A). The technology owner and the AI governance team supply the
// inventory, the evidence for each arrangement and what existing assurance covers, and confirm it complete. After that
// they change nothing; counsel, the GC or Triodian can reopen it, with the reason.
//
// A person who holds only those roles is sent the hand-over and nothing else of the assessment: no register, no
// classification, no review, no question to counsel and no finding. What they later read is what counsel releases
// (part B, not built yet). The hand-over is kept in the assessment as data.handover and is changed only through
// PUT /api/handover, never through an ordinary save.
// Cloud-neutral: no Cloudflare, AWS or Azure code here.
import { MANAGEMENT, TRIODIAN } from './roles.js';

export const KINDS = [
  { id: 'inventory', name: 'Inventory', hint: 'A system or use of AI, yours or a provider’s' },
  { id: 'evidence', name: 'Evidence for an arrangement', hint: 'A contract, a due diligence response, test results, a report' },
  { id: 'assurance', name: 'Existing assurance', hint: 'What an audit, a certification or a control test already covers' },
];
const KIND_IDS = KINDS.map(k => k.id);
const text = (v, n) => (typeof v === 'string' ? v.trim() : '').slice(0, n);
const has = (user, ids) => (user.roles || []).some(r => ids.includes(r));

/** Whether this person sees the hand-over only: every role they hold is a management role. */
export const handoverOnly = user => !!user && !user.isAdmin && (user.roles || []).length > 0 && (user.roles || []).every(r => MANAGEMENT.includes(r));
/** Who may ask for the hand-over or reopen it: counsel, the GC, the method owner and the delivery manager. */
export const mayDirect = user => has(user, ['counsel', 'gc', 'methodOwner', 'delivery']);
export const blank = () => ({ request: { by: '', on: '', note: '' }, items: [], complete: { by: '', on: '' }, log: [] });
export const handoverOf = data => { const h = (data && data.handover) || {}; return { ...blank(), ...h, request: { ...blank().request, ...(h.request || {}) }, complete: { ...blank().complete, ...(h.complete || {}) }, items: Array.isArray(h.items) ? h.items : [], log: Array.isArray(h.log) ? h.log : [] }; };
/** Everyone who supplied an item or confirmed the hand-over complete, now or before a reopening. */
export function suppliers(data) {
  const h = handoverOf(data), out = new Set();
  h.items.forEach(i => { if (i.suppliedBy) out.add(i.suppliedBy); });
  if (h.complete.by) out.add(h.complete.by);
  h.log.forEach(l => { if (l.action === 'complete' && l.byId) out.add(l.byId); });
  return out;
}

/** What a person who sees the hand-over only is sent. */
export function viewFor(data, people) {
  const e = (data && data.engagement) || {};
  return { schema: 'triodian.aua.handover.v1', engagement: { insurer: e.insurer || '', reference: e.reference || '', counselFirm: e.counselFirm || '' },
    people: (people || []).map(p => ({ id: p.id, name: p.name, organisation: p.organisation, roles: p.roles })), handover: handoverOf(data), closed: closed(data) };
}
const closed = S => !!(S && ((S.reviews || []).find(r => r && r.point === 'R7') || {}).result === 'complete' && ((S.engagement || {}).handBack || {}).by);

/**
 * Applies one change to the hand-over. body: { action, ... }. Returns { error, status } or { handover, entry } where
 * entry is the line for the change history.
 *   request   { note }                       counsel, the GC, the method owner or the delivery manager asks for it
 *   item      { id?, kind, system, description, where }   a management role adds or changes an item, while it is open
 *   remove    { id }                         a management role removes an item, while it is open
 *   complete  {}                             a management role confirms it complete, in their own name
 *   reopen    { reason }                     counsel, the GC, the method owner or the delivery manager reopens it
 */
export function applyHandover(data, body, user, today) {
  if (!data) return { status: 409, error: 'There is no assessment yet.' };
  if (closed(data)) return { status: 403, error: 'This assessment is closed. Nothing was saved.' };
  const h = JSON.parse(JSON.stringify(handoverOf(data))), b = body && typeof body === 'object' ? body : {}, mgmt = has(user, MANAGEMENT);
  const who = user.name || user.email || user.id, done = !!h.complete.by;
  const note = (action, to) => { h.log.push({ on: today, by: who, byId: user.id, action, ...(to ? { note: to } : {}) }); return { action: 'handover.' + action, target: 'handover', to: to || null }; };
  switch (b.action) {
    case 'request': {
      if (!mayDirect(user)) return { status: 403, error: 'Counsel, the GC, the method owner or the delivery manager asks for the hand-over.' };
      h.request = { by: user.id, on: today, note: text(b.note, 1200) };
      return { handover: h, entry: note('request', h.request.note) };
    }
    case 'item': {
      if (!mgmt) return { status: 403, error: 'The technology owner and the AI governance team supply the hand-over.' };
      if (done) return { status: 409, error: 'The hand-over is confirmed complete. Ask counsel or Triodian to reopen it to add or change an item.' };
      const kind = KIND_IDS.includes(b.kind) ? b.kind : '', system = text(b.system, 200), description = text(b.description, 1200), where = text(b.where, 300);
      if (!kind) return { status: 400, error: 'Choose what the item is: inventory, evidence or existing assurance.' };
      if (!system) return { status: 400, error: 'Name the system, use or arrangement the item is about.' };
      const cur = b.id ? h.items.find(i => i.id === b.id) : null;
      if (b.id && !cur) return { status: 404, error: 'That item is no longer in the hand-over.' };
      if (cur) { Object.assign(cur, { kind, system, description, where }); return { handover: h, entry: note('change', cur.id) }; }
      if (h.items.length >= 400) return { status: 400, error: 'The hand-over holds 400 items at most.' };
      const n = h.items.reduce((m, i) => Math.max(m, +String(i.id).replace(/\D/g, '') || 0), 0) + 1;
      h.items.push({ id: 'H' + n, kind, system, description, where, suppliedBy: user.id, suppliedOn: today });
      return { handover: h, entry: note('add', 'H' + n) };
    }
    case 'remove': {
      if (!mgmt) return { status: 403, error: 'The technology owner and the AI governance team supply the hand-over.' };
      if (done) return { status: 409, error: 'The hand-over is confirmed complete. Ask counsel or Triodian to reopen it to remove an item.' };
      const i = h.items.findIndex(x => x.id === b.id);
      if (i < 0) return { status: 404, error: 'That item is no longer in the hand-over.' };
      h.items.splice(i, 1);
      return { handover: h, entry: note('remove', String(b.id)) };
    }
    case 'complete': {
      if (!mgmt) return { status: 403, error: 'The technology owner or a member of the AI governance team confirms the hand-over complete.' };
      if (done) return { status: 409, error: 'The hand-over is already confirmed complete.' };
      if (!h.items.length) return { status: 400, error: 'Add what you are handing over first.' };
      h.complete = { by: user.id, on: today };
      return { handover: h, entry: note('complete') };
    }
    case 'reopen': {
      if (!mayDirect(user)) return { status: 403, error: 'Counsel, the GC, the method owner or the delivery manager reopens the hand-over.' };
      if (!done) return { status: 409, error: 'The hand-over is still open.' };
      const reason = text(b.reason, 600);
      if (!reason) return { status: 400, error: 'Give the reason for reopening the hand-over.' };
      h.complete = { by: '', on: '' };
      return { handover: h, entry: note('reopen', reason) };
    }
  }
  return { status: 400, error: 'That change to the hand-over is not known.' };
}

/** Independence (task 7.5): the reason a person may not be the independent reviewer, or ''. */
export function independenceError(data, person) {
  if (!person) return '';
  if (has(person, MANAGEMENT)) return 'The technology owner and the AI governance team supply the inventory and the evidence, so they cannot be the independent reviewer.';
  if (suppliers(data).has(person.id)) return 'This person supplied or confirmed the hand-over, so they cannot be the independent reviewer.';
  return '';
}
export { TRIODIAN };
