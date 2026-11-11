# PR #12 — Safety Manager Test Addendum

**Tester:** Zhu Lan (Kai)  
**Test sessions:** November 10–11, 2026 (UTC)  
**Continuation:** Resumed after a session interruption; completed checks were retained rather than rerun.  
**PR:** https://github.com/cecavin42/facilities-safety-desk/pull/12  
**Branch / head:** `forrest/consolidated-contributions` / `17b5a59e557b5969c6e308448b6607212053d6d7`  
**Environment:** Team PR preview, https://facilities-safety-desk-git-fo-33fc43-catherine-cavin-s-projects.vercel.app  
**PR status checked November 11:** Open, not merged. The PR head was unchanged. The deployed commit was not independently read from the application UI.

## Assessment

The exercised Safety Manager workflows passed, including mixed-row CSV import, duplicate protection, report creation and status changes, filtered exports, and the source-library draft → active → retired lifecycle. New source retrieval worked with a correct passage citation. The assistant deliberately returned related-source / partial coverage rather than generating a complete answer, consistent with the PR's stated scope of no hosted AI model.

This is **not a full release sign-off**. Same-preview Employee access isolation remains unverified, source-download integrity needs investigation, and several Reference Document design differences need a team decision. No merge, production deployment, account creation, recovery-link issuance, or access changes were performed.

The November 8 Employee report was run on Forrest's separate test site (`fsd-forrest-test.vercel.app`). Its results remain historical evidence for that environment; they do not prove Employee isolation on this team preview. This addendum supplements that report without replacing it.

## Completed before the interruption — retained results

These checks were not rerun during the continuation, except that restoring an expired login was necessary to resume work.

| Check | Observed result | Status |
| --- | --- | --- |
| Manager sign-in and navigation | Signed in as Zhu Lan, Safety manager. All nine expected workspace / management destinations were visible. | Pass |
| Existing register | 150 sample reports before the two test submissions. | Pass |
| Mixed-validity CSV preview | Two input rows: one valid and one future-dated. Preview identified one valid row and one correction, with a clear future-date reason on CSV row 3. | Pass |
| Partial CSV import | Imported one row, skipped one invalid row. Register increased to 151; only the valid TEST row was found. | Pass |
| CSV duplicate protection | Uploading that same CSV again identified one exact duplicate. Default duplicate skipping left zero rows to import, with the import action disabled. | Pass |
| Status update | Imported report R-1 changed from Open to Under review; state persisted after reload. | Pass |
| Manager report form | A fictional Near miss report was saved as R-2, with “Your report is saved.” Register increased to 152. | Pass |
| Safety insights | Three sections were present: Incidents over time, Where incidents happen, and Assistant coverage / Questions to review. | Pass |
| Filtered record export | Location = Grounds showed 25 records; exported CSV contained exactly 25 Grounds rows, including both TEST reports and the updated R-1 status. | Pass |
| Summary export | Counts matched the Grounds screen: 25 total, 9 Open / under review; Injury 7, Near miss 9, Property damage 1, Unsafe condition 8. | Pass |
| Forklift question | “How often does a forklift have to be inspected?” returned at least daily, plus each-shift inspection for round-the-clock use, citing 1910.178(q)(7). | Pass |
| Payroll question | “How much do forklift operators get paid here?” returned Not covered by these sources. | Pass |
| Assistant statistics | After refresh, totals changed from 37 answered / 72 questions to 38 / 74. This verifies the aggregate increment; the exact new payroll question was not visible among the five displayed review items. | Pass, aggregate only |
| Blank source submission | Required-field validation prevented submission and focused Document title. | Pass |
| Oversized source | A 4,194,305-byte TXT file was rejected: “Choose a nonempty file up to 4 MB.” No draft was created. | Pass for over-limit rejection |
| PDF without extractable text | A one-page PDF with no usable text was rejected with an OCR / no-usable-text explanation. | Pass |

CSV import has a separate displayed limit of 5 MB / 5,000 rows; the source-upload requirement tested here is 4 MB.

## Newly completed in the resumed session

### Source lifecycle and retrieval

Test source: **TEST PR12 source lifecycle 20261110**. The synthetic PDF explicitly identifies itself as fictional classroom QA, not operational safety guidance. Its original-source field is a reserved `example.org` fixture URL, not a claimed external publication.

| Stage | Evidence | Status |
| --- | --- | --- |
| Resume interrupted PDF upload | Existing v1 draft was present. The one-page text, metadata, and unique “Cedar Lantern 47” label were intact. No second PDF upload was submitted. | Pass |
| Draft isolation | Assistant showed five documents. A new question about the fictional checklist returned Not covered, with no citation to the draft. | Pass |
| Review gate | Activate was disabled until the checkbox acknowledging review of publisher, scope, revision, extracted text and usage rights was checked. | Pass for UI gate |
| Activation | Success message confirmed activation; active count increased from five to six. | Pass |
| Active-source retrieval | The same question, submitted after the state change, returned Partial coverage / Related-source search and cited this test document, page 1, version 1. Expanding the citation showed the correct complete passage including “Cedar Lantern 47.” | Pass for retrieval and citation |
| Retirement | Success message confirmed the version was retired and could not support new answers. Active count returned to five; retired count became one. | Pass |
| Retired-source exclusion | A fresh submission of the same question returned Not covered without the test-source citation. | Pass |
| Historical evidence | The earlier active-state answer retained its source snapshot and passage in the existing conversation. This is historical evidence, not a new use of the retired source. | Observed |
| Audit trail | Team access showed Source draft uploaded, Source version activated, and Source version retired for this test document. | Pass |

The source snapshot changed from `243f1f0232759bd1` to `7828d90225e34a93` on activation and returned to `243f1f0232759bd1` for the post-retirement query. Reusing the question across three different source states was the lifecycle test, not repetition of previously completed assistant fixtures.

### Version creation and identical-file rejection

A small original TXT fixture containing the distinct label “Silver Maple 83” was uploaded using **Version of → TEST PR12 source lifecycle 20261110**. It was accepted as **draft v2**, with extracted text visible. Uploading the identical TXT again under the same source was rejected with:

> This file is already a version of that source.

No v3 appeared. The final library state was **5 active, 1 draft, 1 retired, 7 total versions**. The v2 fixture remains a draft and was never activated. This confirms TXT acceptance and identical-file rejection within the same source. It does not establish cross-source duplicate detection or replacement of an already-active version.

### Manager account and access page

- My account showed the password-change form and no MFA option. No password was entered or changed.
- Team access loaded the account list and recent activity. The current user's role, active status, save-access action, and recovery-link action were disabled.
- No other person's role, status, credentials, or recovery settings were changed.
- The listed accounts did not include a separate Employee account for Kai. Same-preview Employee testing therefore remains outstanding.

## Source download — unresolved observation

The test PDF's **Download this version** link produced a local file of zero bytes. A second browser-supported download path also yielded zero bytes. The source text remained intact in the application's extracted-text view.

**Classification:** Needs investigation; not a confirmed application defect and not a passing download check. These observations do not distinguish a source-storage / download endpoint issue from the browser download environment. An independent browser download of v1 and verification that the PDF opens would resolve this. The original upload was recorded as a 2,011-byte PDF in the preceding session.

For this reason, identical-file rejection was tested with the new locally controlled TXT fixture, not with a reconstructed or empty copy of the PDF.

## Comparison with Kai's Reference Document design

The agreed size revision is **4 MB**. No repository specification was edited during this test.

| Design item | Observed implementation | Assessment / action |
| --- | --- | --- |
| Source file up to 4 MB | UI states 4 MB / 100 pages; over-limit file rejected; small text PDF accepted. | Agrees with revised size requirement. Exact 4 MB boundary remains untested. |
| Extractable PDF text | Empty-text PDF rejected; valid text PDF extracted correctly. | Agrees. |
| PDF as original planned format | TXT and Markdown are also offered; TXT was accepted. | Broader scope. Confirm whether these additional formats are intended. |
| Title 1–200 characters | Required text field with client `maxLength=500`. | UI differs from design. Server-side length limits were not independently established. |
| Publisher 2–200 characters | Required text field with client `maxLength=500`, without a client minimum-length constraint. | Align validation with the agreed design. |
| Scope 2–100 characters | Required text field with client `maxLength=500`, without a client minimum-length constraint. | Align validation with the agreed design. |
| Optional revision / publication date, valid and no later than today | Required free-text field rather than a date input. | UI differs. Invalid / future-date source submissions were not tested. |
| Required HTTPS original-source URL | Required URL field. | Presence and URL input type observed; HTTPS-only server validation not tested. |
| Usage permission enum: Pending Review / Permitted / Not Permitted; evidence required when permitted | One required free-text attribution / permission field, plus a manual review checkbox before activation. | Manual review exists, but structured permission status and conditional evidence fields are not implemented in this UI. Team decision needed. |
| Pending status until review and activation | Draft upload, disabled activation before acknowledgement, active-only retrieval. | Core workflow agrees; status wording differs. |
| System-generated immutable record identifiers and upload time | User cannot edit an ID or upload timestamp in the upload form; audit activity records upload time. | UI observation only; no server immutability test. |

These differences are acceptance-design decisions or validation gaps, not evidence that every differing input is accepted by the server. The PR explicitly excludes an automatic source-consistency checker; it was not treated as an implemented feature.

## Remaining checks and decision

1. **Same-preview Employee role check (PR click step 7):** use an authorized Employee account on this exact preview to verify restricted navigation, own-record visibility, and denial of manager-only pages. The earlier separate-site test cannot substitute for this environment.
2. **Download integrity:** independently retrieve the test PDF v1 and confirm nonempty, readable bytes.
3. **Design agreement:** settle the metadata lengths, optional date, structured permission status / evidence, and accepted formats before claiming full compliance with the Reference Document design.
4. **Not exercised here:** exact 4 MB / 100-page boundaries, malformed source metadata on the server, active-version replacement, password change, recovery links, backup / restore, production migration, rollback, and production deployment. These are outside the completed UI evidence and should not be marked passed based on this report.

The manager portion of the PR walkthrough is supported by the recorded evidence. Full dual-role acceptance remains open. Catherine retains the merge decision.

## Test data left for review

| Item | Final state |
| --- | --- |
| Preview report R-1 | Fictional CSV test, Grounds, Under review. Description starts `TEST PR12 manager CSV 20261110 valid row`. |
| Preview report R-2 | Fictional form test, Grounds, Open. Description starts `TEST PR12 manager form 20261110`. |
| Source v1, ID `c290bd18-3981-40c7-93b2-45e2a20d0c7d` | Retired PDF with the Cedar Lantern 47 fixture; excluded from new answers. |
| Source v2, ID `6b5cf019-8a04-483a-8aaf-d4d7d92629c1` | Draft TXT with the Silver Maple 83 fixture; never activated. |
| Assistant checks | Fictional test queries remain in the application's question statistics. |

Report IDs are scoped to this team preview; similarly named IDs from the November 8 separate test site are different records. Original sample reports and the five bundled active sources were not modified.
