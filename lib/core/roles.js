// Roles for the AI Use Assessment. A person may hold several roles (for example assessor and peer reviewer).
// What each role may change is decided per change in rbac.js, because several rules depend on who did what
// (a peer reviewer may not review an entry they classified, validation must be independent, and so on).
// Cloud-neutral: no Cloudflare, AWS or Azure code here.

export const ROLES = [
  { id: 'methodOwner', name: 'Method owner (Triodian)' },
  { id: 'assessor', name: 'Assessor (Triodian)' },
  { id: 'peer', name: 'Peer reviewer (Triodian)' },
  { id: 'validation', name: 'Validation (Triodian)' },
  { id: 'delivery', name: 'Delivery manager (Triodian)' },
  { id: 'counsel', name: 'Counsel' },
  { id: 'gc', name: 'GC' },
  { id: 'owner', name: 'Arrangement owner (insurer)' },
  { id: 'ir', name: 'Independent reviewer' },
  { id: 'cro', name: 'CRO (insurer)' },
  // Where the GC also acts as counsel (development plan task 0.5), the second agreement at R1 comes from this person.
  { id: 'executive', name: 'Second approver (company executive)' },
];
export const ROLE_IDS = ROLES.map(r => r.id);
export const TRIODIAN = ['methodOwner', 'assessor', 'peer', 'validation', 'delivery'];

/** Summary for the Admin page: what each role may do. */
export const PERMISSIONS = [
  { what: 'Set-up: engagement details, documents, interviews, calibration', roles: ['methodOwner', 'delivery'] },
  { what: 'The set of arrangements', roles: ['methodOwner', 'assessor', 'delivery'] },
  { what: 'GC agreement to the set (R1)', roles: ['gc'] },
  { what: 'Counsel agreement to the set (R1)', roles: ['counsel'] },
  { what: 'Second agreement to the set (R1), where the GC also acts as counsel: the named second approver', roles: ['executive'] },
  { what: 'Register facts, fields 1 to 14 (not on entries they peer-review)', roles: ['assessor', 'methodOwner'] },
  { what: 'Classification, fields 15 to 17 (not on entries they peer-review)', roles: ['assessor', 'methodOwner'] },
  { what: 'Confirm the failure consequence', roles: ['owner'] },
  { what: 'Blind peer re-derivation, R3 (not on entries they classified)', roles: ['peer'] },
  { what: 'Completeness check, R2', roles: ['delivery'] },
  { what: 'Validation, R4 (only if they classified or reviewed nothing)', roles: ['validation'] },
  { what: 'Legal-line hits and phrase list, R5', roles: ['methodOwner'] },
  { what: 'Counsel review, R6', roles: ['counsel'] },
  { what: 'Independent review complete, R7', roles: ['ir', 'cro'] },
  { what: 'Questions to counsel', roles: TRIODIAN },
  { what: 'Responses from counsel', roles: ['counsel', ...TRIODIAN] },
  { what: 'Independent review points: log, close', roles: ['ir'] },
  { what: 'Independent review points: respond', roles: TRIODIAN },
  { what: 'Exceptions, finding owners, deliverable details', roles: TRIODIAN },
  { what: 'Annex text and signature (DL5)', roles: ['methodOwner'] },
  { what: 'Accept the hand-back list (DL6)', roles: ['owner'] },
];
