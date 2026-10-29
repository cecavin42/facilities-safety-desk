# Specification

Owner: Catherine. Status: **draft**, consolidated on 2026-10-29 from the team notes doc after the team chose
the facilities-safety scenario. Each section is Catherine's proposal with Forrest's build constraints folded in.
Catherine confirms or edits; once confirmed, remove the word draft above. Zhu Lan's landscape scenario stays in
the notes doc as a possible second document corpus.

## Part 1: Who and why

### 1. Users
The facilities services department of a Tennessee university, modeled on UTK so we can use its published
safety procedures. About 150 employees run storerooms, loading docks, maintenance shops and grounds crews;
some drive forklifts.
- Facilities employees (forklift operators, storeroom staff, maintenance technicians, grounds crew): report an
  incident or near miss from a phone; get a fast, trustworthy answer to a safety question with a citation.
- Shift supervisors: see what was reported in their area and shift, follow up on open items, check a rule
  before directing the crew. Under UTK procedures they are the first person employees report to.
- Safety manager (EHS): clean, complete records in one place, trend charts, an exportable summary for leadership
  and the safety committee, and a view of which questions the documents fail to answer.

### 2. Problem
Two problems that feed each other. Incidents are reported by phone, email or paper, then typed into a
spreadsheet days later with missing fields; a monthly summary takes hours; near misses are rarely recorded.
Safety rules are spread across federal and Tennessee regulations and several UT procedures, so employees ask a
supervisor who may not know, or guess. The app puts reporting and answers in one database and links them.

### 3. One sentence
A web app where university facilities employees report safety incidents and near misses through a validated
form and ask a safety assistant questions it answers only with citations from federal and Tennessee rules and
UT procedures, while the safety manager views charts and exports a summary of both.

## Part 2: Documents and questions (assistant)

### 4. Documents
Five, all Tennessee-applicable (TOSHA follows the federal general industry standards). Ids match
`src/data/documents.json`.

| id | Document | Owner | Sharing |
|---|---|---|---|
| cfr-1910-178 | 29 CFR 1910.178, Powered Industrial Trucks | US DOL / OSHA | Public domain |
| tn-0800-01-03-05 | Tenn. Comp. R. & Regs. 0800-01-03-.05, Reporting Fatality, Injury and Illness Information | TN Dept. of Labor and Workforce Development | Public regulation |
| ut-sags130-k | UT SAGS130-K, Forklift Safety | University of Tennessee System | Nonprofit educational use with credit |
| ut-saad022-k | UT SAAD022-K, Incident and Accident Reporting | University of Tennessee System | Nonprofit educational use with credit |
| ut-saad021-k | UT SAAD021-K, Reporting Safety Hazards and Near Misses | University of Tennessee System | Nonprofit educational use with credit |

Added 2026-10-29 at Dr. Nordstrom's suggestion: a sixth document, a **fake staff directory** (names, roles,
areas, extensions, all invented) so the assistant can answer "who do I report this to?" with a person and
extension. Admins can add further documents through the app (see sections 8 and 11).

The UT documents may be shared with the team and instructor for a class project. The app credits UT on every
citation (appended by code, not left to the model) and is not used commercially. Each document stores its
source URL, owner and license line.

### 5. Example questions
The runnable set is `docs/test-questions.json`: seven questions with required phrases and citations, four
decline cases. Each becomes an automated check run against every preview deployment.

### 6. Questions the app must not answer
Not in the documents: pay ("How much do forklift operators get paid here?"), medical advice ("Should I take
ibuprofen or go to the ER?"), other states ("What is the reporting deadline in Georgia?"), and incident
records ("What happened in last month's forklift incident?"; v1 answers from documents only).

The app says: "I couldn't find that in the safety documents I have, so I won't guess." It points pay
questions to HR, injuries to the supervisor and 911 in an emergency, record questions to the reports page,
then lists the topics it can help with.

Rules: never answer without a cited passage; one fixed decline template; a retrieval score threshold below
which the app declines; every declined question is logged with its text for report 3.

## Part 3: Records and reports (insights)

### 7. Record fields and validation rules
Record: Incident / Near-Miss Report. (R) = required. Implemented in `src/lib/validation.ts`.
- Date of event (R): valid date, not in the future, not more than 1 year ago.
- Time of event: optional, 24-hour HH:MM.
- Location (R): one of Central storeroom, Loading dock, Maintenance shop, Grounds, Inside a campus building,
  Roadway or parking, Office.
- Building name: required only when location is Inside a campus building; 2 to 80 characters.
- Shift (R): Day, Evening, Night.
- Event type (R): Injury, Near miss, Property damage, Unsafe condition.
- Severity (R): None, First aid only, Medical treatment, Days away from work, Hospitalization. If event type is
  Near miss or Unsafe condition, severity must be None.
- Days away from work: required only when severity is Days away from work; whole number 1 to 180.
- Equipment involved (R): Forklift, Pallet jack, Utility vehicle or cart, Ladder, Power tool, Hand tool, None.
- Description (R): 20 to 2,000 characters.
- Immediate action taken: optional, up to 1,000 characters.
- Reporter: taken from the signed-in account once sign-in exists, not typed into the form.
- Status: system-set, Open by default; only the safety manager changes it (Open, Under review, Closed),
  enforced in code.
- Created date and record ID: system-set, not editable.
- No injured person's name, medical details or other personal health information in v1.

One server-side validation schema is shared by the form and the CSV import.

### 8. Other ways data gets in
- CSV upload by the safety manager (the old spreadsheet log). Same rules as the form. Dry run first: show
  rejected rows with reasons ("row 14: date is in the future"), then the manager confirms the import. A CSV
  template is downloadable so column names match.
- Seed data: about 150 fake records from a script in the repo so charts have something to show and anyone can
  reset the database.
- Assistant questions are saved automatically (question, date, answered or declined). Used in report 3.
- Document upload by the safety manager (admin only), added 2026-10-29 at Dr. Nordstrom's suggestion. Fields
  follow Zhu Lan's Reference Document record: title, owner or publisher, source URL, PDF up to 20 MB with
  extractable text, publication date, usage permission (Pending review, Permitted, Not permitted) with
  permission evidence, and a status that becomes active only after an admin activates it. The demo shows
  adding a policy document to the knowledge base.

### 9. Reports and export
- Report 1, Incidents over time: bar chart by month, split by event type; filters for date range, location,
  shift. Viewers: safety manager, department leadership, safety committee.
- Report 2, Where and with what: incidents by location and by equipment. Viewers: shift supervisors.
- Report 3, Assistant questions: questions per week, percent answered vs declined, top declined questions.
  Viewer: safety manager. Depends on the decline logging in section 6, so that ships early.
- Export: CSV of the currently filtered records (required). A one-page summary (date range, totals by event
  type, location and severity, open items, top 5 declined questions) as printable PDF is a stretch goal.

## Part 4: Size, access and limits

### 10. Scale
This term: 5 to 15 users; 150 seeded records plus 50 to 100 from testing; 5 documents under 200 pages;
20 to 50 questions a day at peak. One year in a real department: about 150 users; 1,000 to 2,000 records;
10 to 20 documents; up to 100 questions a day. Free tiers cover hosting and database; the model call per
question is the only real cost. Embeddings are computed once at ingest.

### 11. Roles and sign-in
Sign-in required (email). Two roles in v1:
- Employee: submit a report, see and edit own reports while Open, use the assistant.
- Safety manager (admin): everything, plus change status, delete records, upload CSV, export, and manage the
  knowledge base: upload, review and activate documents. Only admins can add documents.

Personalized answers (added 2026-10-29): sign-in carries the user's area and shift so "who do I report this
to?" can resolve to the right supervisor from the directory document.

Supervisor (read-only view of all reports and charts) is v1.1 if time allows. The instructor gets a demo
admin account.

### 12. Out of scope for v1
No real employee data. Not an official UT system (no link to UT forms, workers' comp or UT sign-in). No
automatic filing with TOSHA or OSHA. No email or text notifications. No photo or file attachments. No native
mobile app. No medical, legal or HR advice. No chat memory (each
question stands alone). No streaming answers. English only.

## Part 5: Done and how we work

### 13. Definition of done: three ten-minute checks
Run against the Vercel preview on every PR, and against production before calling v1 done.
1. Form and validation: sign in as an employee, submit a report with a future date, confirm a clear error;
   fix it, submit, confirm the record appears in the list.
2. Assistant: run `docs/test-questions.json`. Every answer case contains its phrases and cites its sources;
   every decline case declines and appears in report 3. (Automated script to follow.)
3. Reports and import: sign in as the safety manager, upload a test CSV with one bad row, confirm only that row
   is rejected with a reason; open all three reports, filter to one location, export CSV, confirm the row
   count matches the screen.

### 14. Constraints
- Hosting: Vercel free plan, GitHub, feature-branch preview deployments, Next.js.
- Database: free-tier Postgres via the Vercel Marketplace, pgvector for retrieval. Browser-local storage in the
  draft until then.
- Model: Claude Haiku 5.5 for answers ($0.10 per million input tokens, $0.50 output as of 2026-10). About
  $1.50 a month at 100 questions a day. Hard cap of $20 a month in the provider console. Sonnet 5.5 is the
  fallback if answer quality is not good enough (about $27 a month at the same load). Embeddings: Voyage or
  similar.
- Security and licensing: API keys server-side only; fake records only; documents limited to public
  regulations and UT procedures under educational-use terms, UT credited on every citation, no commercial
  use; the app must not look like an official UT site.
- Language: English only in v1.

### 15. Roles and meetings (placeholder, roles not yet agreed)
- Forrest drives the AI coding tool and owns branch workflow, deployment and database setup. Others drive on
  their own feature branches.
- Catherine keeps this file up to date.
- Zhu Lan leads testing: runs the section 13 checks on each preview deployment, records issues, verifies
  fixes. Everyone tests their own feature before requesting a merge.
- Meetings: Zoom, Thursdays 5:00 pm before the 5:30 meeting with the professors, short check-in after class.
  Email, phone or text between meetings.
