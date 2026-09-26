# AHL HR OS — Next.js UI and Feature Handoff

Status: implementation specification  
Prepared from: the live Apps Script employee form and HR Command Center source  
Purpose: give the Next.js UI developer one authoritative description of the current product, while the backend/database work proceeds independently.

## 1. Ownership split

### UI developer owns

- Next.js App Router pages, layouts and reusable React components.
- Responsive desktop, tablet and mobile behavior.
- Dashboard charts, tables, drawers, dialogs, forms, loading states and error states.
- Client-side form validation and accessible interactions.
- API integration through the contracts in this document. The UI must never call Google Sheets or Drive directly.

### Backend/database owner owns

- Server-only Google service-account authentication.
- Google Sheets reads, validated writes, batching, caching and concurrency controls.
- Drive folder creation and document uploads.
- Employee keys, record IDs, idempotency and audit logs.
- API routes/server actions, authorization and validation.
- Data migration from development copies and final production synchronization.

### Non-negotiable boundary

The existing live Apps Script applications and original spreadsheets must continue working. Do not change their IDs, code, deployments, triggers, sheet structure, permissions or data. Next.js development uses the development copies only.

## 2. Source material

### Production-compatible code snapshots

- HR dashboard backend: `../../appscrip_code/apps_script_deploy/hr_dashboard/Code.js`
- HR dashboard markup: `../../appscrip_code/apps_script_deploy/hr_dashboard/Index.html`
- HR dashboard client logic: `../../appscrip_code/apps_script_deploy/hr_dashboard/JavaScript.html`
- HR dashboard styling: `../../appscrip_code/apps_script_deploy/hr_dashboard/Stylesheet.html`
- Employee form backend: `../../appscrip_code/apps_script_deploy/employee_master_database/Code.js`
- Employee form UI: `../../appscrip_code/apps_script_deploy/employee_master_database/index.html`

### Visual references

- `../../appscrip_code/dashboard-live-v7.png`
- `../../appscrip_code/dashboard-desktop-preview.png`
- `../../appscrip_code/dashboard-mobile-preview.png`
- `../../appscrip_code/dashboard-tabs-preview.png`

The Next.js version should feel recognizably like the current dashboard, but may improve hierarchy, accessibility, spacing, performance and mobile navigation.

## 3. Development data sources

Use environment variables; do not hard-code IDs in React components.

| Purpose | Development file/folder ID |
| --- | --- |
| Employee Master development copy | `17RR3f2L6tokN_9HN3y96rghSdS5f6pE5KgEXNvpdgDU` |
| HR Tracker development copy | `1tfLOg-Id7RZASBKwnbxjeJv_-y-e85OsyaisvwimRus` |
| Database folder | `1igTQ2T1R3yOkPVqRJ9n69ghPzr4daOpm` |
| Employee Documents folder | `1NroiWT_PDFuYDxMjcRflvVyV0Y1ILEoz` |
| Backups folder | `1tSo-2l4JK5rzZVtTRLHVb0lWW8_UXiD_` |
| Archive folder | `1hObJCcGQazvpoZfpStEGqFvRHgSJuuaA` |

The current location is a restricted My Drive folder owned by `ai@americanhairline.com`. The service account has Editor access. A true Shared Drive remains the preferred final location for service-account-owned upload workflows.

## 4. Information architecture

Use a persistent left sidebar on large screens and a drawer/sheet menu on small screens.

1. Overview
2. Celebrations & Reviews
3. HR Records
4. Insights
5. Employee Directory
6. Add Employee

Employee detail opens as a right-side drawer on desktop and a full-screen sheet/page on mobile.

## 5. Global application shell

### Header

- Eyebrow: `WORKFORCE OVERVIEW`
- Title: `HR Command Center`
- Supporting sentence: `A clear view of your people, milestones and workforce mix.`
- Last-updated date and time.
- Refresh button with disabled/spinner state during reload.
- Mobile menu button.

### Global filters

- Search: name, employee ID, manager, designation, department, company and mobile.
- Company.
- Department.
- Gender.
- Employment status: Active by default, Left, or All.
- Clear filters.
- Every KPI, event list, chart, data-quality metric and directory result responds to the active employee filters.

### Application states

- Initial loading screen with progress treatment.
- Skeletons for cards and table rows are preferred over a blank screen.
- Refresh state should preserve the existing screen while data reloads.
- Empty states must explain why nothing is shown and suggest the next action.
- Error banner with retry action.
- Success/error toast for mutations.
- Confirmation dialog for consequential status changes.

## 6. Overview screen

Six KPI cards:

1. Employee records.
2. New this month, calculated from Date of Joining.
3. Average tenure, DOJ to today for the currently filtered employees.
4. Number of represented departments.
5. Birthdays in the next 30 days.
6. Feedback/reviews in the next 30 days.

Keep the current six accent families: indigo, emerald, sky, violet, rose and amber. Cards should expose labels, values and short explanations without relying on color alone.

## 7. Celebrations and review moments

### Upcoming birthdays

- Calculate from DOB for the next 30 calendar days.
- If the birthday has passed this year, use next year.
- Clamp leap-day anniversaries safely.
- Sort by days remaining, then employee name.
- Show date, name, department, upcoming age and `Today` / `Tomorrow` / `In N days`.
- Show at most eight items on the dashboard, with a route or control for the complete list.

### Feedback and tenure reviews

The exact business sequence is:

1. 7 days after joining — `7-day feedback`, meeting type `Onboarding Feedback`.
2. 15 days after joining — `15-day feedback`, meeting type `Onboarding Feedback`.
3. 1 calendar month after joining — `1-month feedback`, meeting type `Onboarding Feedback`.
4. 3 calendar months after joining — quarterly review.
5. Repeat every three calendar months without stopping: 6, 9, 12, 15, 18, 21, 24 months and so on.

After 12 months the cycle does not restart at zero. Labels must retain the total tenure context, for example:

- `1-year completion`
- `1 year + 3 months milestone`
- `1 year + 6 months milestone`
- `2-year completion`

Rules:

- Return the first review date greater than or equal to today.
- For month-end joiners, clamp to the final valid day of the target month.
- Employees with a missing/invalid DOJ or a future DOJ do not produce a review.
- Range tabs: Next 7 days, Next 15 days, Next 30 days and All upcoming.
- `All upcoming` displays the next upcoming review for every eligible employee, not every future recurrence.
- Each row has a `Record` action that opens the meeting dialog with employee, milestone, scheduled date and meeting type prefilled.

## 8. HR Records screen

### Meeting summary cards

- All meetings.
- Open records.
- Follow-ups due today through the next seven days, excluding Cancelled records.
- Warnings recorded.

### Meeting list

- Filter by Open, Completed, Cancelled or All.
- Sort newest update first.
- Show the latest 20 initially; provide pagination or load-more in Next.js.
- Row fields: employee, employee ID/key, meeting type, milestone, notes preview, meeting/scheduled date, follow-up date, warning indicator, record status and attachment link.

### Add meeting dialog

Fields:

- Employee — required.
- Meeting type — required: Onboarding Feedback, Quarterly Review, Appraisal, Warning, General, Follow-Up, Exit Meeting.
- Milestone.
- Scheduled date.
- Meeting date.
- Record status — Open, Completed, Cancelled.
- Warning given — Yes/No.
- Discussion notes — required, maximum 5,000 characters.
- Action taken — maximum 3,000 characters.
- Next follow-up date.
- Recorded by — supplied by the signed-in user where possible; required.
- Optional attachment: PDF, DOC, DOCX, PNG or JPG, maximum 5 MB.

Use an idempotency key/meeting ID generated before submission. Disable repeat submission while saving.

## 9. Workforce Insights screen

All charts respond to global filters.

- Employees by department: horizontal bar, top ten departments.
- Records by company: doughnut.
- Gender distribution: doughnut.
- Tenure bands: `< 6 months`, `6–12 months`, `1–2 years`, `2–5 years`, `5+ years`, `DOJ missing`.
- Joining trend: monthly line chart for the last 12 calendar months.

### Data-readiness panel

Show completion percentage and missing count for:

- Unique employee ID. Blank, `0` and duplicate IDs are incomplete.
- Date of joining.
- Date of birth.
- Department.
- Reporting manager.
- Gender.
- Company email.

Overall score is the rounded mean of the seven completion percentages.

## 10. Employee Directory

- Default sort: employee name ascending.
- Desktop columns: Employee, ID, Company, Department, Designation, Tenure and Profile action.
- Page size: 12.
- Show pagination range and total.
- On mobile use stacked employee cards or a horizontally scrollable table with a persistent profile action.

### Employee profile drawer

Hero area:

- Initials/avatar.
- Full name.
- Designation and department.
- Employee ID.
- Active/Left badge.
- Exact current tenure.

Show every available Master Sheet field, grouped into:

1. Employment & role.
2. Personal & contact.
3. Payroll & banking.
4. Goals & company.
5. Documents & declarations.
6. Other master data.

Show required-document status for Joining Letter and Policy Signing. Profile actions: Meeting, Document and Status.

Improvement: statutory IDs, bank account, salary, home address and political information are sensitive. Mask them by default and reveal them only for an authorized HR role. Never ship the complete profile in a public client payload.

## 11. Employee documents

### Document dialog

- Employee — required.
- Type: Joining Letter, Policy Signing, Meeting Attachment, Exit, Relieving Letter, Other.
- Status: Missing, Pending, Uploaded, Verified.
- File: PDF, DOC, DOCX, PNG or JPG, maximum 5 MB.
- File is mandatory when status is Uploaded or Verified.
- Notes, maximum 2,000 characters.
- Uploaded/updated by — signed-in user where possible; required.

The backend creates or reuses an employee folder and stores the Drive file ID/link in `HR_Documents`. Do not send service-account credentials or Google access tokens to the browser.

## 12. Employment status and exits

### Status dialog

- Employee — required.
- Status: Active or Left.
- Last working date: required when status is Left.
- Exit reason, maximum 2,000 characters.
- Optional relieving letter with the standard 5 MB/type limits.
- Updated by — signed-in user where possible; required.

Changing status must not delete or edit the employee’s master row. It updates `HR_Status` and writes `HR_Audit_Log`. Restoring an employee to Active preserves historical exit information while recording restoration metadata.

## 13. Add Employee / onboarding form

The Next.js application must preserve the current Employee Master Database & Alignment form. Organize it as a multi-step form instead of one very long page.

### Step 1 — Employment

- Full Name *
- Employee ID *
- Company *
- Current Designation *
- Department *
- Reporting Manager *
- Date of Joining *
- Total Years of Experience
- Company Email

### Step 2 — Personal and contact

- Date of Birth
- Gender
- Blood Group
- Aadhaar Card Number
- PAN Number — automatically uppercase on input and again on the server
- Permanent Address
- Current Address
- Mobile Number *
- Personal Email *
- Father’s Name
- Mother’s Name
- Emergency Contact Name
- Relationship
- Emergency Contact Number
- Number of Siblings

### Step 3 — Banking and compensation

- Bank Name
- Branch
- Account Number
- IFSC Code
- Current Salary per month
- Last Increment Year
- Increment Percentage

### Step 4 — Alignment and company information

- Short-term Goals
- Core Strengths
- Resource Requirements
- Alignment with Company Vision
- Primary Hobbies
- Company Assets

### Step 5 — Declarations

- Dietary Preference
- Political Background
- Political Details, conditionally required when Political Background is Yes
- Vehicle Ownership
- Housing Status
- Digital Signature *
- Signature Date *

Submission requirements:

- Validate department against the canonical list.
- Generate a stable Employee Key.
- Append exactly one validated row.
- Generate/store the employee-form PDF or equivalent immutable submission snapshot.
- Store its Drive file ID/link.
- Prevent duplicate submissions with an idempotency key.
- Show an explicit success page with the created employee and document link.

## 14. Canonical departments

1. Human Resources (HR)
2. Accounts
3. Video Editor
4. Graphic Designer
5. Digital Marketing
6. Artificial Intelligence (AI)
7. MIS Executive
8. Content Writer
9. Influencer Marketing
10. Videographer
11. Purchase
12. Customer Service Executive
13. Labour
14. Maintenance
15. Housekeeping
16. Process Coordinator
17. Inventory
18. Floor Manager
19. Business Development
20. AHL Technician
21. CRR
22. ALC Technician
23. Consultant
24. PMU

The UI reads this list from `/api/meta/departments`; do not duplicate it in multiple components.

## 15. Database schema

### Employees

Current Master Sheet headers, in order:

`Timestamp`, `Full Name`, `Employee ID`, `Company`, legacy blank column, `Current Designation`, `Department`, `Reporting Manager`, `Date of Joining (DOJ)`, `Total Years of Experience`, `Company E-mail ID`, `Date of Birth`, `Gender`, `Blood Group`, `Aadhar Card Number`, `PAN Number`, `Permanent Address`, `Current Address`, `Mobile Number`, `Personal E-mail ID`, `Father’s Name`, `Mother’s Name`, `Emergency Contact Name`, `Relationship`, `Emergency Contact Number`, `Number of Siblings`, `Bank Name`, `Branch`, `Account Number`, `IFSC Code`, `Current Salary`, `Last Increment Year`, `Increment Percentage`, `Short-term Goals`, `Core Strengths`, `Resource Requirements`, `Alignment with Company Vision`, `Primary Hobbies`, `Company Assets`, `Dietary Preference`, `Political Background`, `Political Details`, `Vehicle Ownership`, `Housing Status`, `Digital Signature`, `Date`, `PDF Link`.

The consolidated development database should add an immutable `Employee Key` column without changing the live Master Sheet.

Employee Key compatibility algorithm:

- Normalize the source Timestamp to a stable UTC representation.
- If Timestamp is unavailable, use `fallback|employeeId|fullName|rowNumber`.
- SHA-256 the normalized anchor.
- Use `EMP-` plus the first 20 uppercase hexadecimal characters.

Employee ID is a business field, not a primary key: existing values may be missing, duplicated or `0`.

### HR_Meetings

`Meeting ID`, `Employee Key`, `Employee ID`, `Employee Name`, `Milestone`, `Meeting Type`, `Scheduled Date`, `Meeting Date`, `Discussion Notes`, `Warning Given`, `Action Taken`, `Next Follow-Up Date`, `Attachment Link`, `Recorded By`, `Record Status`, `Created At`, `Updated At`.

### HR_Documents

`Document ID`, `Employee Key`, `Employee ID`, `Employee Name`, `Document Type`, `Document Status`, `File Name`, `Drive File ID`, `Drive Link`, `Notes`, `Uploaded By`, `Uploaded At`, `Updated At`.

### HR_Status

`Employee Key`, `Employee ID`, `Employee Name`, `Employment Status`, `Last Working Date`, `Exit Reason`, `Relieving Letter Link`, `Deactivated At`, `Deactivated By`, `Restored At`, `Restored By`, `Updated At`.

### HR_Audit_Log

`Log ID`, `Timestamp`, `Employee Key`, `Employee ID`, `Employee Name`, `Action Type`, `Record Type`, `Record ID`, `Details`, `Performed By`.

### Departments

`Department ID`, `Department Name`, `Active`, `Display Order`, `Updated At`.

### App_Config

`Key`, `Value`, `Description`, `Updated At`.

Initial configuration includes upload size/type limits, birthday horizon, milestone horizons, onboarding intervals and quarterly interval.

## 16. API contract for the UI

All responses use JSON. Mutations return `{ success, data?, error?, duplicate? }` and accept an `Idempotency-Key` header.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/dashboard` | KPIs, upcoming events and chart aggregates |
| GET | `/api/employees` | Paginated/filterable employee directory |
| POST | `/api/employees` | Create an employee and submission document |
| GET | `/api/employees/:employeeKey` | Authorized employee profile |
| PUT | `/api/employees/:employeeKey/status` | Deactivate or restore employee |
| GET | `/api/meetings` | Filtered/paginated meeting records |
| POST | `/api/meetings` | Add meeting and optional attachment |
| GET | `/api/documents` | Employee document metadata |
| POST | `/api/documents` | Add document record and optional upload |
| GET | `/api/meta/departments` | Canonical active departments |
| GET | `/api/health` | Backend, Sheets and Drive connectivity |

Use `multipart/form-data` only for routes containing files. Other mutations use JSON.

## 17. TypeScript view models

```ts
type EmploymentStatus = "Active" | "Left";
type MeetingStatus = "Open" | "Completed" | "Cancelled";
type DocumentStatus = "Missing" | "Pending" | "Uploaded" | "Verified";

type EmployeeSummary = {
  employeeKey: string;
  rowNumber: number;
  fullName: string;
  employeeId: string;
  company: string;
  designation: string;
  department: string;
  manager: string;
  doj: string;
  dob: string;
  gender: string;
  mobile: string;
  companyEmail: string;
  personalEmail: string;
  employmentStatus: EmploymentStatus;
};

type ReviewEvent = {
  employeeKey: string;
  employeeName: string;
  department: string;
  date: string;
  daysUntil: number;
  label: string;
  shortLabel: string;
  meetingType: "Onboarding Feedback" | "Quarterly Review";
};
```

The backend may return additional authorized profile fields, but list/dashboard endpoints must return only the minimum fields needed by the screen.

## 18. Visual system

### Foundation

- Font: Inter with a system sans-serif fallback.
- Page canvas: `#F4F6FA`.
- Main text/navy: `#111827`.
- Secondary text: `#667085`.
- Borders: `#E6EAF0`.
- Surface: white.
- Primary indigo: `#4F46E5`.
- Emerald: `#059669`.
- Sky: `#0284C7`.
- Violet: `#7C3AED`.
- Rose: `#E11D48`.
- Amber: `#D97706`.
- Card radius: approximately 16–18px.
- Subtle shadow: `0 12px 30px rgba(16,24,40,.06)`.

### Layout

- Dark navy left sidebar, approximately 250px.
- Main content with generous horizontal gutters and a readable maximum width.
- KPI grid: three columns desktop, two tablet, one mobile.
- Celebration/review panels: two columns desktop, one mobile.
- Chart grid: two columns with wide cards spanning both when required.
- Employee drawer: up to 680px wide on desktop; full-screen behavior on small devices.
- Forms: two-column desktop, one-column mobile.
- Desktop breakpoint behavior begins near 1180px; sidebar becomes a drawer below approximately 900px; single-column content below approximately 680px.

### UI improvements allowed

- Use real icons rather than two-letter placeholders while retaining labels.
- Add skeleton loading and optimistic non-destructive interactions.
- Add sticky table headers and accessible chart summaries.
- Add URL-backed filter state so views can be shared/reloaded.
- Add separate list pages for all birthdays, reviews, meetings and documents.
- Add role-aware masking of confidential profile fields.
- Keep the current calm, professional navy/indigo visual identity; do not turn it into a generic colorful admin template.

## 19. Accessibility and responsive acceptance

- Full keyboard access for navigation, filters, dialogs, drawer and pagination.
- Visible focus rings.
- Escape closes the active dialog/drawer.
- Dialog focus trapping and focus restoration.
- Accessible names for icon-only buttons.
- Do not communicate warning/status using color alone.
- Charts require text summaries or accessible tables.
- Minimum practical 44px touch targets on mobile.
- No horizontal page overflow at 360px width.
- Sensitive values must not appear in page source, client logs or analytics.

## 20. Performance expectations

- Server fetches Sheets data; browser never receives raw spreadsheet ranges.
- Batch related Sheets reads.
- Cache dashboard aggregates for 30–60 seconds and invalidate after a successful write.
- Paginate large lists server-side.
- Lazy-load charts and heavy dialogs.
- Do not base64-encode files in the browser for the Next.js version; stream multipart uploads to the server.
- Return only screen-specific view models.
- Target a responsive initial dashboard load under two seconds after warm cache under normal office network conditions.

## 21. Security requirements

- Never expose or import `service account.json` into client code.
- Never prefix service-account variables with `NEXT_PUBLIC_`.
- Restrict profile and mutation routes to authorized HR accounts.
- Treat the signed-in account as the authoritative `Recorded By`, `Uploaded By` and `Updated By` identity.
- Validate MIME type, extension and actual decoded size server-side.
- Escape spreadsheet formula prefixes (`=`, `+`, `-`, `@`) for user-entered text where appropriate.
- Record every mutation in `HR_Audit_Log`.
- Avoid logging personal, statutory, banking or salary data.

## 22. UI delivery checklist

- [ ] Application shell and responsive sidebar.
- [ ] Global filters with URL/state synchronization.
- [ ] Overview KPIs.
- [ ] Birthday list and full view.
- [ ] Onboarding and recurring quarterly review list.
- [ ] HR meeting records and create dialog.
- [ ] Insight charts and accessible summaries.
- [ ] Data-readiness panel.
- [ ] Paginated employee directory.
- [ ] Authorized employee profile drawer.
- [ ] Document dialog and checklist.
- [ ] Active/Left status workflow.
- [ ] Multi-step Add Employee form.
- [ ] Loading, empty, error and toast states.
- [ ] Desktop/tablet/mobile QA.
- [ ] No direct Google API or service-account usage in client components.

## 23. Definition of done

The UI is complete when every current Apps Script capability described here is represented, tenure dates match the documented sequence, mobile behavior is usable, confidential data is protected, all mutations consume backend APIs rather than Google directly, and the current live Apps Script system remains unaffected.
