# AI Use Assessment App: Build Specification

*Triodian · Draft for build · 12 October 2026*

This specification converts the **AI Use Assessment Framework** into a working web app. The app runs on desktop, tablet and phone. It uses the design system of the Semantic Enforcement Suite app, extended with mobile layouts and term popovers, in the same way as the **AI Risk Appetite App** specification. The two apps share one interface library and exchange two files: the calibration set (appetite to assessment) and the register extract (assessment to appetite).

The framework document is the source of truth for content: register fields, the seven questions, scales, tests, findings, deliverables and review points. This specification also builds in changes agreed since the framework was last saved. Section 0.2 lists them; the framework should be updated to match before build starts.

---

## 0. Build format and constraints

### 0.1 Format

| Item | Position |
| --- | --- |
| Form | A working single-page app, not a mock. Every screen takes input, applies the rules in section 7 and produces the outputs in section 10 |
| Files | `index.html`, `app.js`, `content.json` (framework text, questions, prompts, glossary), plus the shared `triodian-ui.css`, `triodian-ui.js` and `triodian-mark.svg` built for the AI Risk Appetite app |
| Libraries | None required. If a framework is used, load React 18 UMD from cdnjs, pinned to an exact version, as in the appetite app |
| Fonts | Google Fonts only: Playfair Display, Source Sans 3, IBM Plex Mono, each with a system fallback |
| Data | No database and no server. State in memory, saved and reopened as an engagement file (JSON). See section 10.4 |
| Network | None after the page loads, apart from fonts. No client information leaves the browser |
| Theme | Light only, matching the template |
| Template code | Reuse the template's tokens, layouts and patterns, not its Claude Design runtime |

**Footer banner (always visible):** *Technical assessment prepared for counsel. It states what documents show and how AI uses are classified. It gives no legal advice and recommends no product.*

### 0.2 Changes to the framework built into this app

| # | Change | Source |
| --- | --- | --- |
| 1 | "NRF" and "Norton Rose Fulbright" become **counsel** throughout | Instruction of 12 October 2026 |
| 2 | The independent reviewer (Finity, in the first engagement) reviews Triodian's assessment **on behalf of the CRO**. The app shows the role, never the firm. Whether it is engaged through counsel or directly by the CRO is a set-up choice (section 5.3) | Instruction of 12 October 2026; reporting line still open |
| 3 | A loaded calibration set replaces the **indicative rung** with the **expected rung** | AI Risk Appetite Framework, 2.5 and 11.4 |
| 4 | **Above ceiling** and **location** flags added to each register entry and worksheet | AI Risk Appetite Framework, 2.4 and 11.4 |
| 5 | A sixth selection criterion: arrangements likely to sit above the authority ceiling | AI Risk Appetite Framework, 2.3 |
| 6 | Findings carry a **due date** and **interim position** from the calibration set | AI Risk Appetite Framework, 9.1 (P5) |
| 7 | Every output records the **calibration status and version** | AI Risk Appetite Framework, 9.3 |

---

## 1. What the app does

The app takes an assessment through the framework's eight phases:

| Phase | In the app |
| --- | --- |
| 0 Mobilise | Set-up: engagement, people, privilege marking, document requests, calibration set |
| 1 Confirm the set | Arrangements selected against six criteria and agreed with the GC |
| 2 Map the AI | Register entries built, fields 1 to 14, each value sourced |
| 3 Classify and test | Authority, consequence, expected rung, obtainability test, independent re-derivation, validation |
| 4 Questions to counsel | Question log; counsel's determinations recorded against fields 23 to 25 |
| 5 Findings and report | One finding per arrangement; worksheets, technical schedule and annex generated |
| 6 Independent check | Review pack issued to the independent reviewer; points logged and closed |
| 7 Close | Hand-back list, final register, closing measures, exports |

Each phase has an exit gate. The app shows whether it is met and what is missing; it does not stop anyone working ahead, but it marks every output produced before a gate is met as draft.

---

## 2. Users and roles

No sign-in. The user picks a person from the set-up list in the header's role pill; the person's role sets what the app permits.

| Role | Can do | Cannot do |
| --- | --- | --- |
| Method owner (Triodian) | Everything Triodian can do; sign the technical annex; run the legal-line check (R5) | Enter counsel's determinations except by transcription (section 7.6) |
| Assessor (Triodian) | Build the register, classify, run the obtainability test, draft questions and findings | Act as peer reviewer on an entry they classified |
| Peer reviewer (Triodian) | Re-derive tiers blind (R3), resolve differences | Review an entry they classified |
| Validation (Triodian) | Run R4; record exceptions | Edit classifications |
| Delivery manager (Triodian) | Document requests, interviews, completeness check (R2), exceptions log | Classify |
| Counsel | Agree the set (with the GC), answer questions, enter determinations, review drafts (R6) | Edit facts, classifications or test results |
| GC | Agree the brief and the set | Edit the register |
| Arrangement owner (insurer) | Confirm failure consequence (question 6); accept hand-back items | Edit classifications |
| Independent reviewer | Read the review pack; log review points; mark R7 complete | Edit anything else |

Each person is set up once with name, organisation and role. A person may hold more than one Triodian role, but the app enforces the separations in section 7.5 by person, not by role.

---

## 3. Design system

Identical to the AI Risk Appetite App specification, section 3. Both apps load the same `triodian-ui.css`; nothing is redefined here. In summary:

- **Tokens:** the template's palette unchanged: parchment, card, ink (three weights), rules, and green, ochre, red, grey, slate, aubergine, copper and navy, each with its light background.
- **Type:** Playfair Display for screen headlines (38px, 28px on phones); Source Sans 3 for body (15px) and labels; IBM Plex Mono for codes, IDs, rungs and badges.
- **Layout:** 1160px column; 32, 20 and 16px side padding on desktop, tablet and phone; screen opening with the short ink rule, eyebrow, headline and sub-headline; cards with 12px radius.
- **Components:** header, app switcher, lifecycle badge, gate indicator, ledger table, record card, footer with scope banner, entry overlay, Present mode.

**Differences from the appetite app:**

| Item | Appetite app | This app |
| --- | --- | --- |
| Header accent (3px top rule and status dot) | Aubergine #4E3A5E | **Navy #182635**, ring #E3E9EF, as defined in the template |
| App code | RAF-01 | AUA-01 |
| Logo colour | Aubergine | Aubergine (brand mark is the same colour in both apps) |
| Links and popover underline | Aubergine | Aubergine (shared library) |

The different header accent tells the user which app they are in; the logo stays constant.

**Semantic colour for this app's states:**

| State | Token |
| --- | --- |
| F1 evidence obtainable, test passed, gate met | Green |
| F2 gap, test failed, below minimum confidence | Red |
| F3 no reasonable reach | Slate |
| F4 not determinable, not known, open question | Ochre |
| Above ceiling, location not accepted | Red badge with text label |
| Draft (gate not met), uncalibrated | Grey |

---

## 4. Header and logo

As the AI Risk Appetite App specification, section 4, with these values:

- Triodian mark top left at every width, `--aubergine`, 22px (20px on phones); wordmark "Triodian" beside it on desktop and tablet.
- App title "AI Use Assessment"; code `AUA-01`; status dot and 3px top rule in `--navy`.
- Desktop step navigation: Set-up · Set · Register · Classify · Counsel · Findings · Review · Outputs.
- Right side: calibration badge (uncalibrated · working v*n* · approved v*n*), Present toggle, role pill, menu.
- Tablet and phone: steps move to the drawer; phones show the mark, title and menu only, and a bottom step bar.
- The app switcher lists both apps. Opening the appetite app from here offers to pass the current register extract.

---

## 5. Screens

### 5.1 Map

| # | Screen | Purpose | Framework section |
| --- | --- | --- | --- |
| S0 | Entry | New engagement, open file, open worked example | — |
| S1 | Set-up | Engagement, people, privilege marking, independent reviewer and reporting line, calibration set, documents, interviews | 4, 5 |
| S2 | Overview | The eight phases with gates; counts of entries, open questions, findings | 5.1 |
| S3 | Set | Arrangements, selection criteria, GC agreement | 2.2 |
| S4 | Register | All entries; entry editor for fields 1 to 26 | 6 |
| S5 | Classify and test | Authority, consequence, expected rung, obtainability test, blind re-derivation | 7, 8 |
| S6 | Questions to counsel | Question log and determinations | 7, 9.5 |
| S7 | Findings | One worksheet per arrangement; summary table | 9 |
| S8 | Review | R1 to R7, exceptions log, independent review points | 11 |
| S9 | Outputs | DL1 to DL6, question set, review pack, closing measures, exports | 10, 11.5 |
| S10 | Reference | Scales, seven questions, tests, glossary, framework text | 7, 8 |

### 5.2 S0 Entry

As the appetite app's entry overlay, with actions **New assessment**, **Open assessment file**, **Open worked example**. The worked example is built around the framework's illustration (section 8.5): an outside claims manager whose triage model routes motor claims. It is labelled fictional on every screen.

### 5.3 S1 Set-up

Cards:

1. **Engagement:** insurer, reference, counsel firm, privilege marking (as counsel directs; printed on every output), start date.
2. **People:** name, organisation, role or roles.
3. **Independent reviewer:** the person and organisation filling the role, and the reporting line: *through counsel* or *directly to the CRO*. Sets who the review pack is addressed to and who confirms R7.
4. **Calibration set:** **Load calibration set** (JSON from the appetite app). Shows status, version, date, approver and any parameters that fell back to default. Without one, a grey banner reads "Uncalibrated: framework defaults apply" on every screen and output.
5. **Documents D1 to D10:** tracker with requested, received, not held, and date; each received document gets a short ID used in source references (for example `D5-ARR02 p.14`).
6. **Interviews:** tracker of the framework's interview list, with date held and notes reference.

Exit gate (phase 0): brief confirmed by the GC (date and reference), privilege marking entered, document request issued.

### 5.4 S3 Set

A table of arrangements (ARR-01 onward): parties, boundary types covered, criteria met (1 to 6, as tick boxes), reason selected, next contracting date. A coverage strip above the table shows whether B1, B2 and B3 are each represented and whether authority is spread (criteria 4 and 5).

Criterion 6 (likely above ceiling) is available only with a calibration set loaded, and shows the ceiling for the arrangement's function.

**Agree the set** records the GC's and counsel's agreement with date; this is review point R1 and the phase 1 gate.

### 5.5 S4 Register

**List view.** Desktop: a ledger table with REG ID, arrangement, boundary, where the AI acts, system, tier, consequence, expected rung, obtainable rung, finding, flags and completeness. Filter by arrangement, boundary, finding, flag or "has not known". Phone: one card per entry with the same values as badges.

**Entry editor.** Fields grouped in five tabs, matching the phases:

| Tab | Fields | Phase |
| --- | --- | --- |
| Facts | 1 to 14 | 2 |
| Classify | 15 to 17, flags | 3 |
| Evidence | 18 to 22 | 3 |
| Counsel | 23 to 25 (read-only except by transcription) | 4 |
| Finding | 26 | 5 |

Every field has, beside it: a **source** picker (document ID and page, or interview and date), a **not known** toggle, and a history icon. Field 11 must be saved before field 15 can be set.

### 5.6 S5 Classify and test

Works one entry at a time, as a guided sequence:

1. **Authority (question 5).** The three deciding tests from the framework as yes/no questions, each needing a source. The app proposes a tier from the answers and field 12 (section 7.2). The assessor accepts it or overrides with a written reason.
2. **Consequence (question 6).** C1 to C5 with the insurer's thresholds shown from the calibration set (P2), or the generic definitions if uncalibrated. The arrangement owner's confirmation is recorded.
3. **Expected rung.** Computed (section 7.3) and shown with how it was derived: the calibration cell used, or the base rule and any adjustment.
4. **Obtainability test.** A stepper starting at the expected rung. For each rung: T1 to T5, each pass or fail with a source. A failed condition steps down one rung. The rung where all five pass becomes the obtainable rung. Confidence is set from the evidence type (section 7.4).
5. **Blind re-derivation (R3).** A different person, the peer reviewer, sees fields 11 to 13 only and sets a tier. If it differs, both positions are kept and a resolution is required.

Flags shown on completion: above ceiling (P1), location marking (P8), below minimum confidence (P7), not-known count against limit (P6).

### 5.7 S6 Questions to counsel

Ledger with the framework's template fields: reference (QC-01 onward), arrangement and entry, which of the seven questions, facts with sources, the question, why it matters, response, status. A question can be raised from any field with **Ask counsel**, which pre-fills the reference, entry and facts.

The phase 4 gate is met when every question is answered or recorded as open with an owner.

### 5.8 S7 Findings

One worksheet per arrangement, assembled from the register in the framework's parts A to J. The app sets the finding type (section 7.7) and shows it as a large badge. Part I carries gap size, priority, failed test, owner, routes available, and, when calibrated, due date and interim position. Above-ceiling and location flags appear in a separate band, never merged into the evidence finding.

A summary table above the worksheets gives, per arrangement: tier, consequence, expected, required, obtainable, finding, priority, flags.

### 5.9 S8 Review

- **Review points R1 to R7** as a checklist with reviewer, date and result. R3 and R4 link to their records in S5.
- **Legal-line check (R5):** the app scans every draft output for phrases on a configurable list (for example "must comply", "is required by", "breach of", "non-compliant", product names) and lists each hit for the method owner to clear or change.
- **Exceptions log:** departure, reason, approved by, date.
- **Independent review points:** reference, output and section, point, response, status. R7 is complete when every point is closed or disclosed.

### 5.10 S9 Outputs

Tabs for each deliverable in section 10.1. Each shows a rendered preview and the markdown, with **Copy** and **Download**. Every output header carries: privilege marking, calibration status and version, draft or final, and the date.

### 5.11 S10 Reference

The seven questions with their scales; authority tiers, consequence levels and evidence rungs (with the insurer's calibrated thresholds where loaded); tests T1 to T5; finding types; the glossary; and the framework text, read-only.

---

## 6. Data model

```json
{
  "schema": "triodian.aua.v1",
  "engagement": { "id": "", "insurer": "", "reference": "", "counselFirm": "", "privilegeMarking": "", "briefConfirmed": { "by": "", "on": "", "ref": "" }, "independentReviewerReportsTo": "counsel|cro", "example": false },
  "people": [ { "id": "", "name": "", "organisation": "", "roles": [] } ],
  "calibration": { "loaded": false, "status": "default|working|approved", "version": 0, "date": "", "approvedBy": "", "fellBack": [], "parameters": {} },
  "documents": [ { "id": "D5-ARR02", "ref": "D5", "title": "", "status": "requested|received|notHeld", "date": "" } ],
  "interviews": [ { "id": "", "who": "", "date": "", "notesRef": "" } ],
  "arrangements": [ { "id": "ARR-01", "parties": [], "boundaries": [], "criteria": [], "reason": "", "nextContracting": "", "agreed": { "by": [], "on": "" } } ],
  "entries": [ {
    "id": "REG-001", "arrangementId": "ARR-01",
    "fields": { "3": { "value": "B1", "source": "D3 p.2", "notKnown": false, "by": "", "on": "" } },
    "authorityTests": [ { "test": 1, "answer": true, "source": "" } ],
    "tierProposed": "", "tierOverrideReason": "",
    "consequenceConfirmedBy": "",
    "expectedRung": { "value": "", "basis": "calibration|baseRule", "adjustment": "" },
    "obtainability": [ { "rung": "E4", "tests": { "T1": { "pass": true, "source": "" } } } ],
    "peerReview": { "personId": "", "tier": "", "differs": false, "resolution": "" },
    "flags": { "aboveCeiling": false, "location": "accepted|escalate|notAccepted", "belowConfidence": false, "notKnownOverLimit": false },
    "classifiedBy": "", "reviewedBy": ""
  } ],
  "questions": [ { "ref": "QC-01", "arrangementId": "", "entryId": "", "question7": 3, "facts": "", "question": "", "why": "", "response": "", "respondedOn": "", "status": "open|answered|openWithOwner", "owner": "" } ],
  "findings": [ { "arrangementId": "", "type": "F1|F2|F3|F4", "gapSize": 0, "priority": "", "failedTest": "", "owner": "", "routes": [], "dueDate": "", "interimPosition": "" } ],
  "reviews": [ { "point": "R1", "by": "", "on": "", "result": "", "notes": "" } ],
  "exceptions": [ { "ref": "", "departure": "", "reason": "", "approvedBy": "", "on": "" } ],
  "independentReviewPoints": [ { "ref": "IR-01", "output": "", "section": "", "point": "", "response": "", "status": "open|closed|disclosed" } ],
  "history": [ { "at": "", "by": "", "action": "", "target": "", "from": null, "to": null } ]
}
```

Register fields are keyed by their framework number (1 to 26) so the mapping to the framework stays exact.

---

## 7. Rules

### 7.1 Completion

As framework section 6.3: every value sourced or marked not known; field 11 before field 15; fields 23 to 25 only by transcription; not known counted; confidence low by default at B2; classifier and peer reviewer different people.

### 7.2 Authority tier proposal

The app proposes the highest tier any answer supports; the assessor confirms or overrides with a reason.

| Evidence | Proposed tier |
| --- | --- |
| Field 12 "a person acts" | A1 |
| Field 12 "a person decides" | A2 |
| Test 1: the output takes effect without a person | A3 |
| Test 2: the output moves money, changes a policy or claim record, or commits the insurer | A4 |
| Test 3: the AI acts across steps or systems without a person starting each step | A5 |
| Field 13 lists write access to a system of record under the AI's own credentials | A6 |

### 7.3 Expected rung

- **Calibrated:** `P3[tier][consequence]` from the loaded calibration set.
- **Uncalibrated:** the framework's base rule (A1→E1 … A6→E6) with the proposed adjustment (C1 with A1 or A2: down one; C4 or C5 with A1 to A4: up one, capped at E6). This equals the appetite framework's Appendix A table.
- The basis is stored and printed on the worksheet.

### 7.4 Obtainability and confidence

- Start at the expected rung; test T1 to T5; step down on any failure; stop at the first rung where all five pass, or at E0.
- Q5 at A1 with Q6 at C1 (stop rule): test only whether disclosure exists.
- Confidence: high if the record has been seen (source is a received D7, D8 or D9 item showing it); medium if a document describes it; low if inferred. At B2, low unless field 14 or a D7 item supports a higher level.
- With a calibration set, flag **below minimum confidence** where confidence is under P7 for the consequence band.

### 7.5 Separation of duties

- The peer reviewer for R3 must be a different person from the classifier of that entry.
- The R4 validator must not have classified or reviewed any entry in the set.
- The person signing the annex must not be the only peer reviewer of any entry.
- The app blocks the action and explains the rule in a popover when a separation would be broken.

### 7.6 Counsel's determinations

- Fields 23 to 25 can be filled only from an answered question in S6, citing its reference.
- Counsel may enter the response directly. A Triodian person may transcribe it, in which case the app records "transcribed by" and requires the response to be pasted verbatim.
- These fields cannot be edited after entry except by recording a new answered question.

### 7.7 Finding type

| Condition, in order | Finding |
| --- | --- |
| Documents do not show whether AI is used, or what it can do (stop rule) | F4 |
| Counsel has determined no reasonable reach (Q1 to Q3 negative, or explicit determination) | F3 |
| Obtainable rung ≥ required rung | F1 |
| Obtainable rung < required rung | F2 |
| Required rung not yet determined | No finding; shown as "awaiting counsel" |

For F2: gap size = required − obtainable; priority from P4 if calibrated, otherwise the framework matrix; failed test is the first test that failed at the required rung; owner and routes from framework section 9.3; due date and interim position from P5 if calibrated.

### 7.8 Flags from the calibration set

| Flag | Rule | Parameter |
| --- | --- | --- |
| Above ceiling | Field 15 tier is higher than the ceiling for the entry's function and location in the chain | P1 |
| Location | Marking for where the provider is established and where the AI runs | P8 |
| Below minimum confidence | Field 22 below the minimum for the consequence band | P7 |
| Not known over limit | Not-known count for the entry exceeds the limit for its consequence band | P6 |
| F4 standing too long | An F4 finding older than the allowed period | P6 |
| Concentration | Share of critical operations in the set depending on one platform or model provider, against P9 | P9 |

Flags are reported beside findings, never as part of them.

### 7.9 Calibration version change

Loading a new calibration version recomputes expected rungs, flags, priorities and due dates. Facts, classifications, test results and counsel's determinations are not changed. The app produces a **difference report** listing every entry and finding whose result changed, from what to what. Obtainability tests started at a now-different expected rung are marked for re-test.

### 7.10 Gates

| Phase | Gate |
| --- | --- |
| 0 | Brief confirmed; privilege marking entered; documents requested |
| 1 | Set agreed by GC and counsel; B1, B2, B3 each represented or the gap recorded as an exception |
| 2 | Fields 1 to 14 complete or not known for every entry; every value sourced (R2) |
| 3 | Fields 15 to 22 complete; R3 differences resolved; R4 passed |
| 4 | Every question answered or open with owner |
| 5 | Every arrangement has a finding or is awaiting counsel; R5 cleared; R6 recorded |
| 6 | R7 complete |
| 7 | Hand-back list accepted |

---

## 8. Term popovers

Same component, appearance and behaviour as the AI Risk Appetite App specification, section 8: dotted aubergine underline, click or tap to open, anchored card on desktop, bottom sheet on phones, one open at a time, text from `content.json`. The glossary is shared between the apps; this app adds the terms below.

| Term | Definition (draft) | Where it is used |
| --- | --- | --- |
| Arrangement | One relationship assessed: a provider, the platform behind it, or an external AI service staff use | Set, Findings |
| Representative set | The arrangements the GC agrees to assess, chosen against six criteria | Set |
| Register entry | One place AI acts within an arrangement, recorded in 26 fields | Register |
| Boundary | Where evidence must cross between parties: B1 insurer to provider, B2 provider to platform, B3 insurer's own use | Set, Register |
| Seven questions | The ordered questions put to every arrangement, from nexus to evidence | Classify, Counsel |
| Nexus | Whether a party falls within the insurer's group for CPS 230 purposes. Counsel's determination | Counsel |
| Rights held | What the insurer can require of a party: passive, significant influence, contractual, or control | Counsel |
| Source reference | The document and page, or interview and date, behind a value | Every field |
| Expected rung | The evidence the board expects for this authority and consequence, from the calibration set | Classify |
| Indicative rung | The framework's default rung when no appetite is loaded | Classify |
| Required rung | The evidence the insurer can reasonably require at this boundary, as determined with counsel | Counsel, Findings |
| Obtainable rung | The highest rung that passes all five obtainability tests | Classify, Findings |
| Obtainability test | Five conditions, T1 to T5: produced, aggregate, reachable, checkable, timely | Classify |
| Produced (T1) | A record of this type exists, or could be generated without redesign | Classify |
| Aggregate (T2) | The record can be given without individual decisions, policyholder data or the model | Classify |
| Reachable (T3) | There is a term in force, or a contracting point, by which the record can reach the insurer | Classify |
| Checkable (T4) | Someone independent of the producer can verify it | Classify |
| Timely (T5) | It can arrive in time for the insurer to act and meet its own notification obligations | Classify |
| F1 Evidence obtainable | The obtainable rung meets the required rung | Findings |
| F2 Gap | The obtainable rung falls short of the required rung | Findings |
| F3 No reasonable reach | Counsel has determined the insurer cannot reasonably require evidence here. A conclusion, not a gap | Findings |
| F4 Not determinable | The documents cannot show whether, or how, AI is used | Findings |
| Blind re-derivation | A second person sets the tier from the facts alone, without seeing the first classification | Classify, Review |
| Peer reviewer | The Triodian person who re-derives a tier blind. Never the person who classified the entry | Classify, Review |
| Independent reviewer | The party outside Triodian that checks whether the assessment is sound and its findings supported, on behalf of the CRO | Review, Outputs |
| Question to counsel | A numbered written question for a legal determination. Never answered in a working paper | Counsel |
| Transcribed | Counsel's response entered verbatim by a Triodian person, with the question reference | Counsel |
| Technical schedule | The evidence items, tolerances and triggers designed to sit beside counsel's flow-down clauses | Outputs |
| Technical annex | Triodian's report of the assessment, in its own name | Outputs |
| Hand-back list | AI uses found that are not on the insurer's inventory, returned to its owner | Outputs |
| Legal-line check | A scan of drafts for wording that states what the law requires | Review |
| Difference report | What changed in the results when a new calibration version was loaded | Outputs |
| Privilege marking | The marking counsel directs for the work, printed on every output | Set-up, Outputs |

---

## 9. Responsive behaviour

As the AI Risk Appetite App specification, section 9, for header, navigation, popovers, tap targets, safe areas and input sizes. Screen-specific layouts:

| Element | Desktop ≥1024px | Tablet 640–1023px | Phone <640px |
| --- | --- | --- | --- |
| Register list | Ledger table, sticky header, column filter | Table with fewer columns; rest in an expandable row | One card per entry with badges; filter as a sheet |
| Entry editor | Five tabs; source picker beside each field | Tabs; source picker below each field | Tabs as a segmented control; each field a full-width block with source and not-known underneath |
| Classify sequence | Three columns: facts, current step, result so far | Two columns | One step per screen with the bottom step bar |
| Obtainability stepper | Rungs as a vertical ladder, T1 to T5 as a row per rung | Same, narrower | One rung per screen, T1 to T5 stacked |
| Findings | Summary table, worksheets below | Summary table scrolls inside its card | Summary as cards; each worksheet as an accordion of parts A to J |
| Question log | Ledger | Ledger, fewer columns | Cards; question form in a sheet |
| Outputs | Preview and markdown side by side | Stacked | Stacked, preview first |

---

## 10. Outputs and files

### 10.1 Deliverables

| ID | Output | Format | Contents |
| --- | --- | --- | --- |
| DL1 | AI dependency register | Markdown and CSV | All entries, all 26 fields, sources, flags, not-known count |
| DL2 | Evidence obtainable at each boundary | Markdown | Summary table and one worksheet per arrangement, parts A to J |
| DL3 | Control-library shape for the insurer's own AI boundary | Markdown | For B3 entries: categories of rule and the record each would produce. No product named |
| DL4 | Technical schedule, tolerance and trigger design | Markdown | For each F1 and F2: evidence item, contents, frequency, tolerance, triggers (from P10 where calibrated) and timing |
| DL5 | Technical annex | Markdown | The framework's ten-part outline, generated from the engagement; open sections for the method owner's text |
| DL6 | Hand-back list | Markdown | Uses with field 6 "no" or "partly", for the inventory owner |
| QS | Question set to counsel | Markdown | Open questions in the framework's template, numbered |
| RP | Review pack for the independent reviewer | Markdown bundle | DL1, DL2, DL5 and the exceptions log, addressed per the reporting line in set-up |
| CM | Closing measures | Markdown | The seven measures in framework section 11.5, plus calibration flags |
| DR | Difference report | Markdown | Produced on any calibration version change |

Every output carries the privilege marking on its first line, and the calibration status and version, draft or final, and date in its header. Outputs produced before their phase gate is met are marked draft.

### 10.2 Exchange with the AI Risk Appetite app

| File | Direction | Schema | Contents |
| --- | --- | --- | --- |
| Calibration set | Appetite → assessment | `triodian.raf.calibration.v1` | P1 to P11, status, version, date, approver, fell-back list |
| Register extract | Assessment → appetite | `triodian.aua.extract.v1` | Per entry: function, location in chain, tier, consequence, evidence currently received (field 18) as a rung. No facts, sources or client wording |

The register extract is what the appetite app's check K10 (reachable) reads, which closes that open item. Both schemas are defined once in the shared library and validated on load; a file that fails validation is rejected with the reason shown.

### 10.3 Copy and download

As the appetite app: **Copy** everywhere; **Download** where the browser allows it, otherwise replaced by a note to use Copy.

### 10.4 Saving work

- **Save assessment** downloads `AUA-<insurer>-<date>-v<n>.json`; **Open assessment** loads one.
- Autosave to browser storage is off by default and can be turned on per engagement; the header shows when it is on.
- The engagement file holds verbatim agreement extracts (field 14) and counsel's responses. The save dialog repeats the privilege marking and reminds the user to store the file as counsel directs.

---

## 11. Accessibility and quality

As the appetite app, section 11: WCAG 2.2 AA contrast, visible aubergine focus ring, full keyboard operation of tables, steppers, popovers and sheets, status never by colour alone, reduced motion respected.

---

## 12. Acceptance tests

| # | Test | Pass when |
| --- | --- | --- |
| AT1 | Open the worked example on a 390px phone | No sideways scroll; every screen usable; register shows as cards; popovers as bottom sheets |
| AT2 | Run the worked example uncalibrated | Expected rung E4 (E3 raised by the adjustment); E4 fails T3; E3 fails T1; E2 passes; obtainable E2, medium confidence; matches framework 8.5 |
| AT3 | Load a calibration set with A3/C4 set to E3 | Expected rung becomes E3; difference report lists the change; the E4 test result is marked for re-test |
| AT4 | Set field 15 before field 11 | Not allowed; popover explains the rule |
| AT5 | Same person classifies and reviews an entry | Blocked with explanation |
| AT6 | Enter field 25 without an answered question | Not allowed |
| AT7 | Transcribe counsel's response as Triodian | "Transcribed by" recorded; field locked |
| AT8 | Mark an arrangement's AI use not determinable | Finding F4; not counted as a gap |
| AT9 | Counsel determines no reasonable reach | Finding F3, shown in slate, with the classification beside it |
| AT10 | Load a calibration set with a provider ceiling of A2 for claims, then classify a claims entry at A3 | Above-ceiling flag shown separately from the finding |
| AT11 | Draft an annex containing "must comply" | R5 lists the hit; final export blocked until cleared |
| AT12 | Set the independent reviewer's reporting line to CRO | Review pack addressed to the CRO; R7 confirmed by the CRO |
| AT13 | Export the register extract and load it in the appetite app | K10 runs; no facts or sources included |
| AT14 | Save, reload, open | Every value, source, history entry and calibration version restored |
| AT15 | Tab through an entry and the obtainability stepper by keyboard | Every control reachable and operable |
| AT16 | Compare questions, fields, tests and outputs with the framework | No differences other than those in section 0.2 |
| AT17 | Check the header at 1280px, 800px and 390px | Triodian mark top left in aubergine; navy header rule; switcher lists both apps |

---

## 13. Build sequence

1. Build the AI Risk Appetite app's shared library first, or extract it: tokens, header, footer, drawer, step bar, popover, bottom sheet, ledger, badges, logo.
2. Define the two exchange schemas and their validators.
3. Extract the framework text, questions, tests and glossary into `content.json`.
4. Build S1 set-up and the data model with save and open.
5. Build S3 set and S4 register with sourcing and not-known.
6. Build S5 classify and test, including the obtainability stepper and blind re-derivation.
7. Build S6 questions and the transcription rules.
8. Build S7 findings, the calibration flags and the difference report.
9. Build S8 review, including the legal-line check.
10. Build the output generators and exports.
11. Build the worked example from framework section 8.5.
12. Run the acceptance tests at the three widths.

---

## 14. Open items

- [ ] **Update the framework document** with the seven changes in section 0.2, so AT16 tests against one source.
- [ ] **Independent reviewer's reporting line.** Built as a set-up choice; confirm which applies so the default can be set.
- [ ] **Unconfirmed framework elements** carried into the rules as written: the 26 fields, the consequence adjustment, the five-part obtainability test, F4, the gap priority matrix and the rung definitions (framework 12.3).
- [ ] **Authority split under question 5.** The app has Triodian propose the tier and counsel determine delegation, as the framework does; counsel to confirm (framework 12.4).
- [ ] **Legal-line phrase list.** A starting list is needed from counsel; the method owner maintains it.
- [ ] **Ladder naming.** One set of rung names to be chosen; the app shows the alternative names in popovers until then.
- [ ] **Worked example.** Must stay clearly fictional and be checked so it resembles no real arrangement.
- [ ] **CSV for DL1.** Included for convenience; confirm counsel is content for the register to leave the app in a spreadsheet-readable form.
