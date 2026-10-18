# AI Use Assessment App: Fix Mini-Spec v1

*Triodian · 12 October 2026 · Applies to the build reviewed on 12 October 2026 (`AI_Use_Assessment (standalone).html`)*

This mini-spec lists the changes needed before the app is used with a client. It covers seven must-fix items (M1 to M7) and twelve should-fix items (S1 to S12). Each item gives the problem, where it is in the code, the change required, and how it is tested.

The **AI Use Assessment App: Build Specification** remains the requirement. Where this document and the build specification differ, this document wins for the items listed. Line numbers refer to the unbundled logic script (`js2.js`, 893 lines); treat them as approximate.

Several fixes were already made in version 3 of the AI Risk Appetite app. Reuse that code rather than writing it again, so the two apps behave the same way:

| Fix here | Reuse from the appetite app, version 3 |
| --- | --- |
| M1 escaping and file validation | `esc()` and `validateFile()` |
| S8 change history | draft values held while typing, written on change |
| S9 keyboard focus | stable ids derived from the path; focus and cursor restored after render |
| S7 outputs screen | the `.outgrid` and `.mdsrc` markdown pane, sandbox download note, unsaved-change prompts |

Do the must-fix items first, in order. M1 and M2 change how files load, which every later test depends on.

---

## Must fix

### M1. Escape every value read from a file, and validate files on load

**Problem.** Engagement files and calibration sets pass between Triodian, counsel, the insurer and the independent reviewer. Several values from those files are inserted into the page as HTML without escaping, so a crafted file could run script in another user's browser. `validateCalibration` (line 178) checks only schema, status and version.

**Known sites:**
- entry and arrangement ids: `e.id`, `e.arrangementId`, `a.id` (lines 314, 339–342, 484, 528)
- the P3 example value `v.ex` (lines 339–340)
- obtainability values `ex.value` and `e.obtainability.start` (lines 384, 424, 435)
- the proposed tier `pr.tier` (lines 446, 448)
- question fields `q.ref` and `q.question7` (lines 466–467, 480–481)
- the P9 limit `cc.limit` (line 525)
- person ids in `<option>` values (line 210)
- `fld()` labels built from `v.id` and `x.ref` (lines 296, 568, 570)

**Change.**
- Pass every interpolated value through `esc()`, including ids, refs, codes and attribute values. `esc()` escapes `&`, `<`, `>`, `"` and `'`.
- Validate an engagement file before hydrating it, and a calibration set before applying it:
  - ids and refs match `^[A-Za-z0-9_.:-]{1,64}$`
  - roles, statuses, tiers (A1 to A6), consequences (C1 to C5), rungs (E0 to E6), findings (F1 to F4) and test codes (T1 to T5) are from their known lists
  - every P1 to P11 value in a calibration set has the shape set out in the appetite framework, section 9.1
  - strings are capped at 10,000 characters
  - a file that fails is rejected, and the reason is shown with the path that failed

**Test.**
- A file with `<img src=x onerror=alert(1)>` in an entry id, an arrangement id, a question reference, a person id and a P3 value is rejected, or loads with the text shown literally. No script runs.
- A calibration set with a P3 value of "E9" is rejected with the cell named.

### M2. Stop unknown references from crashing the app

**Problem.**
- An entry pointing to an arrangement id that does not exist crashes the findings screen (line 593, `arr(...).findingOwner`).
- `FLD(n).name` throws on an unknown field key (line 516).
- `hydrate` (line 746) does no shape checks, so a missing array stops the app rendering.

**Change.**
- Guard `arr()`, `FLD()` and every other lookup so an unknown id returns a placeholder and the item is listed under a new **Broken references** heading on the Review screen.
- In `hydrate`, fill any missing top-level array or object with its empty default from build specification section 6.
- Add a check to the phase 2 gate: no broken references.

**Test.**
- A file with an entry pointing to arrangement "X99" opens. The Findings screen renders, and the Review screen lists the broken reference.
- A file with no `questions` array opens with an empty questions list.

### M3. Make the R3 re-derivation blind

**Problem.** `blindHide` (line 403) hides only step 5. The tier selector `tierSel` pre-selects the classifier's tier in steps 1 to 3, and the register and findings screens show it. The peer reviewer can see the answer before setting their own.

**Change.**
- When the current person is acting as peer reviewer on an entry whose R3 is not recorded, show only fields 11 to 13 and an empty tier selector with no default.
- Hide the classifier's tier, reasons and proposal everywhere the peer reviewer can reach for that entry: Register, Classify and test, Findings, Outputs and the drawer.
- After the peer reviewer records a tier, show both tiers side by side. If they differ, require a resolution with a reason, as build specification section 5.6 sets out.
- `tierSel` has no default anywhere in the app (see also S12). An unchosen tier counts as incomplete.

**Test.**
- As peer reviewer, open an unreviewed entry. The classifier's tier does not appear on any screen.
- Recording a different tier shows both and blocks the phase 3 gate until the difference is resolved.

### M4. Enforce role limits and separation of duties

**Problem.**
- `setPath` (line 740) does no permission check. Any role can agree the set, close independent review points, edit the peer review resolution, or change the people list.
- `recR4` (line 831) does not check that the validator classified or reviewed no entry.
- `recR7` is enabled for the independent reviewer whatever the reporting line (line 560). When the line is *directly to the CRO*, the CRO should confirm R7.
- `croName` is free text, not a person from the people list.

**Change.** Route every editable control and action through one `canEdit(person, target)` function. Disable the control and give the reason in a popover when the person is not allowed. Apply the rules in build specification section 2, and in particular:

| Action | Allowed |
| --- | --- |
| People list and set-up | Method owner and delivery manager |
| Agree the set (R1) | GC and counsel, each recording their own agreement |
| Peer review tier and resolution (R3) | The peer reviewer, who is not the classifier of that entry |
| Record R4 | A validation person who classified or peer-reviewed no entry in the set |
| Clear R5 hits | Method owner |
| Record R6 | Counsel |
| Log and close independent review points | Independent reviewer logs points; Triodian responds; only the independent reviewer closes or discloses |
| Confirm R7 | The independent reviewer when the reporting line is *through counsel*; the CRO when it is *directly to the CRO* |
| Fields 23 to 25 | Counsel directly, or Triodian by transcription (section 7.6) |
| Annex signature | Method owner who is not the only peer reviewer of any entry |

Replace `croName` with a choice from the people list, limited to people with the CRO role.

**Test.**
- As the independent reviewer, no control outside review points is enabled.
- A validator who classified one entry cannot record R4; the popover names the rule.
- With the reporting line set to the CRO, R7 is enabled only for the CRO. This also passes acceptance test AT12.

### M5. Make R5 block the final export

**Problem.**
- With R5 hits open, the final export still downloads, only labelled "draft".
- Hits are keyed by output and line, so clearing a phrase in DL5 does not clear the same phrase in the review pack.

**Change.**
- Key each hit by phrase and source text (the field or paragraph it came from), not by output. Clearing a hit clears it in every output built from that text.
- Every output carries "Draft" in its header until R5 is cleared and the phase 5 gate passes.
- **Export final** is disabled until then, with the reason in a popover. **Export draft** stays available.
- Editing source text after R5 is cleared reruns the scan. A new hit reopens R5.

**Test.**
- Acceptance test AT11: a technical annex containing "must comply" lists the hit, and final export is blocked until it is cleared.
- Clearing the hit once clears it in DL5 and the review pack.

### M6. Handle an expected rung of E0

**Problem.** When P3 gives E0 for a cell, the obtainability ladder is empty, `obResult` never completes, and the phase 3 gate cannot pass.

**Change.** When the expected rung is E0, record the obtainability result as E0 with no tests, and show "No evidence expected at this tier and consequence (P3)". The entry counts as complete for fields 16 to 21.

**Test.** A calibration set with E0 for A1 × C1 lets an A1 × C1 entry complete phase 3.

### M7. Rebuild the Reference screen from the current framework

**Problem.** The Reference text was produced by find-and-replace and is damaged:
- "led by counsel (counsel). counsel answers"
- lower-case "counsel" at the start of sentences and table cells
- "Validation reviewer (Triodian) PhD" and "the counsel deck"

It also names Damian Hickey, Leon Cosgrove, Abhishek Gupta and KJR, and lacks the changes in build specification section 0.2. The subtitle (line 654) says those changes are included.

**Change.**
- Rebuild the Reference content from the current AI Use Assessment Framework. Apply the section 0.2 changes:
  - the independent reviewer reviews on behalf of the CRO
  - roles appear in place of firm names
  - decision 3 starts from current state
- Write "counsel" for the legal adviser throughout, capitalised at the start of a sentence or cell.
- Remove every personal name and firm name. Show roles only.
- Search the whole bundle for each name and for "NRF", "Norton", "Finity" and "KJR", and remove every occurrence.

**Test.**
- None of the names, "NRF", "Norton", "Finity" or "KJR" appears anywhere in the bundle, in any case.
- No sentence or table cell starts with lower-case "counsel".
- The Reference text matches the framework section by section.

---

## Should fix

### S1. Derive confidence from the sources

**Problem.** Confidence is chosen by hand (`confBasis`, line 439) and is not checked against the sources.

**Change.** Propose confidence by the rule in build specification section 7.4:
- **High** when the source is a received D7, D8 or D9 item showing the record.
- **Medium** when a document describes it.
- **Low** when it is inferred, and always low at B2 unless field 14 or a D7 item supports more.

The assessor may lower it freely. Raising it above the proposal needs a reason, which the worksheet prints.

**Test.** An entry with no D7 to D9 source cannot be set to high without a reason.

### S2. Complete the calibration flags

**Change.**

| Flag | Change |
| --- | --- |
| F4 standing too long | Add it. Compare the age of each F4 finding with the P6 period for the entry's consequence band. The worksheet (line 513) prints the period for the entry's band, not the first band's |
| Concentration | Count critical operations, not entries (line 130). Treat each "not known" field 9 value as its own unknown, not as one platform, and list the unknowns beside the flag |
| Above ceiling | Default the entry's function from its arrangement. Store `functionName` on the entry when it is overridden |

Add a glossary entry and popover for **concentration**.

**Test.**
- Three entries on one critical operation count once.
- Two "not known" platforms do not raise a concentration flag together.

### S3. Derive F3 from counsel's answers

**Problem.** F3 is set only by an explicit tick (line 828). A negative answer to questions 1 to 3 does not set it, and the tick cannot be undone.

**Change.** Apply the order in build specification section 7.7. F3 follows when counsel's recorded answers to questions 1 to 3 are all negative, or when counsel records an explicit determination. A later answered question can replace either. Remove the manual tick.

**Test.** Recording negative answers to questions 1 to 3 gives F3. A later answer of "yes" to question 2 removes it.

### S4. Correct the deliverables

**Change.**
- **DL1 register CSV:**
  - add the privilege marking, status and "Draft" header rows
  - fill field 26 (`fvs(e,26)` at line 600 is always empty)
  - write "not known" rather than an empty value when field 21 is null
- **DL3:** use the categories in framework section 10, not the five invented in the build.
- **DL4 tolerance column:** print the P10 threshold and measure for the entry, not field 5 (line 611).
- **Field 17:** label it "Expected (P3, version *n*)" when calibrated and "Indicative" only when uncalibrated.

**Test.**
- DL1 opens in a spreadsheet with the header rows and no empty field 26.
- DL4 shows the P10 values from the worked example.

### S5. Restore the framework wording

**Change.** Replace the drifted text with the framework's wording:

| Place | Restore |
| --- | --- |
| Question 4 | "Enforceability, data access and audit rights; offshoring (paras 53(b) and 60(b))" |
| Question 3 | "including binder and claims agreements" |
| Questions table | The "Facts Triodian supplies" column |
| Authority test 1 | The framework's wording, word for word |
| E0 | "None. No evidence is held." |
| Deliverables table | The "Produced by" column |
| R4 | "across entries" |
| Field 5 | "from the insurer's CPS 230 list" |
| D7 | The full title |

**Test.** Each item matches the framework, word for word.

### S6. Store findings and flags in the file

**Change.**
- Save `findings[]`, each entry's `expectedRung` with its basis, and `flags` in the engagement file, as build specification section 6 sets out. Keep them recomputed on load, so the saved values are a record, not an input.
- When uncalibrated, name the saved file without "v0".

**Test.** A saved file contains the findings and flags shown on screen.

### S7. Finish the outputs screen

**Change.**
- Show the markdown source beside the preview on desktop, stacked below it on tablet and phone. Reuse `.outgrid` and `.mdsrc` from the appetite app.
- In a sandboxed viewer, replace the download button with a note to use Copy.
- **Open engagement file**, **Open worked example** and **New** ask for confirmation when there are unsaved changes.
- The app switcher does not download a file as it navigates. If there are unsaved changes it asks first.

**Test.** Each deliverable tab shows preview and markdown, and opening a file with unsaved changes asks first.

### S8. Correct the change history

**Problem.** `onInput` (line 871) writes each keystroke into state, so "from" in the history is already the new value.

**Change.** Hold the edit in a draft value while typing. Read "from" from state when focus enters the field, and write to state on change, as in the appetite app version 3.

**Test.** Changing field 5 from "Claims payment" to "Claims handling" records both values.

### S9. Keep keyboard focus after edits

**Problem.** `render()` restores focus only by element id. These controls have none:
- source inputs
- not-known checkboxes
- authority selects
- the T1 to T5 selects (`data-ob`)
- consequence radios
- register filters

**Change.** Give every focusable control a stable id derived from its path, for example `e-E07-f13-src`. Restore focus and cursor position after every render.

**Test.** Tab through one entry's classify and test screen, changing each control. Focus never returns to the top of the page.

### S10. Protect counsel's determinations and calibration changes

**Change.**
- Fields 23 to 25 can be applied only from the newest answered question for that entry. Applying an older determination (line 465) is blocked, with the reason.
- Loading a calibration set older than the one in use asks for confirmation and names both versions.
- The difference report builds its "why" text from the parameters that changed. It no longer uses fixed text.

**Test.**
- Applying a superseded answer is blocked.
- Loading version 2 over version 3 warns first.

### S11. Correct the exchange with the appetite app

**Change.**
- Write field 18 "none" as `received: "E0"`, not `null`.
- Add `privilegeMarking` as the first property of the extract, and keep schema `triodian.aua.extract.v1`.
- Fix the P2 key pattern at line 421 so labels read "Insurer · Claims payment", not "Insurer: · Claims payment".

**Test.** The extract loads in the appetite app version 3, and its starting data shows E0 where field 18 was "none".

### S12. Build the remaining layouts and small items

**Change.**
- Build the layouts in build specification section 9:
  - register on tablet: reduced columns with an expandable row
  - register on phone: filters in a sheet
  - source picker on tablet: below each field
  - worksheets on phone: an accordion of parts A to J
  - question form on phone: in a sheet
- Make the toast live region visible to screen readers. It is currently hidden.
- Push each screen change to browser history so the back button returns to the previous screen.
- `tierSel` has no default (see M3).

**Test.** At 800px and 390px each listed layout works, with no sideways scrolling, and the back button moves between screens.

---

## Regression checks after the fixes

Run the build specification's acceptance tests AT1 to AT17 again at 1280px, 800px and 390px. Also confirm that these, which the review found working, still work:

- the worked example matches framework section 8.5
- AT3 recalculation and re-test
- `expected()` in both calibrated and uncalibrated modes
- the finding order and the phase gates
- field 11 before field 15
- the transcription locks on fields 23 to 25
- flags shown beside findings, never inside them
- headers, popovers and drawer

Also confirm that:
- the app loads with no console errors at any width
- a file saved before these fixes opens, with any broken references listed (M2)
- a calibration set from the appetite app version 3 loads, and an extract from this app loads in the appetite app

---

## Not in scope

These are left for a later pass:
- visual polish beyond the layouts in S12
- the open items in build specification section 14, including the independent reviewer's reporting line, which stays a set-up choice
