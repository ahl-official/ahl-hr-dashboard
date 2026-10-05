# AHL HR Dashboard: Google Apps Scripts (start here)

Last updated: 5 Oct 2026. If you are a new developer, read this page first. It lists every Apps Script that
matters, what it does, whether it is **active**, and where its keys live. **No passwords are written here.**

## The big picture

```
HR staff ──▶ HR Dashboard (Next.js, on Vercel)  ──▶  Main sheet "HR OS Database"  (Google Sheet)
                │   ▲                                   tabs: Employees, HR_Meetings, HR_Documents, HR_Status,
                │   │                                   HR_Audit_Log, Departments, HR_Users, HR_Invites,
                │   │                                   Reminder_Settings, Reminder_Mentions,
                │   │                                   Reminder_Queue, Reminder_Log
                │   └── "AHL HR Dashboard Timer" (Apps Script) pings /api/reminders/tick every 5 minutes
                ├──▶ WhatsApp (WAHA server)  ── messages to HR, joiners and the salon group
                └──▶ "AHL HR Uploader" (Apps Script web app) ── saves PDFs/files into the Drive folder
```

- The dashboard code is in GitHub (`ahl-official/ahl-hr-dashboard`, folder `Next UI`). It talks to the sheet
  through a Google service account.
- A Google service account cannot store files in Drive, which is why the **Uploader** script exists: it runs as the
  HR Drive owner and saves the files.
- All the reminder logic (rules, messages, retries) is in the dashboard. The **Timer** script is only a clock.

## The scripts

### Active (part of the dashboard today)

| Script | What it does | Trigger / deployment | Key it needs |
|---|---|---|---|
| **AHL HR Dashboard Timer** | Calls the dashboard's `/api/reminders/tick` every 5 minutes. The dashboard then sends any due salon-meeting reminder to the WhatsApp group. | Time trigger `tick`, every 5 minutes. Created by running `setup` once. | `CRON_SECRET` (same value as in Vercel) |
| **AHL HR Uploader** | Receives a file from the dashboard and saves it in Drive: `HR Dashboard / 03_Employee_Documents / <employee>`. | Web app (executes as the owner). Its address is the Vercel variable `DRIVE_UPLOADER_URL`. | `DRIVE_UPLOADER_SECRET` |

- Timer: https://script.google.com/d/17Cu-4pFuWhck2pfwp9idBAO4cmLnXHsR9R7kWuZJlZaO-fAwgsRx8yDX/edit
- Uploader: https://script.google.com/d/1bKH0dmY0CLkerMRKLVuzgB70zKsH6d2hprOIXIy00k7VYMAH48x7AVjT/edit
- Source code (without the keys): GitHub `Next UI/apps-script/hr-timer` and `Next UI/apps-script/hr-uploader`.
  Copies are also in this Drive folder.

### Switched OFF (kept as a backup)

| Script | Status |
|---|---|
| **AHL Salon Monthly Meeting Reminder Automation** (the original reminder script, bound to its own sheet) | **Disabled on 5 Oct 2026.** The dashboard sends these reminders now; leaving this on would send every message twice. A kill switch (`OLD_SYSTEM_DISABLED = true`) is at the top of the code. The untouched original is **Version 1** of the project ("ORIGINAL before disabling (backup)"). |

- Script: https://script.google.com/d/1-_-VUuYt2ZaSiWjGri4zSaxTL_PKihMbj2_l1slXSvCIxxmfPVvyDTLw/edit
- Its sheet: https://docs.google.com/spreadsheets/d/1fVVA1CFUBlhfJFICd9lLpDAjNUcAcV2gnk8wMKrjupg/edit

### Legacy (replaced by the dashboard, still exist)

| Script | Notes |
|---|---|
| **Employee Master Database** (old public employee form) | Replaced by the dashboard's Add Employee flow. Three copies of the same code exist. It is still a **public** web app that writes into the OLD master sheet. Do not extend it. |
| **HR Dashboard v1** (the first dashboard, in Apps Script) | Replaced by the Next.js dashboard. |

- Old form (copy 1): https://script.google.com/d/1RgtpQOHEU97BNb1rgNToyj22Gvib0b2arku2kedzOK5ejcOk4HQqg-FC/edit
- Old form (copy 2): https://script.google.com/d/1wLQ9CaPmr4LXjCfJvY_oj6pososPThGQQAfGR_ZaEKKElfSJFHfXwj6E/edit
- Old form (copy 3): https://script.google.com/d/11pWr3fYVVO064hfMBD-9ORIrHyXeTAT2TGGshRoy0PpxFvn8n1eBvAhJ/edit
- HR Dashboard v1: https://script.google.com/d/17bYS7xucfqmM4-CDXkGEOJMWvpbOBT9M_1pO6ZacCqZdqp9vM48GI2Mg/edit

### Other scripts in the same Google account (not part of this project)
Gallabox WhatsApp, WAHA Export Code, WAHA Test Code, OTP Meta code, Sales Trainer AHL, VSL Autofill Code,
Employee Knowledge OS, Untitled project. They were not reviewed here.

## Where things are changed

| I want to change... | Do this |
|---|---|
| Who gets the HR daily WhatsApp | Sheet tab `HR_Users` (name, WhatsApp number, Active Yes/No) |
| Salon meeting time, reminder times, group, test number, `MODE` (TEST/PROD) | Sheet tab `Reminder_Settings` |
| Who is tagged in the group reminder | Sheet tab `Reminder_Mentions` (Active Yes/No) |
| What a reminder says | `src/lib/meeting-reminders.ts` (`buildMessage`) in the dashboard code |
| Department list / ID codes | Sheet tab `Departments`, and `src/lib/employee-id.ts` |

## Keys (names only; the values are never in GitHub)
`GOOGLE_SERVICE_ACCOUNT_JSON`, `HR_DATABASE_SPREADSHEET_ID`, `WAHA_BASE_URL`, `WAHA_SESSION`, `WAHA_API_KEY`,
`CRON_SECRET`, `DRIVE_UPLOADER_URL`, `DRIVE_UPLOADER_SECRET` live in **Vercel → Settings → Environment Variables**
(and locally in `Next UI/.env.local`). `CRON_SECRET` and `DRIVE_UPLOADER_SECRET` are also inside the Timer and
Uploader scripts. If you change one, change it in both places.

## How to update a script
The source in GitHub has `__SECRET__` instead of the real key. **Do not `clasp push` it as it is**: that would
overwrite the working key in Google. Copy the folder, replace `__SECRET__` with the real value, push from the copy.
(Or edit directly in the Apps Script editor.)

## If something goes wrong
- **Group reminder did not arrive:** open the dashboard calendar. The line under the title shows whether the timer
  checked recently, and the meeting's popup shows each reminder as Sent / Pending / Failed / Missed. Details are in
  the sheet tab `Reminder_Log`.
- **Timer stopped:** open the Timer script, choose `setup`, click Run (it re-creates the 5-minute trigger).
- **Go back to the old reminder system (emergency):** in the old script set `OLD_SYSTEM_DISABLED = false`, and in
  `Reminder_Settings` set `MODE` to `TEST` so the dashboard stops sending to the group. Never run both in `PROD`.

## Planned
Move the Timer and Uploader into one script attached to the main sheet (Extensions → Apps Script), so everything is
in one place. That changes the Uploader's web address and re-creates the timer, so it is done calmly, not during a
live reminder window.
