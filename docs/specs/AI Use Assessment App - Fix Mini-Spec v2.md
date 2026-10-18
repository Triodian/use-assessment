# AI Use Assessment App: Fix Mini-Spec v2

*Triodian · 12 October 2026 · Applies to the build reviewed on 12 October 2026 (`AI_Use_Assessment (standalone) (1).html`)*

This mini-spec follows Fix Mini-Spec v1. Most of v1 is done. This document covers:
- five must-fix items (N1 to N5), each a problem introduced or left open by the v1 changes
- eight should-fix items (T1 to T8), finishing the v1 items that were done in part

Each item gives the problem, where it is in the code, the change required, and how it is tested.

The **AI Use Assessment App: Build Specification** and Fix Mini-Spec v1 remain the requirement. Where this document differs, this document wins for the items listed. Line numbers refer to the unbundled logic script (`js2.js`, 1,158 lines); treat them as approximate.

Change nothing else. The review found the rest of v1 working, and the regression checks at the end protect it.

---

## Must fix

### N1. Restore the A1 × C1 stop rule

**Problem.** With no calibration set, the base rule gives A1 × C1 an indicative rung of E0. The M6 change returns before the stop-rule branch:
- `ladder()` (line 147) returns an empty ladder for E0 before it reaches the A1 × C1 branch.
- `obResult()` (line 149) records E0, done, with no test.

As a result, an A1 × C1 entry records E0 with no test. The framework requires the stop rule: test only whether disclosure exists (E1). The previous build did this. Lines 595 and 606 now show the stop-rule text and the "No evidence expected (P3)" message together, and they contradict each other. The "(P3)" message also appears when no calibration set is loaded.

**Change.**
- In both `ladder()` and `obResult()`, check the stop rule first. When field 15 is A1 and field 16 is C1, the ladder is `['E1']`, whatever the expected rung.
- Keep the E0 shortcut for every other cell where the expected rung is E0. In practice that is only a calibrated P3 cell set to E0.
- Show the E0 message only when the E0 comes from a calibration set. Word it "No evidence expected at this tier and consequence (P3, version *n*)".

**Test.**
- Uncalibrated A1 × C1: the obtainability test shows one rung, E1, with T1 to T5. A pass records E1; a fail records E0.
- Calibrated, with P3 set to E0 for A2 × C1: the entry records E0 with no test and shows the P3 message.
- Calibrated, with P3 set to E0 for A1 × C1: the stop rule still applies and tests E1.

### N2. Stop entries with a missing or empty arrangement crashing the app

**Problem.**
- `validateFile` lets an empty `arrangementId` through, because `id()` skips empty values (line 277). `arr('')` then returns `null`, and the entry editor's Finding tab reads `a.id` and throws (line 556). I reproduced this in the browser.
- `fieldOut`'s `finding({})` can match such an entry through `undefined === undefined`.
- An entry with no `id` makes `hydrate` call `newEntry` (lines 57 and 984). That reads `S.entries`:
  - with no assessment open, `S` is null and the file is rejected with a TypeError
  - with one open, the new id comes from the old assessment and can duplicate an id in the file

**Change.**
- In `validateFile`, an entry with an empty or missing `arrangementId` is listed under **Broken references** (M2), not rejected. In every renderer, treat `arr()` returning `null` the same way as a missing arrangement: the placeholder, plus the "entry points to no arrangement" message.
- Make `finding()` and `fieldOut` return "none" for an entry with no arrangement, never a match.
- In `hydrate`, give an entry with no `id` a new id generated from the file being loaded, never from `S`. List it under Broken references as "id assigned on load".

**Test.**
- A file with one entry whose `arrangementId` is `""` opens. Every tab of that entry renders, and Review lists it.
- A file with an entry with no `id` opens with no assessment already loaded, and the new id is unique within the file.

### N3. Honour an explicit "no reach" on the same answer

**Problem.** In `reachDetermination` (line 216) the explicit determination wins only when `qOrder(ex) > qOrder(setTop)`. When counsel records "no reach" on the same answered question that is also the newest answer to question 1, 2 or 3, `ex === setTop` and the explicit determination is ignored. No F3 results.

**Change.** Use `>=` in place of `>`, so an explicit determination on the newest answer applies.

**Test.** Answer question 1 "no" with reach "none", leaving questions 2 and 3 unanswered. The arrangement's finding is F3, citing that question.

### N4. Open older files, and reject bad value types

**Problem.**
- `inList(String(q.question7), …)` (line 299) turns a missing `question7` into the string "undefined". A file saved before the fixes with that property missing is rejected before `hydrate` can fill the default. This breaks the v1 regression check that older files still open.
- Some values are not type-checked, and a wrong type crashes every render instead of being rejected:
  - a number in `legalPhrases` crashes `p.trim()` (line 730). The file check accepts `legalPhrases: [1, 2]`.
  - a non-string `fields[n].source` crashes `fieldDone` (line 75)
  - a non-array `calibration.fellBack` crashes the `.join` at line 449. Validation checks `fellBackToDefault`, not `fellBack`.
- `documents[].ref` is not id-checked.

**Change.**
- Treat a missing `question7` as empty, not as "undefined". Let `hydrate` fill the default, and list the question under Broken references if no default can be worked out.
- In `validateFile`, check types as well as values:
  - `legalPhrases` is an array of strings
  - every `fields[n].value` and `fields[n].source` is a string or null
  - every list the code calls `.map`, `.filter` or `.join` on is an array
  - `calibration.fellBack` (the property the code reads) is an array of strings
- Check `documents[].ref` against the id pattern.
- Check fields 3, 4, 6, 12 and 20 against their option lists.

**Test.**
- A file saved by the build reviewed under v1 opens.
- Files with `legalPhrases: [1, 2]`, a numeric field source and `fellBack: "x"` are each rejected with the path, and no error appears in the console.

### N5. Remove sideways scrolling on phone

**Problem.** At 390px the page scrolls sideways on two screens:
- Classify: the entry picker (`#pickEntry` and its label) is 535px wide.
- Findings: the finding badge "F4 · Not determinable on documents" runs to 459px.

**Change.**
- Make the picker label stack above the select on phone, and give the select `width: 100%; min-width: 0`.
- Let badges wrap: `white-space: normal` on phone, or show the code only (for example "F4") with the name in the popover.
- Recheck every screen at 390px with long arrangement names (60 characters).

**Test.** At 390px, `document.documentElement.scrollWidth` equals the viewport width on every screen of the worked example, and with a 60-character arrangement name.

---

## Should fix

### T1. Key legal-line hits by source, not by output line (finishes v1 M5)

**Problem.** A hit's key is the phrase plus the output line (line 732). The same field text appears on different lines in DL1 and in the DL2 worksheet, so one phrase gives separate hits that must each be cleared.

**Change.**
- Record the source of each piece of text as outputs are built: the entry and field number, or the paragraph id for fixed text.
- Key hits by phrase plus source. List each hit once, showing every output it appears in.
- Clearing a hit clears it everywhere. Editing that source reopens it.
- Cache the output text between renders, and rebuild it only when state changes, not on every render (line 942). This also removes the cost of building all ten outputs on each keystroke.

**Test.**
- Put "must comply" in field 12 of one entry. R5 lists one hit, showing DL1, DL2 and RP.
- Clearing it once clears it in all three.
- Editing field 12 reopens it.

### T2. Work out the B2 rule from the sources (finishes v1 S1)

**Problem.**
- At B2, confidence is low unless someone ticks `b2Support` (lines 165 and 614). It is not worked out from field 14 or a D7 source.
- Documents added in set-up get `ref: ''` (line 1056), and there is no control to set it. They can never be D7, D8 or D9, so "high" is never proposed for them.

**Change.**
- Add a **Ref** select (D1 to D9) to each document row in set-up, editable by the delivery manager and method owner.
- At B2, propose more than low when field 14 is sourced from a document, or when a received D7 item is cited in the T1 source. Remove the `b2Support` tick, and convert a ticked value in older files to a raise reason: "Supported at B2 (from earlier file)".

**Test.**
- At B2, citing a received D7 in the T1 source proposes high, with no tick.
- A document added in set-up and given ref D8 can support high.

### T3. Correct the Reference tables (finishes v1 S5)

**Problem.** v1 S5 asked for a "Produced by" column on the deliverables table. That was wrong. The framework puts "Produced by" in the evidence ladder table (section 8.3) and "Accepted when" in the deliverables table (section 10.1).

**Change.**
- **Evidence ladder table (line 869):** add "Produced by", with the framework's values for E0 to E6.
- **Deliverables table (line 872):** replace "Produced by" with "Accepted when", with the framework's values for DL1 to DL6. Where the framework names the legal firm, write "counsel".
- **Question 1:** use a straight apostrophe, as the framework does.
- **Overview text:** fix the remaining lower-case sentence start: "**One technical party.** Counsel deals with Triodian…"

**Test.**
- Both tables match the framework column by column.
- No sentence or table cell in the app starts with lower-case "counsel".

### T4. Show the right tolerance in DL4 (finishes v1 S4)

**Problem.** P10 is a single list of triggers, each with a reference, measure, threshold, time and recipient. DL4 prints the whole list in the tolerance column of every row (line 815), which makes the rows long and the same.

**Change.**
- Print P10 once, as a table at the head of DL4, with reference, measure, threshold, time and recipient.
- In each row, the tolerance column gives the trigger references that apply to the item. Default to every P10 trigger, and let the assessor narrow the list per row.
- When uncalibrated, keep "[Set by the board in P10]".

**Test.** With a calibration set holding eight triggers, DL4 shows the P10 table once and each row lists references only.

### T5. Fix the field 17 label (finishes v1 S4)

**Problem.**
- DL1 and the CSV add " rung" after `rungLabel()`, giving "Expected (P3, version *n*) rung" (lines 798 and 804).
- The field name in the content file is still "Indicative rung".

**Change.**
- Use one function for the field 17 name everywhere: "Expected rung (P3, version *n*)" when calibrated, "Indicative rung" when not.
- Read the field name from that function, not from `js1.js`.

**Test.** The calibrated DL1, CSV, worksheet and entry editor all read "Expected rung (P3, version *n*)".

### T6. Close the last blind-review gaps (finishes v1 M3)

**Change.** While R3 is open on an entry for the person acting as its peer reviewer:
- the register Facts tab shows fields 11 to 13 only, not 3 to 14
- the Set screen hides that arrangement's finding badge (line 471)

**Test.** As the peer reviewer of an unreviewed entry, only fields 11 to 13 and no finding are visible for it on any screen.

### T7. Explain every disabled control

**Problem.** Some controls are disabled with no reason shown:
- Add exception (line 759)
- Add point (line 761)
- Add category (line 853)

**Change.** Give each the same reason popover that the other `deny()` controls use.

**Test.** As a role that cannot add, tapping each control explains why.

### T8. Small navigation and focus fixes

**Change.**
- `go()` (line 962) does not push a history entry when the screen is not changing. On boot, use `history.replaceState` for the first screen.
- The app switcher asks once. Skip the `beforeunload` prompt after the person has already confirmed in the switcher.
- When the control that had focus is now disabled (for example a value field after "not known" is ticked), move focus to the control that disabled it, not to the page.

**Test.**
- Three clicks on Register followed by Back returns to the previous screen.
- Switching apps with unsaved changes asks once.
- Ticking "not known" keeps focus on the checkbox.

---

## Regression checks after the fixes

Run the build specification's acceptance tests AT1 to AT17 again at 1280px, 800px and 390px. Also confirm that the items found working in this review still work:
- file escaping and validation (v1 M1), with an E9 calibration set rejected
- Broken references on Review and in the phase 2 gate
- blind R3 with no default tier
- the `deny()` role gate, including the R4 and annex separations and R7 by reporting line
- final export blocked until R5 is cleared and the phase 5 gate passes
- E0 from a calibrated P3 cell
- F4 standing too long, concentration by critical operation, and the ceiling defaulting from the arrangement
- findings, expected rung and flags saved in the file
- the outputs markdown pane and the unsaved-change prompts
- change history and focus
- only the newest determination applying, and the warning on an older calibration set
- the extract loading in the AI Risk Appetite app version 3
- the phone and tablet layouts, and the back button
- no personal or firm names anywhere in the bundle

---

## Not in scope

These are left for a later pass:
- the `opOf` heuristic that reads the critical operation from field 5 text (line 197). A structured critical-operation field would be better, but it changes the data model.
- P6 periods in forms other than a date or "N days, weeks or months". The F4 standing-too-long flag stays silent for these.
- a render during typing, for example a breakpoint change, discarding the draft value
