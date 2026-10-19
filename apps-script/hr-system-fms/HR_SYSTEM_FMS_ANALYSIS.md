# AHL HR Management & FMS System — Comprehensive Codebase Analysis & Integration Specification

> **Target Google Sheet**: [HR System Spreadsheet (`1LVl3-5f8vLGt7YRTbmquUR09UFJgb9J0lTn7XSGc7OM`)](https://docs.google.com/spreadsheets/d/1LVl3-5f8vLGt7YRTbmquUR09UFJgb9J0lTn7XSGc7OM/edit?gid=1380653283#gid=1380653283)  
> **Apps Script Project**: [HR System Script (`1vEcnQOg5IqpZcnu4pZbsh0nJsVR1rKViF0EERcO3i_YHo9zLDVBB2sNG`)](https://script.google.com/u/0/home/projects/1vEcnQOg5IqpZcnu4pZbsh0nJsVR1rKViF0EERcO3i_YHo9zLDVBB2sNG/edit)  
> **Local Pulled Folder**: `c:\Users\admin\Desktop\HR_Dashboard\HR system FMS` (`Code.js`, `Index.html`, `appsscript.json`, `.clasp.json`)

---

## 1. Executive Summary & Purpose of the System

This codebase is the **AHL HR Management & FMS (Flow Management System)**. It was built as a Google Apps Script full-stack web application designed to track and enforce operational workflows (FMS) across the employee and candidate lifecycle for **American Hairline (AHL)** and **Alchemane (ALC)**.

### What is "FMS" (Flow / Follow-up Management System)?
In standard business operations, an FMS is a step-by-step pipeline where every stage must have:
1. **Planned Date**: When the task or stage should finish.
2. **Actual Date**: When the task or stage was actually completed.
3. **Status**: `Pending`, `In Progress`, `Completed`, `Overdue`, `Dropped`.
4. **Delay**: Calculated days of delay (`Actual Date - Planned Date`).
5. **Checklists**: Operational gates that must be ticked off before moving to the next stage.
6. **Dedicated Stage Fields**: Specific operational data captured at that exact stage.

---

## 2. Core Modules & Feature Breakdown

### Module 1: Candidate Recruitment FMS (`Candidate Applications` & `Candidate FMS`)
Tracks candidates from initial application through screening, interview, offer, documentation, and joining.

#### The 6 Candidate Stages (`CAND_STAGES`):
1. **Application Received (`ar`)** (SLA: 1-2 days / 0.14 weeks, Blue)
   - *Checklist*: Received application form, Verified contact details, Acknowledged receipt, Linked to requisition.
   - *Fields*: `sourceChannel` (LinkedIn, walk-in, referral), `initialNotes`.
2. **Pre-Screening (`ps`)** (SLA: 3 days / 0.43 weeks, Amber)
   - *Checklist*: Resume reviewed against JD, Skills match confirmed, Experience verified, Phone/video screen scheduled, Candidate responded.
   - *Fields*: `screeningResult` (`Pass`, `Hold`, `Fail`), `screeningNotes`.
3. **Confirmation Call (`cc`)** (SLA: 2 days / 0.29 weeks, Violet)
   - *Checklist*: Confirmation call completed, Availability confirmed, Salary expectations discussed, Notice period confirmed, Interview scheduled.
   - *Fields*: `callDate`, `noticePeriod`, `salaryExpected`, `callNotes`.
4. **Joining / Offer (`jo`)** (SLA: 7 days / 1 week, Teal)
   - *Checklist*: Offer letter sent, Offer accepted, Background check initiated, Joining date confirmed, Pre-joining documents collected, IT setup requested.
   - *Fields*: `offerDate`, `joiningDate`, `offeredSalary`, `uniformSize` (S, M, L, XL, XXL, Custom), `uniformDetails`, `joiningNotes`.
5. **Documentation (`doc`)** (SLA: 3-4 days / 0.5 weeks, Indigo)
   - *Checklist*: KYC documents received, Personal details verified, Bank account details collected, Family details updated.
   - *Fields*: DOB, Gender, Blood Group, Aadhaar Number, PAN Number, Bank Name, Branch, Account Number, IFSC Code.
   - *Database Feature*: User explicitly requested these fields be stored in **dedicated sheet columns** rather than JSON strings.
6. **Onboarding (`ob`)** (SLA: 14 days / 2 weeks, Green)
   - *Checklist*: Welcome email sent, ID/access card issued, System accounts created, Mentor assigned, First day orientation, Training plan shared, Handbook signed, First week check-in done.
   - *Fields*: `empId` (Assigned employee ID), `mentorName`, `onboardingNotes`.

#### Automated Promotion to Master Employees:
- Function: `onboardCandidate(candidateId)`
- When a candidate finishes onboarding, this function appends their row directly into the `Employees` tab, sets their status to `Active`, and creates an entry in `OnboardingProgress`.

---

### Module 2: Job Requisitions Pipeline (`Requisitions`)
Manages open hiring requisitions across departments:
- **Fields**: ID, Job Title, Department, Hiring Manager, Job Level, Employment Type, Location, Deadline, Reason, Status (`Open`, `Filled`, `Cancelled`), Min/Max Experience, Openings, Budget, Required Skills, Recruiter Name, Priority (`High`, `Medium`, `Low`), Target Start Date, Job Description, Notes.
- **Linkage**: Associates applications and hired candidates directly to their requisition ID.

---

### Module 3: Interview Scoring & Tracking (`Interview`)
- Tracks candidate interview evaluations:
  - Technical & behavioral question ratings.
  - Per-question scores and overall score.
  - Proctoring metrics (Tab switches count).
  - Status: `Scheduled`, `Completed`, `Passed`, `Rejected`.
- **Today's Interviews Screen (`todayinterviewsPage`)**: HR view of all interviews scheduled for the current day with direct call/WhatsApp triggers.

---

### Module 4: HR Problem Tracker FMS (`ProblemTracker`)
Internal issue-resolution workflow for employee grievances, operational blockers, and HR compliance issues.

#### The 4 Problem Stages (`PROBLEM_STAGES`):
1. **Report Logged (`p1`)**: Issue intake, description, priority, category, owner.
2. **Issue Analysis (`p2`)**: Root cause diagnosis, severity assessment, action proposal.
3. **Resolution (`p3`)**: Implementation of corrective actions.
4. **Closure (`p4`)**: Sign-off, verification, and closure.
- **Views**:
  - Interactive Table View with status badges.
  - Visual Kanban Board (`prbKanbanView`) with drag-and-drop / stage advancement.
  - SLA & Delay tracking (`getHistoricalStageMetrics()`): tracks average turnaround time per stage.

---

### Module 5: Training Management FMS (`Trainings`)
Corporate training, salon skills workshops, and onboarding training programs.

#### The 5 Training Stages (`TR_STAGES`):
1. **Planning (`tr_plan`)**: Training need identified, budget approved, trainer shortlisted.
2. **Scheduling (`tr_schedule`)**: Participant roster confirmed, venue booked, invites dispatched.
3. **In Progress (`tr_progress`)**: Attendance tracking, trainer agenda adherence.
4. **Evaluation (`tr_eval`)**: Feedback forms, assessment quiz, certificates issued.
5. **Completed (`tr_closed`)**: Final outcome report, follow-up recommendations.
- **View**: Training Kanban Board (`renderTrainingKanban()`).

---

### Module 6: Leaves & Holiday Management (`Leaves` & `Holidays`)
- **Leaves**:
  - Request submission (Employee ID, Brand, Leave Type, Days, From Date, To Date, Reason).
  - Multi-tier approval workflow (`Pending`, `Approved`, `Rejected`, `Approved By`).
- **Holidays**:
  - Pre-seeded national and festive calendar (Republic Day, Holi, Independence Day, Gandhi Jayanti, Diwali, Christmas).
  - Filterable by entity (`ahl`, `alchamae`, `both`).

---

### Module 7: Employee Lifecycle & Check-ins (`LifecycleEvents` & `Feedback`)
- **Lifecycle Events**:
  - Tracks promotions, departmental transfers, salary revisions, and disciplinary warnings with timestamps and author audits.
- **Feedback & 1-on-1s**:
  - Periodic manager/HR reviews with ratings (1–5 scale), discussion points, and identified problems.

---

### Module 8: Exit Management & Retention (`exitPage` & `retentionPage`)
- **Exit Workflow**:
  - Resignation logging, notice period tracking, last working date.
  - Exit Interview questionnaire.
  - Exit Checklist: Handover of assets, system deactivation, relieving letter issuance, final settlement.
- **Retention Analytics**:
  - At-risk employee tracking, tenure risk scoring, turnover trends.

---

### Module 9: Team DISC Psychometrics & Bulk WhatsApp Automation
- Integrates with the HireOS backend (`callHireOs_`).
- Generates team-level personality distribution analytics (D, I, S, C percentages).
- **Bulk WhatsApp Dispatcher**:
  - `sendBulkEmployeeDiscLinks()`: Dispatches personalized psychometric assessment links to all eligible employees over WhatsApp using WAHA!
  - Automated queuing & rate-limiting with Apps Script triggers (`scheduleDiscBulkQueue_`, `processDiscBulkQueue_`).

---

### Module 10: Role-Based Access Control & Multi-Brand Context
- **Roles**:
  - `Admin`: Unrestricted access across all brands and modules.
  - `HR`: Recruitment, candidates, FMS pipelines, problems, training.
  - `Manager`: Team requisitions, interview feedback, team leave approvals.
  - `Employee`: Self-service portal (`myDashPage`) — view holidays, submit leaves, check profile.
- **Brands**:
  - `American Hairline (AHL)`
  - `Alchemane (ALC)`
  - Instant brand toggle in the top bar (`switchBrand`).

---

## 3. Database Schema: All 12 Sheets / Tabs in `1LVl3...`

| Sheet / Tab Name | Purpose | Key Columns |
|---|---|---|
| `Candidate Applications` | Raw candidate application submissions | Timestamp, Full Name, WhatsApp, Email, Gender, City, Position, Experience, Skills, Resume Link, Status, Follow Up Date, Brand, ID |
| `Candidate FMS` | Stage-by-stage tracking of candidate hiring | FMS ID, Candidate ID, Full Name, Phone, Current Stage, Status, Interview Status, Stage Data (JSON), Planned/Actual/Status/Delay per stage (AR, PS, CC, JO, DOC, OB), DOB, PAN, Aadhaar, Bank Details |
| `Employees` | Master employee records | Full Name, Employee ID, Company, Designation, Department, DOJ, DOB, Mobile, Bank, Salary, Assets, Digital Signature, PDF Link, Status, Brand |
| `Requisitions` | Open job vacancies and headcount budgets | ID, Job Title, Department, Hiring Manager, Job Level, Status, Min/Max Exp, Budget, Required Skills, Priority, Target Start |
| `Interview` | Interview evaluations and scores | ID, Name, Email, WhatsApp, Questions, Scores, Total Score, Tab Switches, Status, Position, Time Limit |
| `OnboardingProgress` | Onboarding task tracking | EmpId, PayloadJSON, UpdatedAt |
| `LifecycleEvents` | Career progression milestones | EmpId, PayloadJSON, UpdatedAt |
| `Feedback` | Performance feedback & 1-on-1s | ID, Employee ID, Feedback Type, Rating, Feedback, Problems, Date, Author |
| `ProblemTracker` | FMS issue & grievance resolution | ID, Date Logged, Problem Description, Raised By, Department, Priority, Owner, Deadline, Status, Planned/Actual/Status/Delay per stage (P1-P4) |
| `Users` | Authentication & credentials | Email, Password, Name, Role, Brand, Employee ID, Mobile Number |
| `Leaves` | Leave requests & approvals | ID, Employee ID, Brand, Leave Type, Days, From/To Date, Reason, Status, Approved By |
| `Holidays` | Company holiday calendar | ID, Name, Date, Type, Applies To, Created Date |
| `Trainings` | Skill development programs | ID, Brand, Title, Department, Trainer, Planned Start, Duration, Current Stage, Status, Stage Data (JSON) |

---

## 4. Gap Analysis: Current Next.js App vs This FMS Codebase

| Feature Area | Current Next.js App (`Next UI`) | HR System FMS (`HR system FMS`) | Integration Recommendation |
|---|---|---|---|
| **Candidate Sourcing & Screening** | HireOS AI tests & DISC | Standard forms + 6-stage Candidate FMS pipeline | **Port Candidate FMS pipeline into Next.js** under `/recruitment` |
| **Stage Delays & SLAs** | Not tracked | Planned vs Actual dates, automatic delay calculation | **Add FMS stage engine into Next.js** |
| **Problem / Grievance Tracker** | None | 4-stage FMS Problem Tracker (Table + Kanban) | **Add new `/problems` route in Next.js** |
| **Job Requisitions** | Not present | Requisitions sheet + hiring priority tracker | **Add new `/requisitions` tab in Next.js** |
| **Training Programs** | Not present | 5-stage Training FMS + Kanban | **Add new `/training` route in Next.js** |
| **Leave Management** | Not present | Leave requests, balances, manager approvals | **Add new `/leaves` route in Next.js** |
| **Holiday Calendar** | Not present | Company holiday calendar | **Integrate holidays into existing `/calendar`** |
| **Candidate -> Employee Handoff** | Manual Add Employee | Automatic: finishes onboarding ➔ creates employee | **Implement 1-click candidate promotion in Next.js** |
| **Multi-Brand Switcher** | Filter by Company | Brand switcher (`ahl` vs `alchamae`) | **Add persistent brand toggle in Next.js header** |
| **Role-based Auth** | Public (no login) | Roles: Admin, HR, Manager, Employee | **Implement NextAuth / JWT login using `Users` tab** |

---

## 5. Architectural Integration Blueprint for Next.js

```
┌────────────────────────────────────────────────────────────────────────┐
│               AHL HR COMMAND CENTER (NEXT.JS 16 APP ROUTER)            │
├────────────────────────────────────────────────────────────────────────┤
│  Existing Modules:                       New FMS Modules to Add:       │
│  • /                 (Overview & KPIs)   • /fms/candidates (Cand FMS)  │
│  • /directory        (Directory & Drawers)• /requisitions   (Job Openings)│
│  • /calendar         (Calendar + Reminders)• /problems      (Problem FMS) │
│  • /records          (Meetings & Alerts) • /training       (Training FMS)│
│  • /insights         (Charts & Readiness)• /leaves         (Leave Tracker)│
│  • /recruitment      (HireOS AI & DISC)  • /exit           (Exit Workflow)│
├────────────────────────────────────────────────────────────────────────┤
│                     SERVER API LAYER (`src/app/api/`)                   │
│  • /api/fms/candidates  • /api/requisitions  • /api/problems            │
│  • /api/training        • /api/leaves        • /api/holidays           │
├────────────────────────────────────────────────────────────────────────┤
│                     DATABASE ADAPTER LAYER (`src/lib/`)                │
│  • google-sheets.ts (reads/writes FMS sheets with batchGet/appendBelow)│
│  • fms-engine.ts (pure SLA & delay calculation, stage advancement)    │
│  • waha.ts (sends WhatsApp alerts on stage completion)                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Phase-by-Phase Implementation Plan

### Phase 1: Database Adapter & Schema Setup
1. Share the FMS Spreadsheet (`1LVl3-5f8vLGt7YRTbmquUR09UFJgb9J0lTn7XSGc7OM`) with the Google Service Account (`ahl-sheets-bot@ahl-sheets-automation.iam.gserviceaccount.com`).
2. Add `HR_FMS_SPREADSHEET_ID` into `.env.local` and Vercel.
3. Create server-side typed schema and helpers in `src/lib/fms-sheets.ts`.

### Phase 2: Candidate FMS & Requisitions Integration
1. Implement the 6 candidate stages (`ar`, `ps`, `cc`, `jo`, `doc`, `ob`) with SLA delay calculations in `src/lib/fms-engine.ts`.
2. Add API routes: `/api/fms/candidates` and `/api/requisitions`.
3. Add interactive Kanban and Table views under `/recruitment/pipeline` and `/recruitment/requisitions`.
4. Connect candidate onboarding completion directly to the Add Employee wizard / auto-promotion.

### Phase 3: Problem Tracker FMS & Training Management
1. Add Problem Tracker (`/problems`) with Table and Kanban views, supporting the 4 stages (Report Logged, Issue Analysis, Resolution, Closure).
2. Add Training Management (`/training`) supporting the 5 training stages.
3. Wire up WAHA WhatsApp notifications on assignment and priority alerts.

### Phase 4: Leaves, Holidays & Exit Workflows
1. Integrate company holidays directly into the existing `/calendar` page.
2. Add Leave Management (`/leaves`) for leave requests and approvals.
3. Add Exit Management (`/records/exit`) with exit interview forms and clearance checklists.

### Phase 5: Role-Based Authentication & Brand Switcher
1. Integrate authentication using the `Users` sheet tab (Admin, HR, Manager, Employee).
2. Add a persistent Brand Switcher in the top bar to filter all dashboards by `American Hairline`, `Alchemane`, or `All`.
