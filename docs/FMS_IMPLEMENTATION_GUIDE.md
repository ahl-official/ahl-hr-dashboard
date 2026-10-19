# FMS Feature Implementation Guide for Developers & Teammates

> ⚠️ **NOTICE FOR DEVELOPERS**:  
> This document is a **step-by-step implementation guide** for engineers building the native FMS (Flow Management System) features into the Next.js AHL HR Command Center.  
> **Once all phases in this guide are implemented, tested, and deployed to production, this file can safely be deleted (`git rm docs/FMS_IMPLEMENTATION_GUIDE.md`).**

---

## 1. Context & Background

### What is FMS?
In AHL operations, **FMS (Flow / Follow-up Management System)** is a structured operational pipeline where every stage must track:
1. **Planned Date**: Target SLA completion date.
2. **Actual Date**: When the step was completed.
3. **Delay (Days)**: $\text{Delay} = \text{Actual Date} - \text{Planned Date}$ (highlighted in red if delayed).
4. **Stage Checklists**: Operational gates that must be ticked off before moving to the next stage.
5. **Stage Status**: `Pending`, `In Progress`, `Completed`, `Overdue`, `Dropped`.

### Why We Are Doing This
The existing Next.js dashboard (`Next UI`) already handles:
- Employee master directory & records
- 5-step onboarding wizard & PDF contract generation
- Automated WhatsApp salon meeting reminders (first Wednesday 10 AM IST)
- HireOS AI tests, audio reviews & DISC psychometrics

**The only remaining missing module from the old system is the Candidate FMS pipeline** (tracking candidates from arrival, screening calls, interviews, offer, documentation, to joining).

### Standalone Local Architecture (Zero External Connection Needed)
To ensure the app is fast, offline-capable, and simple to develop, we **do not depend on external Google Sheets connections** during development.
- Pre-extracted live seed data snapshot: [`src/lib/fms-extracted-data.json`](../src/lib/fms-extracted-data.json) (41 candidates, 18 requisitions, 5 problems, trainings, leaves, holidays).
- Business rules engine: [`src/lib/fms-rules.ts`](../src/lib/fms-rules.ts).
- TypeScript models: [`src/types/fms.ts`](../src/types/fms.ts).
- Reference code from the old system: [`apps-script/hr-system-fms/`](../apps-script/hr-system-fms/) (`Code.js`, `Index.html`).

---

## 2. Architecture Map

```
┌────────────────────────────────────────────────────────┐
│                   Next UI (Frontend)                   │
├────────────────────────────────────────────────────────┤
│  /recruitment -> Tab "Candidate FMS"                   │
│  - Pipeline Kanban & Table View                        │
│  - SLA Delay Badges (Red / Amber / Green)              │
│  - Stage Checklists & Action Drawer                    │
│  - Requisitions Manager                                │
│  - 1-Click "Promote to Onboarding"                     │
├────────────────────────────────────────────────────────┤
│  /problems -> Problem Tracker FMS                      │
│  /training -> Staff Training FMS                       │
└────────────────────────────────────────────────────────┘
                           ▲
                           │ API Requests
                           ▼
┌────────────────────────────────────────────────────────┐
│               Internal Next.js API Routes              │
│  /api/fms/candidates, /requisitions, /problems, etc.   │
├────────────────────────────────────────────────────────┤
│  Data Layer: src/lib/fms-store.ts (Local JSON Store)   │
│  Seed: src/lib/fms-extracted-data.json                 │
│  Rules: src/lib/fms-rules.ts (Delay math & checklists) │
└────────────────────────────────────────────────────────┘
```

---

## 3. Step-by-Step Implementation Roadmap

### Phase 1: Local Data Store (`src/lib/fms-store.ts`)
Create a self-contained local store that loads seed data and handles in-memory / file updates:
```typescript
// src/lib/fms-store.ts
import seedData from "./fms-extracted-data.json";
import type { FmsCandidate, FmsRequisition, FmsProblem, FmsTraining, FmsLeave } from "@/types/fms";

// In-memory state initialized from seed data
let candidates: FmsCandidate[] = [...(seedData.candidates as any)];
let requisitions: FmsRequisition[] = [...(seedData.requisitions as any)];
let problems: FmsProblem[] = [...(seedData.problems as any)];

export function getCandidatesStore(): FmsCandidate[] {
  return candidates;
}

export function updateCandidateStage(
  id: string,
  stageId: string,
  updates: Partial<FmsCandidate>
): FmsCandidate | null {
  const idx = candidates.findIndex((c) => String(c.id) === String(id));
  if (idx === -1) return null;
  candidates[idx] = { ...candidates[idx], ...updates, updatedAt: new Date().toISOString() };
  return candidates[idx];
}

export function getRequisitionsStore(): FmsRequisition[] {
  return requisitions;
}

export function addRequisitionStore(req: Omit<FmsRequisition, "id">): FmsRequisition {
  const newId = `REQ-${new Date().getFullYear()}-${String(requisitions.length + 1).padStart(3, "0")}`;
  const record: FmsRequisition = { ...req, id: newId };
  requisitions.unshift(record);
  return record;
}
```

---

### Phase 2: Internal Next.js API Endpoints
Create standard App Router route handlers in `src/app/api/fms/`:

1. **`src/app/api/fms/candidates/route.ts`**:
   - `GET`: Returns `{ success: true, candidates, summary }`.
   - `POST`: Create a new candidate or update candidate stage, planned date, actual date, and checklist state.
2. **`src/app/api/fms/requisitions/route.ts`**:
   - `GET`: Returns list of open and filled requisitions.
   - `POST`: Creates a new job requisition.
3. **`src/app/api/fms/problems/route.ts`**:
   - `GET`: Returns list of HR/salon problems with their 4 stages.
   - `POST`: Log new problem or advance issue stage.

---

### Phase 3: Candidate FMS Pipeline UI (`/recruitment`)
Add a new tab inside [`src/app/(app)/recruitment/page.tsx`](../src/app/(app)/recruitment/page.tsx):
- Update `activeTab` to include `"fms"`:
  ```typescript
  const [activeTab, setActiveTab] = useState<"fms" | "generate" | "icp" | "results" | "employee_disc" | "audio">("fms");
  ```
- Build component `src/components/recruitment/CandidateFmsTab.tsx`:
  - **Stage Headers**:
    - Application Received (ar)
    - Pre-Screening (ps)
    - Confirmation Call (cc)
    - Joining / Offer (jo)
    - Documentation (doc)
    - Onboarding (ob)
  - **Candidate Card**:
    - Name, Role, Brand (`AHL` / `ALC`), Phone, Experience.
    - **SLA Delay Badge**: Uses `calculateFmsDelay(plannedDate, actualDate)` from `fms-rules.ts`. If delay > 0, show `+N days delay` in red.
    - **Checklist Progress**: e.g., `3/5 done`.
    - **Actions**:
      - 📞 Call / 💬 WhatsApp icon (`wa.me/91...`).
      - ⏩ **Advance Stage Modal**: Tick off stage checklist items, enter notes, pick actual date.
      - 🎓 **Promote to Onboarding**: Pre-fills the `/add-employee` wizard with candidate name, phone, email, and department!

---

### Phase 4: Job Requisitions UI
Build `src/components/recruitment/RequisitionsTab.tsx` or a sub-panel in Recruitment:
- Requisition cards with status badges (`Open`, `Filled`, `Cancelled`).
- Department, Hiring Manager, Budget, and Openings target.
- "New Requisition" modal dialog.

---

### Phase 5: Problem Tracker & Training Pages
1. **`src/app/(app)/problems/page.tsx`**:
   - 4 Kanban columns: `Report Logged` ➜ `Issue Analysis` ➜ `Resolution Action` ➜ `Closed`.
   - Severity tags (`High`, `Medium`, `Low`) and Root Cause field.
2. **`src/app/(app)/training/page.tsx`**:
   - 5 stages: `Planning` ➜ `Scheduling` ➜ `In Progress` ➜ `Evaluation` ➜ `Completed`.
   - Attendance roster and trainer feedback scores.

---

## 4. Verification & Testing Commands

Before submitting a pull request or pushing to GitHub, you **MUST** run all verification commands:

```powershell
# 1. Type Check (Must be 0 errors)
npx tsc --noEmit

# 2. Run Unit Test Suite (All 63+ tests must pass)
npm test

# 3. Production Build Validation
npm run build
```

---

## 5. Security & Hygiene Rules
1. **Never commit `.env` or `.env.local`**.
2. **Never commit `service account.json`** (already in `.gitignore`).
3. Keep code modular: put business logic and delay math in `src/lib/`, domain types in `src/types/fms.ts`, and UI in `src/components/`.

---

## 6. Cleanup After Implementation
Once the features are fully implemented, verified, and merged to `main`:
```bash
git rm docs/FMS_IMPLEMENTATION_GUIDE.md
git commit -m "chore: remove temporary fms implementation guide after release"
git push origin main
```
