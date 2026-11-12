# The technology owner and the AI governance team: what they supply and what they read

For counsel assessing the design. This describes what the app does today; it is not legal advice, and whether the
design keeps the assessment's privilege is counsel's question. Development plan tasks 7.4 and 7.5.

## The two roles

- **Technology owner**: one person, usually the CIO. **AI governance team**: several people.
- Both are optional. An assessment with neither runs as before.
- Neither role decides anything in the assessment. Neither can be the independent reviewer, and nor can anyone who
  supplied or confirmed the hand-over, whatever role they hold later.

## What they supply: the hand-over

They list the inventory of AI in use, the evidence for each arrangement and what existing assurance covers. Each item
is a description and where the material is held. Nothing is uploaded: documents reach counsel in the usual way. They
confirm the hand-over complete in their own name, and after that change nothing unless it is reopened with a reason.

| Step | Who can do it today |
|---|---|
| Ask for the hand-over | Counsel, the GC, the method owner, the delivery manager |
| Add, change or remove an item, while it is open | Technology owner, AI governance team |
| Confirm it complete | Technology owner, AI governance team |
| Reopen it, with the reason | Counsel, the GC, the method owner, the delivery manager |

## What they read

A person who holds **only** these roles is sent, by the server:

- the organisation's name, the engagement reference and counsel's firm;
- the names, organisations and roles of the people in the assessment (no email addresses);
- the hand-over;
- each update counsel has released, their contested points with the assessor's answers, their consultations, and the
  facts counsel asked them to confirm.

They are **not** sent the register, the classification work, the questions to counsel or the responses, the findings,
the review points, the outputs, the change history, earlier versions or the privilege marking. Every other request
from such a person is refused by the server, not only hidden on screen. A person who also holds another role (for
example arrangement owner) sees the assessment as that role does.

## Updates

- **Only counsel releases an update** (or the GC, where set-up records that the GC also acts as counsel).
- Counsel sees the update on screen before releasing it, and confirms with a second click. A released update cannot
  be recalled or edited.
- An update lists, for each register entry: the arrangement and system, the authority tier, the failure consequence,
  the indicative and obtainable rungs with the confidence, and which facts are marked not known. Counsel can add a note.
- **Legal determinations** (register fields 23 to 26: nexus, rights held, required rung and grading, finding and gap
  owner) are left out unless counsel ticks the box for that update. The server drops them otherwise, whatever the
  browser sends. Questions to counsel and counsel's responses are never in an update.

## Contested points, consultations, facts

- **Contest.** Either role contests a point in a released update, with the reason and the evidence. An assessor or
  the method owner accepts it and says what is revised, or keeps the position and says why. A contested point changes
  nothing in the register by itself: any revision is an ordinary, checked change by the assessor. Every contested
  point and its answer goes into the independent reviewer's pack.
- **Consultation.** Either role asks for a session. Counsel, the GC, the method owner or the delivery manager records
  it as held, with the date and the outcome. The outcome text is read by the two roles.
- **Facts to confirm.** Counsel names facts, one to a line. The two roles see those facts and answer each as correct
  or not correct, with the correction. An answer cannot be changed.

## Emails

Emails to and from the two roles say what happened ("an update is released to you") and carry none of the content.

## Questions for counsel

1. Does this design keep the assessment's privilege when updates go to the two roles?
2. Should the hand-over request, and each update, come only from counsel? Today the GC, the method owner and the
   delivery manager can also ask for the hand-over and reopen it; only counsel releases an update.
3. Who should be on the named list that receives updates? Today it is everyone who holds either role.
4. The assessor's answer to a contested point and the outcome of a consultation are free text that the two roles
   read. Should counsel see or release each before it goes to them?
5. An update shows the authority tier, the failure consequence and the rungs as technical positions. Is any of these
   a legal determination in your view, to be left out by default?
6. The arrangement owner (a client role) sees the whole assessment today, as before this change. Is that still right
   beside the narrower view the two new roles have?
