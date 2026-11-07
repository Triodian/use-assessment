import { checkSave, deny } from '../lib/core/rbac.js';
const users = [
  { id:'mo', name:'Mo', roles:['methodOwner'], active:true }, { id:'as', name:'Asha', roles:['assessor'], active:true },
  { id:'pr', name:'Pete', roles:['peer'], active:true }, { id:'va', name:'Val', roles:['validation'], active:true },
  { id:'ow', name:'Olu', roles:['owner'], active:true }, { id:'cn', name:'Cass', roles:['counsel'], active:true },
  { id:'ap', name:'AsPeer', roles:['assessor','peer'], active:true }, { id:'ad', name:'Admin', roles:[], isAdmin:true, active:true },
  { id:'gx', name:'Gina', roles:['gc','counsel'], active:true }, { id:'ex', name:'Ed', roles:['executive'], active:true }, { id:'ex2', name:'Eve', roles:['executive'], active:true },
];
const U = id => users.find(u => u.id === id);
const base = () => ({ schema:'triodian.aua.v1', engagement:{ id:'e1', insurer:'Acme', legalPhrases:[], annexText:{}, annexSigned:{by:'',on:''}, handBack:{by:'',on:''} }, people:[], calibration:{}, documents:[], interviews:[],
  arrangements:[{ id:'ARR-01', name:'Claims TPA', findingOwner:'' }], setAgreed:{ gcBy:'', gcOn:'', counselBy:'', counselOn:'', on:'' },
  entries:[{ id:'REG-001', arrangementId:'ARR-01', fields:{ '3':{value:'x'} }, tierProposed:'', classifiedBy:'', consequenceConfirmedBy:'', peerReview:{ personId:'', tier:'' }, dl3Rows:[] }],
  questions:[], findings:[], reviews:[{point:'R2'},{point:'R4'},{point:'R7'}], exceptions:[], independentReviewPoints:[], r5Cleared:{}, diffReports:[], history:[] });
let fails = 0;
const t = (label, who, mutate, expectOk, old) => { const o = old || base(), n = JSON.parse(JSON.stringify(o)); mutate(n); n.history.push({ at:'x', action:'t' }); const r = checkSave(o, n, U(who), users); const okd = !r.error; if (okd !== expectOk) fails++; console.log((okd === expectOk ? 'PASS' : 'FAIL') + ' · ' + label + (r.error ? ' → ' + r.error : '')); };
t('assessor edits a fact', 'as', n => n.entries[0].fields['4'] = { value:'y' }, true);
t('owner cannot edit a fact', 'ow', n => n.entries[0].fields['4'] = { value:'y' }, false);
t('assessor classifies (tier, classifiedBy self)', 'as', n => { n.entries[0].fields['15'] = { value:'A3' }; n.entries[0].classifiedBy = 'as'; }, true);
t('assessor cannot record classification in another name', 'as', n => { n.entries[0].classifiedBy = 'mo'; }, false);
const classified = base(); classified.entries[0].classifiedBy = 'as'; classified.entries[0].fields['15'] = { value:'A3' };
t('peer re-derives an entry someone else classified', 'pr', n => n.entries[0].peerReview = { personId:'pr', tier:'A3' }, true, classified);
t('classifier cannot peer-review own entry (assessor+peer)', 'ap', n => n.entries[0].peerReview = { personId:'ap', tier:'A3' }, false, (() => { const b = base(); b.entries[0].classifiedBy = 'ap'; return b; })());
const reviewed = JSON.parse(JSON.stringify(classified)); reviewed.entries[0].peerReview = { personId:'pr', tier:'A3' };
t('peer reviewer cannot then edit the entry facts', 'pr', n => n.entries[0].fields['4'] = { value:'z' }, false, reviewed);
t('assessor+peer is blind: cannot classify before own R3', 'ap', n => n.entries[0].fields['16'] = { value:'C2' }, false, classified);
t('owner confirms consequence in own name', 'ow', n => { n.entries[0].consequenceConfirmedBy = 'ow'; n.entries[0].consequenceConfirmedOn = '2026-10-18'; }, true);
t('assessor cannot confirm consequence', 'as', n => { n.entries[0].consequenceConfirmedBy = 'as'; }, false);
t('validation person independent → R4 ok', 'va', n => n.reviews[1] = { point:'R4', by:'va', result:'passed' }, true, reviewed);
const vaClassified = JSON.parse(JSON.stringify(reviewed)); vaClassified.entries[0].classifiedBy = 'va';
t('validation person who classified → R4 refused', 'va', n => n.reviews[1] = { point:'R4', by:'va', result:'passed' }, false, vaClassified);
t('counsel answers a question', 'cn', n => n.questions[0].response = 'Answer', true, (() => { const b = base(); b.questions.push({ ref:'QC-01', question:'Q?', response:'', status:'open' }); return b; })());
t('owner cannot ask a question', 'ow', n => n.questions.push({ ref:'QC-01', question:'Q?' }), false);
t('admin edits set-up', 'ad', n => n.engagement.insurer = 'Acme Mutual', true);
t('assessor cannot edit set-up', 'as', n => n.engagement.insurer = 'Acme Mutual', false);
t('method owner signs the annex', 'mo', n => n.engagement.annexSigned = { by:'mo', on:'x' }, true);
t('history cannot be rewritten', 'as', n => { n.history = []; }, false, (() => { const b = base(); b.history.push({ at:'1', action:'a' }); return b; })());
console.log('deny facts no role:', deny('facts', { id:'z', roles:[] }, base()));
// Browser-only keys are ignored and never stored.
t('loadNotes from the browser is ignored; assessor adds an arrangement', 'as', n => { n.loadNotes = []; n.arrangements.push({ id:'ARR-09', name:'x' }); }, true);

// The GC also acts as counsel (development plan task 0.5)
const gcAgreed = (() => { const b = base(); b.setAgreed = { gcBy:'gx', gcOn:'2026-11-06', counselBy:'', counselOn:'', on:'2026-11-06' }; return b; })();
t('without the setting, the same person cannot give the second agreement', 'gx', n => { n.setAgreed.counselBy = 'gx'; n.setAgreed.counselOn = '2026-11-06'; }, false, gcAgreed);
const cnFirst = (() => { const b = base(); b.setAgreed = { gcBy:'', gcOn:'', counselBy:'gx', counselOn:'2026-11-06', on:'2026-11-06' }; return b; })();
t('without the setting, nor the GC agreement after giving counsel’s', 'gx', n => { n.setAgreed.gcBy = 'gx'; n.setAgreed.gcOn = '2026-11-06'; }, false, cnFirst);
t('without the setting, counsel (another person) agrees as usual', 'cn', n => { n.setAgreed.counselBy = 'cn'; n.setAgreed.counselOn = '2026-11-06'; }, true, gcAgreed);
const dual = JSON.parse(JSON.stringify(gcAgreed)); dual.engagement.gcActsAsCounsel = true; dual.engagement.secondApproverId = 'ex';
t('with the setting, the named second approver gives the second agreement', 'ex', n => { n.setAgreed.counselBy = 'ex'; n.setAgreed.counselOn = '2026-11-06'; }, true, dual);
t('with the setting, the GC cannot give it', 'gx', n => { n.setAgreed.counselBy = 'gx'; n.setAgreed.counselOn = '2026-11-06'; }, false, dual);
t('with the setting, counsel cannot give it either', 'cn', n => { n.setAgreed.counselBy = 'cn'; n.setAgreed.counselOn = '2026-11-06'; }, false, dual);
t('with the setting, an executive who is not named cannot give it', 'ex2', n => { n.setAgreed.counselBy = 'ex2'; n.setAgreed.counselOn = '2026-11-06'; }, false, dual);
const noApprover = JSON.parse(JSON.stringify(gcAgreed)); noApprover.engagement.gcActsAsCounsel = true;
console.log('with the setting and no approver named:', deny('agreeCounsel', U('ex'), noApprover));
if (!/Name the second approver/.test(deny('agreeCounsel', U('ex'), noApprover))) fails++;
if (!/One person cannot give both/.test(deny('agreeCounsel', U('gx'), gcAgreed))) { fails++; console.log('FAIL · the refusal gives the reason'); } else console.log('PASS · the refusal gives the reason');
t('the method owner turns the setting on in set-up', 'mo', n => { n.engagement.gcActsAsCounsel = true; n.engagement.secondApproverId = 'ex'; }, true);
t('the GC cannot turn the setting on', 'gx', n => { n.engagement.gcActsAsCounsel = true; }, false);
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
