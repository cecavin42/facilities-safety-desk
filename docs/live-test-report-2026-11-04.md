# Facilities Safety Desk — live acceptance test

Test date: 2026-11-04.
Target: https://facilities-safety-desk.vercel.app/
Method: direct interaction with the production website, not a local app or source-code-only review.
Scope: 5 testing dimensions—form and validation, assistant responses, reports and CSV import/export, three distinct report views, and example-question button behavior—including 11 assistant test questions.
Baseline: docs/spec-and-test-set branch; question fixture revision d60262b66672cf1513d4f8054d0425da6fc8961c. Deployment commit was not verified.

## Overall result

**Not ready to mark all five testing dimensions complete.** The core form workflow passed. The assistant has answer-content and citation defects. CSV import passed during follow-up testing, while reports passed only partially. Role-based sign-in is not yet implemented. Example buttons trigger queries directly but disappear after an answer, preventing consecutive clicks.

The homepage explicitly states that sign-in is not implemented, added reports are stored only in the current browser, and the assistant retrieves passages rather than using an AI model. Functional results below therefore concern the anonymous demo. They do not certify employee/safety-manager permissions or shared database persistence.

## Results across five testing dimensions

| Check | Result | Observed evidence |
|---|---|---|
| Employee sign-in | BLOCKED | Homepage states no sign-in yet; roles are planned for a later version. |
| Future-date validation | PASS | Submitted 2026-11-08; displayed “Date of event cannot be in the future.” |
| Correct, submit, find in list | PASS | Corrected to 2026-11-04. Saved R-0001 with status Open; Records lists the exact TEST-KAI marker. Total 151 records. |
| Forklift inspection frequency | PASS | Answer says at least daily; cites 1910.178(q)(7) and UT SAGS130-K. |
| Who receives a near-miss report? | FAIL | Both the short assigned question and longer fixture question omit “immediate supervisor” in the displayed answer. The longer answer does include protection against retaliation and UT references. |
| Pay question declined and appears in report 3 | PASS for the assigned short wording | “How much do forklift operators get paid?” is politely declined with an HR referral; report 3 displays this wording with count 4. The wording also exists in seed data, so visibility alone cannot independently identify the new individual log entry. |
| Safety-manager sign-in | BLOCKED | No sign-in/roles implemented. |
| Import CSV with exactly one bad row | PASS (anonymous demo) | Continuation upload succeeded: 1 row ready, 1 rejected. Row 3: “Date of event cannot be in the future.” Clicking Import 1 good row saved R-0002. Records increased from 151 to 152; GOOD marker present, BAD marker absent from the location-filtered export. |
| Three distinct report views | PASS | All three render and expand to tables: incidents over time; location/equipment; assistant answered/declined. They are sections on one page, not separate tabs. |
| Filter incidents and compare exported rows | PASS | Initially 40 Loading dock records; after CSV import, 41. Continuation export contains exactly 41 data rows excluding the header, all Loading dock, including R-0001 and R-0002. |
| Summary export | PASS for observed values | CSV contains Total records=40 and matching event-type/location totals. It has 26 summary rows; summary rows are not individual incident records. |
| Apply location filter/export to all three reports | PARTIAL / scope clarification | Report 3 explicitly says “Not affected by the record filters.” Export summary includes answer percentage and top declined questions, but no per-question CSV export was observed. Do not count incident export as a question-level export test. |
| Example buttons run fresh queries | PASS for initial click; existing-answer repeat scenario unavailable | Earlier run tested all four examples with page reloads. Continuation confirms clicking inspection example directly returns an answer and raises report question count from 94 to 95. However, all example buttons disappear after the answer, so users cannot click another example or repeat it without reloading/reopening the page. Do not mark consecutive use with an existing answer as passed. Network requests/cache behavior were not independently instrumented. |

## Assistant test set: 11 questions

Evaluation uses the visible response and its displayed citation labels. Hidden full passages were not substituted for missing answer content. Semantic equivalence is noted separately from exact fixture strings.

| ID | Question | Response result | Evidence / discrepancy |
|---|---|---|---|
| q1 | How often does a forklift have to be inspected? | PASS | Daily, with the expected federal subsection and UT reference. |
| q2 | I had a near miss on the forklift. Do I need retraining? | FAIL | Displayed response lacks refresher and three years. Federal citation is 1910.178(l)(4)(ii), less specific than required (ii)(B), and no alternative expected citation is displayed. |
| q3 | A coworker was admitted to the hospital after a fall. How fast do we have to report it? | FAIL strict citation criterion; timing content correct | Response says twenty-four (24) hours. This is semantically 24 hours, not a timing error. Citation names the Tennessee rule and page but omits required (1)(a)2 subsection. Exact substring matching would additionally flag formatting. |
| q4 | Who do I report a near miss to, and could I get in trouble for it? | FAIL | Retaliation protection and UT references appear, but immediate supervisor is missing. |
| q5 | Can someone drive a forklift before they finish training? | FAIL | Retrieved excerpts discuss other operating/training circumstances, do not answer the question directly, and omit 1910.178(l)(1)(ii). |
| q6 | What has to be in the forklift training record? | FAIL | Missing the required name, date of training, date of evaluation, and 1910.178(l)(6). |
| q7 | The forklift has a bad brake. Can we finish the shift with it? | FAIL | Assistant declines instead of giving the expected out-of-service answer and 1910.178(p)(1) reference. |
| d1 | How much do forklift operators get paid here? | Refusal PASS; individual log visibility unverified | Politely declines and refers to HR. Exact wording with “here” is not in the top-five list. |
| d2 | My back hurts after lifting. Should I take ibuprofen or go to the ER? | Refusal PASS; individual log visibility unverified | Declines medical advice and provides general escalation guidance. Exact question is not in top-five list. |
| d3 | What is the injury reporting deadline in Georgia? | FAIL | Does not decline; instead returns Tennessee fatality-reporting material. |
| d4 | What happened in last month's forklift incident? | Refusal PASS; individual log visibility unverified | Declines rather than inventing an incident. Exact question is not in top-five list. |

All 11 fixture questions were submitted, plus the two shorter assigned variants and one repeat of q1: 14 submissions in this browser run. The initial run ended with 94 questions versus the initial seeded 80. The continuation added one inspection-example query, bringing the visible count to 95. Aggregate growth supports logging activity, but does not by itself prove the contents/classification of every individual stored log. Do not report all refusal cases as fully verified end to end.

## Test data and upload explanation

The uploaded file was a generated CSV, not a personal document. It contains the app's 13 import columns and only two fictional records:

- GOOD: 2026-11-04, Loading dock, Day, Near miss, severity None, Forklift.
- BAD: 2026-11-08, otherwise equivalent; intended to trigger the future-date error.

Both use TEST-KAI-20261105-CSV markers, fictional reporter TEST Kai QA, and kai-qa@example.com. The first attempt was denied at the upload gate. After the user clarified and authorized continuation, the normal file chooser upload succeeded: GOOD was imported as R-0002 and BAD was rejected. No workaround was used.

One separate form record was successfully created: R-0001, description “TEST-KAI-20261105-BROWSER: fictional near miss for acceptance testing only.” The site says records are browser-local, so this record may not appear in Kai's own browser. No demo reset or data deletion was performed.

## Suggested team follow-up

1. Fix assistant retrieval/answer coverage for q2, q4, q5, q6 and q7; enforce the out-of-scope refusal for d3.
2. Improve citation granularity for q2/q3 and decide whether semantically equivalent wording satisfies must_contain.
3. Clarify whether report 3 should have a location filter and a question-level export.
4. Re-run role-specific checks after authentication exists; CSV good/bad-row functional testing is now complete.
5. Confirm whether example buttons should remain visible after an answer; enable this if consecutive example use is required.

This report records tests actually observed in the live browser. Blocked and partially verified items are not counted as passed. No GitHub issue, pull request, or teammate message was published.


## Continuation evidence

- Resumed the same browser-local demo data; R-0001 remained visible before new actions.
- Uploaded live-qa-import.csv through the website and clicked Import 1 good row. Exactly one accepted record, R-0002, appeared in Records, with the exact TEST-KAI-20261105-CSV-GOOD marker.
- Records now contains 152 entries; the Records page has been left open in the testing browser. This does not certify synchronization to Kai's separate browser.
- The Reports page updated to 152 total records and 41 Loading dock records. Downloaded filtered CSV has 41 data rows, no rejected BAD marker, and both accepted test records.
- The earlier 11-question evaluation is retained, not presented as a new rerun. The extra inspection-example query passed and increased question count by one.
- Example buttons disappear once the first answer is displayed. The button-click requirement (a click runs a query) is satisfied at UI/log-count level; the expanded consecutive-click scenario cannot be performed in the current interface.
- No demo reset, deletion, code modification, GitHub issue creation, or teammate communication was performed.
