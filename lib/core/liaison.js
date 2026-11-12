// Updates and consultation with the technology owner and the AI governance team (development plan task 7.4, part B).
// After the hand-over the two roles decide nothing, but they are not left watching:
//
//   update        counsel releases an update: what was classified and how, and where evidence is missing. Counsel
//                 chooses whether any legal determination is included; unless counsel ticks it, none is.
//   contest       either role contests a point in a released update, with the reason and the evidence. An assessor
//                 accepts it and revises, or keeps the position and says why. Both stay on the record and are shown
//                 to the independent reviewer. A contested point changes nothing in the register by itself.
//   consultation  either role asks for a session; counsel or Triodian records it as held, with its outcome.
//   review        counsel asks them to confirm named facts. They see only those facts and answer correct or not
//                 correct, with the correction.
//
// A person who holds only those roles is sent what counsel has released and nothing else (viewOf below, with the
// hand-over in handover.js). The record is kept in the assessment as data.liaison and is changed only through
// PUT /api/liaison, never by an ordinary save. Cloud-neutral: no Cloudflare, AWS or Azure code here.
import { MANAGEMENT } from './roles.js';
import { mayDirect } from './handover.js';

const text = (v, n) => (typeof v === 'string' ? v.trim() : '').slice(0, n);
const has = (user, ids) => (user.roles || []).some(r => ids.includes(r));
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const closed = S => !!(S && ((S.reviews || []).find(r => r && r.point === 'R7') || {}).result === 'complete' && ((S.engagement || {}).handBack || {}).by);
const nextId = (list, prefix) => prefix + (list.reduce((m, x) => Math.max(m, +String(x.id).replace(/\D/g, '') || 0), 0) + 1);

/** Who releases an update or asks for a structured review: counsel, or the GC where set-up says the GC also acts as counsel. */
export const mayRelease = (user, data) => has(user, ['counsel']) || (has(user, ['gc']) && !!((data && data.engagement) || {}).gcActsAsCounsel);
/** Who answers a contested point: an assessor or the method owner. */
export const mayDecide = user => has(user, ['assessor', 'methodOwner']);
export const blank = () => ({ updates: [], contests: [], consultations: [], reviews: [] });
export const liaisonOf = data => { const l = (data && data.liaison) || {}, b = blank(); Object.keys(b).forEach(k => { b[k] = Array.isArray(l[k]) ? l[k] : []; }); return b; };
/** What a person who sees the hand-over only is sent: what counsel released, and their own side of the exchanges. */
export const viewOf = data => liaisonOf(data);

/** One row of an update: an entry's technical position. The legal determinations are kept only when counsel includes them. */
function cleanRow(r, includeLegal) {
  if (!isObj(r)) return null;
  const out = { entryId: text(r.entryId, 64), arrangement: text(r.arrangement, 200), system: text(r.system, 300), tier: text(r.tier, 80), consequence: text(r.consequence, 80),
    indicativeRung: text(r.indicativeRung, 80), obtainableRung: text(r.obtainableRung, 80), confidence: text(r.confidence, 80),
    missing: (Array.isArray(r.missing) ? r.missing : []).slice(0, 30).map(x => text(x, 200)).filter(Boolean) };
  if (!out.entryId) return null;
  if (includeLegal) out.legal = (Array.isArray(r.legal) ? r.legal : []).slice(0, 8).filter(isObj).map(x => ({ label: text(x.label, 200), value: text(x.value, 2000) })).filter(x => x.label && x.value);
  return out;
}

/**
 * Applies one change. body: { action, ... }. Returns { error, status } or { liaison, entry, notify } where entry is the
 * line for the change history and notify says who should hear ('management', 'counsel', 'assessors' or 'directors').
 */
export function applyLiaison(data, body, user, today) {
  if (!data) return { status: 409, error: 'There is no assessment yet.' };
  if (closed(data)) return { status: 403, error: 'This assessment is closed. Nothing was saved.' };
  const L = JSON.parse(JSON.stringify(liaisonOf(data))), b = isObj(body) ? body : {}, mgmt = has(user, MANAGEMENT);
  const done = (action, to, notify) => ({ liaison: L, entry: { action: 'liaison.' + action, target: 'liaison', to: to || null }, notify });
  switch (b.action) {
    case 'release': {
      if (!mayRelease(user, data)) return { status: 403, error: 'Only counsel releases an update to the technology owner and the AI governance team.' };
      const includeLegal = b.includeLegal === true, rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, 400).map(r => cleanRow(r, includeLegal)).filter(Boolean);
      const stage = text(b.stage, 120), note = text(b.note, 2000);
      if (!stage) return { status: 400, error: 'Say which stage the update is for.' };
      if (!rows.length && !note) return { status: 400, error: 'An update holds at least one entry or a note.' };
      const id = nextId(L.updates, 'U');
      L.updates.push({ id, stage, note, includeLegal, rows, releasedBy: user.id, releasedOn: today });
      return done('release', `${id} · ${stage}${includeLegal ? ' · with legal determinations' : ''}`, 'management');
    }
    case 'contest': {
      if (!mgmt) return { status: 403, error: 'The technology owner and the AI governance team contest a point in an update.' };
      const u = L.updates.find(x => x.id === b.updateId), row = u && u.rows.find(r => r.entryId === b.entryId);
      if (!u || (b.entryId && !row)) return { status: 404, error: 'That point is not in a released update.' };
      const reason = text(b.reason, 2000), evidence = text(b.evidence, 2000);
      if (!reason) return { status: 400, error: 'Give the reason you contest the point.' };
      if (!evidence) return { status: 400, error: 'Name the evidence the point rests on, and where it is held.' };
      const id = nextId(L.contests, 'C');
      L.contests.push({ id, updateId: u.id, entryId: row ? row.entryId : '', by: user.id, on: today, reason, evidence, status: 'open', decision: '', decidedBy: '', decidedOn: '' });
      return done('contest', `${id} on ${row ? row.entryId : u.id}`, 'assessors');
    }
    case 'decide': {
      if (!mayDecide(user)) return { status: 403, error: 'An assessor or the method owner answers a contested point.' };
      const c = L.contests.find(x => x.id === b.id);
      if (!c) return { status: 404, error: 'That contested point is not on the record.' };
      if (c.status !== 'open') return { status: 409, error: 'That contested point is already answered.' };
      const outcome = b.outcome === 'accepted' ? 'accepted' : b.outcome === 'kept' ? 'kept' : '', decision = text(b.decision, 2000);
      if (!outcome) return { status: 400, error: 'Record whether the point is accepted or the position is kept.' };
      if (!decision) return { status: 400, error: outcome === 'accepted' ? 'Say what is revised.' : 'Say why the position is kept.' };
      Object.assign(c, { status: outcome, decision, decidedBy: user.id, decidedOn: today });
      return done('decide', `${c.id} ${outcome}`, 'management');
    }
    case 'askConsultation': {
      if (!mgmt) return { status: 403, error: 'The technology owner and the AI governance team ask for a consultation.' };
      const topic = text(b.topic, 1200);
      if (!topic) return { status: 400, error: 'Say what the consultation is about.' };
      const id = nextId(L.consultations, 'S');
      L.consultations.push({ id, askedBy: user.id, askedOn: today, topic, heldOn: '', outcome: '', recordedBy: '' });
      return done('askConsultation', id, 'directors');
    }
    case 'holdConsultation': {
      if (!mayDirect(user)) return { status: 403, error: 'Counsel, the GC, the method owner or the delivery manager records a consultation as held.' };
      const s = L.consultations.find(x => x.id === b.id);
      if (!s) return { status: 404, error: 'That consultation is not on the record.' };
      const heldOn = /^\d{4}-\d{2}-\d{2}$/.test(b.heldOn || '') ? b.heldOn : '', outcome = text(b.outcome, 2000);
      if (!heldOn) return { status: 400, error: 'Give the date the consultation was held.' };
      if (!outcome) return { status: 400, error: 'Record the outcome of the consultation.' };
      Object.assign(s, { heldOn, outcome, recordedBy: user.id });
      return done('holdConsultation', s.id, 'management');
    }
    case 'askReview': {
      if (!mayRelease(user, data)) return { status: 403, error: 'Only counsel asks the technology owner and the AI governance team to confirm facts.' };
      const facts = (Array.isArray(b.facts) ? b.facts : []).map(x => text(x, 600)).filter(Boolean).slice(0, 40);
      if (!facts.length) return { status: 400, error: 'List the facts to confirm, one to a line.' };
      const id = nextId(L.reviews, 'F');
      L.reviews.push({ id, askedBy: user.id, askedOn: today, note: text(b.note, 1200), facts: facts.map((t, i) => ({ id: id + '.' + (i + 1), text: t, answer: '', correction: '', answeredBy: '', answeredOn: '' })) });
      return done('askReview', `${id} · ${facts.length} fact${facts.length === 1 ? '' : 's'}`, 'management');
    }
    case 'answerFact': {
      if (!mgmt) return { status: 403, error: 'The technology owner and the AI governance team confirm the facts.' };
      const f = L.reviews.flatMap(r => r.facts).find(x => x.id === b.id);
      if (!f) return { status: 404, error: 'That fact is not in a review.' };
      if (f.answer) return { status: 409, error: 'That fact is already answered.' };
      const answer = b.answer === 'correct' ? 'correct' : b.answer === 'incorrect' ? 'incorrect' : '', correction = text(b.correction, 1200);
      if (!answer) return { status: 400, error: 'Answer correct or not correct.' };
      if (answer === 'incorrect' && !correction) return { status: 400, error: 'Give the correction.' };
      Object.assign(f, { answer, correction: answer === 'incorrect' ? correction : '', answeredBy: user.id, answeredOn: today });
      return done('answerFact', `${f.id} ${answer === 'correct' ? 'correct' : 'not correct'}`, 'counsel');
    }
  }
  return { status: 400, error: 'That change is not known.' };
}

/** What is waiting, for the screens and the reviewer's pack. */
export function openItems(data) {
  const L = liaisonOf(data);
  return { contests: L.contests.filter(c => c.status === 'open'), consultations: L.consultations.filter(s => !s.heldOn), facts: L.reviews.flatMap(r => r.facts).filter(f => !f.answer) };
}
