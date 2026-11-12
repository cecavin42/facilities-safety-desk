# PR #12 — Interim Acceptance Test Report

**Project:** Facilities Safety Desk  
**Test lead:** Zhu Lan (Kai)  
**Test date:** November 8, 2026 (America/Chicago)  
**Environment:** https://fsd-forrest-test.vercel.app  
**PR:** https://github.com/cecavin42/facilities-safety-desk/pull/12  
**Available role:** Employee — Zhu Lan (Kai) (review)  
**Overall status:** Partial acceptance completed; Safety manager/admin testing remains pending.

## 1. Scope and conclusion

This report records browser-based acceptance checks on Forrest's independent test deployment. The employee reporting workflow, visible role restrictions, source browsing, account page, sign-out behavior, and assistant questions were exercised.

The employee checks below passed within the tested scope. All seven in-scope assistant questions returned the expected answer concepts, and all four out-of-scope questions were declined. Two citation-display differences need review before claiming exact compliance with the test fixture. No blocking employee-workflow failure was confirmed.

This is not full approval to merge. A Safety manager/admin account is required to finish the PR walkthrough, source-upload review, import and reporting checks, and cross-role access verification.

The PR author identified this test deployment as running the PR code. Its deployed commit was not independently verified. These results do not validate the team's PR Preview, production deployment, production database migration, or rollback process. Tests were executed through browser automation under Kai's direction; this was not a source-code security audit.

## 2. Employee workflow results

| Check | Result | Observed evidence |
| --- | --- | --- |
| Approved-account sign-in | Pass | Signed in successfully; the workspace identified the account as Employee. |
| Employee navigation | Pass | Safety insights, Import incidents, and Team access were absent. Overview, Incident register, New report, Source library, Safety assistant, and My account were available. |
| Initial employee register | Pass within scope | The register initially showed 0 records and “Your reports only.” Isolation from another employee's records still needs a second account. |
| Required-field validation | Pass | Submitting a blank report produced nine field-specific errors with links to the relevant inputs. |
| Future event date | Pass | A future date was rejected with “Date of event cannot be in the future.” The valid test report was ultimately saved with event date 2026-11-08. |
| Building-name rule | Pass | Selecting “Inside a campus building” without a building name produced a specific error. |
| Near-miss severity rule | Pass | Near miss with First aid only was rejected; changing Severity to None resolved that error. |
| Valid report submission | Pass | The corrected form showed “Your report is saved,” reference R-2, status Open. |
| Register, search, and persistence | Pass | R-2 appeared in the register, was found by “TEST PR12 Kai,” and remained after a browser reload. Expanded details matched the submitted fields. |
| Employee CSV export | Pass | “Export 1 record” downloaded a CSV containing exactly one data row, R-2, matching the displayed record. This does not cover administrator report exports. |
| My account | Pass | The page displayed the password-change form and no MFA option. No password was changed. |
| Employee source browsing | Pass | Five active sources were listed. Opening UT SAAD021-K showed its version, publisher, revision, scope, credit, original-source link, and extracted passages. No upload or management controls were shown. |
| Sign-out and protected page | Pass | After sign-out, navigating to /records redirected to /sign-in. |

### Test record retained

- **Reference:** R-2; **status:** Open.
- **Event:** Near miss; **severity:** None; **date:** 2026-11-08.
- **Location:** Inside a campus building; **building:** TEST Training Building; **shift:** Day; **equipment:** Forklift.
- **Description:** TEST PR12 Kai acceptance: fictional near miss in the training area. No real incident or injury.
- **Fictional reporter:** Test Reviewer; pr12-review@example.test.

The record remains on the independent test site for manager-side verification. No production record was created. The displayed/exported creation date was 2026-11-09; the test date above uses America/Chicago. No date-display defect is concluded from this difference.

## 3. Assistant acceptance questions

The 11 cases were taken from [docs/test-questions.json at the reviewed PR head](https://github.com/cecavin42/facilities-safety-desk/blob/17b5a59e557b5969c6e308448b6607212053d6d7/docs/test-questions.json). Answers were checked in the browser against the expected concepts and displayed evidence. The observed source snapshot was `dddd84838881e9fd`.

| Case | Observed result | Assessment |
| --- | --- | --- |
| Q1 — Forklift inspection frequency | Answer included “at least daily” and after each shift for round-the-clock use; evidence displayed 1910.178(q)(7). | Pass |
| Q2 — Retraining after a near miss | Answer included refresher training and evaluation at least every three years; expanded passages supported both statements. | Content passes; citation-format follow-up below |
| Q3 — Hospitalization reporting | Answer included 24 hours, admission for care/treatment, the observation-only exclusion, and timing conditions. Expanded Tennessee source text contained the relevant reporting requirement. | Content passes; citation-format follow-up below |
| Q4 — Near-miss reporting and retaliation | Answer identified the immediate supervisor and protection from retaliation, citing UT SAAD021-K. | Pass |
| Q5 — Operating before training is complete | Answer distinguished normal operation from the qualified-supervision training exception; cited 1910.178(l)(1)(ii) and (l)(2). | Pass |
| Q6 — Training record contents | Answer included the operator's name, date of training, date of evaluation, and trainer/evaluator identity; cited 1910.178(l)(6). | Pass |
| Q7 — Defective forklift | Answer said to take unsafe equipment out of service; evidence displayed 1910.178(p)(1)-(2). | Pass; displayed range includes the required subsection |
| D1 — Pay | Displayed “Not covered by these sources”; did not invent pay information. | Refusal passes; statistics logging pending |
| D2 — Medical advice | Displayed “Not covered by these sources”; did not recommend a treatment. | Refusal passes; statistics logging pending |
| D3 — Georgia reporting deadline | Declined because the available Tennessee rules do not establish another jurisdiction's deadline. | Refusal passes; statistics logging pending |
| D4 — Last month's incident | Declined an individual incident-record lookup and explained that it searches policy documents. | Refusal passes; statistics logging pending |

### Citation-display follow-up

1. **Q2:** The fixture lists 29 CFR 1910.178(l)(4)(ii)(B), 29 CFR 1910.178(l)(4)(iii), or UT SAGS130-K. The UI instead displayed the broader `(l)(4)(ii)` and a combined `(l)(4)(ii)(D)-(E); (l)(4)(iii)` label. Expanded evidence contained the near-miss trigger and three-year evaluation rule. This is a citation-label/fixture alignment issue, not a confirmed incorrect answer.
2. **Q3:** The fixture requests `Tenn. Comp. R. & Regs. 0800-01-03-.05(1)(a)2`. The UI showed the regulation title with page numbers, including page 1, rather than that complete subsection label. The expanded passage contained the relevant `(1)(a)2` requirement. Confirm whether page-based citation is accepted or update the displayed citation to match the agreed criterion.

### Additional assistant interaction checks

- Clicking the “Inspect equipment” example automatically submitted a fresh question and returned the round-the-clock inspection answer; a separate Check sources click was not needed.
- “Copy answer and sources” copied the answer, OSHA source URL, citation, and source-snapshot notice.
- “Clear conversation” cleared the visible conversation. Deletion of stored statistics was neither expected nor tested. This session submitted 12 assistant questions in total: the 11 fixture cases and one example-button question.

## 4. Reference Document design alignment

**Accepted design revision:** Kai accepts changing the maximum document upload size from **20 MB to 4 MB**, consistent with the limit described in PR #12. This report records the revised acceptance criterion; no repository specification or application code was changed as part of this report. Actual enforcement of the 4 MB limit remains untested.

The remaining original design requirements below still need manager-side verification. Existing source metadata alone does not prove that upload-form validation enforces them.

| Design requirement | Current acceptance criterion | Verification status |
| --- | --- | --- |
| Document title | Required; 1–200 characters after trimming | Upload form pending |
| Owner/publisher | Required; 2–200 characters | Existing publisher metadata visible; upload validation pending |
| Source URL | Required; valid HTTPS URL pointing to the original publication/download | Existing original-source link visible; upload validation pending |
| Document file | Required PDF; maximum 4 MB; text must be extractable before search use | Existing extracted text visible; file/type/size/extraction checks pending |
| Publication/revision date | Optional valid date, not later than today | Existing revision metadata visible; upload validation pending |
| Geographic scope | Required; 2–100 characters | Existing scope metadata visible; upload validation pending |
| Usage permission | Required; Pending Review / Permitted / Not Permitted; defaults to Pending Review | Pending |
| Permission evidence | Required when permission is Permitted; reuse-terms URL or written permission basis | Pending |
| Activation status | Pending by default; authorized activation only after permission and extraction checks pass | Active sources visible; upload-to-activation flow pending |
| Record ID / upload date | System-generated and not user-editable | Pending |

Duplicate-upload detection and version handling are additional behaviors described in Forrest's PR and should be checked against that description. Automatic document consistency checking is explicitly not implemented in this PR; it is outside this release's acceptance scope.

## 5. Remaining work and account request

A separate **Safety manager/admin test account** is preferred, while retaining Kai's Employee account, so the same records and features can be compared across roles.

Pending checks:

1. Verify the full administrator menu and access to all records, including employee-created R-2. The PR's expected 150 sample records applies to its walkthrough; sample-data parity on this separate deployment has not been established.
2. Exercise report status changes and verify the employee sees the updated status for their own report.
3. Import a CSV with valid and invalid rows, verify rejection reasons, and check duplicate detection.
4. Review the agreed reporting views, location filters, export counts, and declined-question statistics.
5. Inspect the source-upload form against the design above; test draft creation, permission/extraction checks, activation, assistant use/citation, duplicate detection, and the accepted 4 MB boundary.
6. Verify that restricted manager pages/actions and other employees' records remain inaccessible to an Employee. Hidden navigation alone does not establish server-side enforcement.
7. Inspect Team access visibility and the administrator account page. Account creation, role changes, password changes, and recovery operations have not been performed.

**Handoff:** Share this interim report with Forrest/Catherine, obtain manager testing access, and complete the pending checks before giving a full acceptance recommendation. Team Preview/deployment readiness remains a separate release check.
