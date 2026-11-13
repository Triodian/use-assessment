# An audit procedure for the AI Use Assessment

**For the client's internal audit function · 13 November 2026 · follows ISO 19011:2026, Guidelines for auditing
management systems**

The assessment has seven review points, R1 to R7. They are quality control over one engagement, done by the people in
it and by the independent reviewer. They are not an internal audit of the client's AI management system, which
ISO/IEC 42001:2023 clause 9.2 asks the client to run itself.

This procedure lets the client's internal audit function, or anyone it appoints, test an assessment from the outside:
whether the method was followed and whether the record supports the findings. It needs read access to the assessment
and nothing else. The code and the rules it enforces are public under the Apache License 2.0, so the auditor can read
what the app checks.

It is written to the stages ISO 19011:2026 gives for an audit: initiating it, preparing, conducting, reporting,
completing, and following up. Read the guidance itself in a licensed copy.

## 1. Before the audit

| Step | What to settle |
| --- | --- |
| Objective | Whether the assessment followed its method and its record supports its findings |
| Scope | One assessment: its set, register, classifications, tests, findings and outputs. Out of scope: whether the findings are legally sufficient, which is counsel's, and the providers themselves |
| Criteria | The AI Use Assessment Framework (in the app's Reference screen), the calibration set in force, and this procedure |
| Auditor | Independent of the engagement: took no part in it, and did not advise on the thresholds it is measured against. Competence: internal audit practice, and enough knowledge of ISO/IEC 42001:2023 to read the evidence index |
| Access | A sign-in with no engagement role sees nothing, so ask the administrator for the read-only review pack, the register export (JSON) and the engagement history |

## 2. Tests

Each test names where to look and what a pass is. Sample at least five register entries, or all of them when the set
is smaller, and every arrangement with a gap (finding F2).

| # | Test | Where | Pass when |
| --- | --- | --- | --- |
| 1 | The set was agreed before classification | Versions: "Set agreed (R1)" | The version predates the first classification, and holds facts only |
| 2 | Every fact has a source | Register, fields 3 to 14 | Each sampled value names a document and page or an interview and date, or is recorded as not known |
| 3 | A source says what the register says | The client's own copy of two cited documents | The cited page supports the value |
| 4 | Classification was re-derived by a second person | Each entry's peer review | The reviewer is not the classifier; a difference shows both positions and the resolution |
| 5 | Separation of duties held | Engagement history; people and roles | No one reviewed or validated their own work; no one who supplied the hand-over confirmed R7 |
| 6 | The expected rung follows the calibration set | Each entry's expected rung against parameter P3 of the set in force | They agree; a version change produced a difference report |
| 7 | Each obtainable rung has five test results | Classify and test, T1 to T5 | Every tested rung shows a result and a source for each test |
| 8 | Required rungs came from counsel | Field 25 and the question it cites | Each is transcribed from an answered question, by counsel or checked by a second person |
| 9 | Findings follow the rule | Finding for each arrangement | F1 to F4 follow from the required and obtainable rungs as the framework states; the grade follows the matrix in force |
| 10 | Not-known values are counted, not estimated | Register and the closing measures | Counts agree; none is filled with an estimate |
| 11 | Departures were recorded | Exceptions log | Each departure the auditor finds is in the log, with who approved it |
| 12 | Corrective action is recorded and followed up | Nonconformity and corrective action register | Each gap (F2) and exception has a root cause, an action and a date for the effectiveness check; past dates have a result |
| 13 | Competence and independence are recorded | Set-up; technical annex | Each role has a competence statement; the independent reviewer's firm and declaration are on the annex |
| 14 | Records are kept as stated | Set-up; technical annex | Retention period, place of storage and disposition are recorded, and match what the auditor finds |
| 15 | Outputs state what they are | Technical annex | It says the assessment is not an AI system impact assessment and does not assess likelihood, bias, data or model behaviour |

## 3. Reporting

Report each test as conforming, nonconforming or not tested, with the entries sampled and what was seen. A
nonconformity goes to the method owner and the GC. It is recorded as an exception in the assessment, with its root
cause, corrective action and effectiveness check, so it appears in the register in test 12.

## 4. Follow-up

At the date of each effectiveness check, the auditor or the method owner records the result. The register is an input
to the client's management review (ISO/IEC 42001:2023, clause 9.3), with the management-review input pack that AI
Risk Appetite produces.

> This procedure tests the assessment against its own method. It is not legal advice and it is not a certification
> audit; a certification audit is done by a body accredited for the purpose.
