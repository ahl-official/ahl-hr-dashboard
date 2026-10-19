# AHL HR Command Center

The core internal HR web platform for **American Hairline (AHL)** and **Alchemane (ALC)**. Built with Next.js App Router, React 19, Google Sheets database integration, and automated WhatsApp communication (WAHA).

---

## Key Modules

- **Employee Master Directory**: Full team directory, search, advanced filters, details drawer, and active status tracking.
- **5-Step Onboarding Wizard**: Automated employee onboarding with token-based self-service portal, photo upload, and PDF employment contract generator.
- **Calendar & Salon Meeting Engine**: Automated First-Wednesday salon meeting reminders (R3-R0 sequence) with 5-minute tick loop and morning HR digests.
- **Recruitment & HireOS**: AI-powered candidate screening tests, AssemblyAI voice response evaluation, and DISC psychometric assessment dispatcher.
- **FMS (Flow Management System)**: Candidate recruitment pipeline with SLA delay tracking ($\text{Delay} = \text{Actual Date} - \text{Planned Date}$), stage checklists, job requisitions, and problem tracker.

---

## Project Structure

```
Next UI/
├── src/
│   ├── app/                # Next.js App Router routes and API endpoints
│   ├── components/         # Reusable React UI components
│   ├── lib/                # Core business logic, Google Sheets adapters, and rules
│   └── types/              # Domain TypeScript interfaces
├── docs/                   # Developer guides, system handover, and architecture specs
│   ├── HANDOVER.md         # Developer handover and environment variable directory
│   ├── APPS_SCRIPTS.md     # Google Apps Script ecosystem documentation
│   └── FMS_INTEGRATION_MASTER_PLAN.md  # FMS migration roadmap
├── apps-script/            # Supporting Google Apps Scripts
│   ├── hr-timer/           # Active 5-minute cron timer script
│   ├── hr-uploader/        # Drive document uploader web app
│   └── hr-system-fms/      # ⚠️ REFERENCE & BACKUP ONLY: Legacy FMS Apps Script archive
└── tests/                  # Node.js native test suite
```

> ⚠️ **Note on `apps-script/hr-system-fms/`**:  
> This directory is stored strictly as a **reference and backup archive** of the legacy Apps Script system so team members can inspect old stage flows, checklists, and formulas. It is not deployed to production and does not affect the live Next.js application on Vercel.

---

## Local Development & Testing

```bash
# Install dependencies
npm install

# Run type check (must pass with 0 errors)
npx tsc --noEmit

# Run unit test suite (all 63+ tests must pass)
npm test

# Build production bundle
npm run build

# Start local development server
npm run dev
```

---

## Documentation

For full system onboarding and key architectures, please read:
- [`docs/HANDOVER.md`](docs/HANDOVER.md) — System handover, service accounts, and environment variables.
- [`docs/APPS_SCRIPTS.md`](docs/APPS_SCRIPTS.md) — Complete overview of Apps Scripts and their status.
- [`docs/FMS_INTEGRATION_MASTER_PLAN.md`](docs/FMS_INTEGRATION_MASTER_PLAN.md) — Comprehensive plan for native FMS capabilities.
