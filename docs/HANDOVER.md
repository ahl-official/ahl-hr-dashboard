# AHL HR Command Center: Developer Handover

Last updated: 13 Oct 2026. Read this first, then `docs/APPS_SCRIPTS.md`.
**This page has no passwords or keys.** It lists every key by name and says where the value lives.

## 1. What it is
Internal HR web app for American Hairline. HR staff add employees, track meetings/birthdays/documents, send
joiners an onboarding form, and the system sends WhatsApp reminders. A recruitment module (Hireos: AI interview,
DISC test) was added by a teammate on 9 Oct 2026.

## 2. Where everything is
| Thing | Where |
|---|---|
| Live site | https://ahl-hr-dashboard.vercel.app (public, no login yet) |
| Code | https://github.com/ahl-official/ahl-hr-dashboard , folder `Next UI`, branch `main` |
| Hosting | Vercel (Hobby plan). Every push to `main` deploys automatically |
| Main database | Google Sheet "HR OS Database", ID `14P-W64goP_ZXztpSXUYuHZZXAjY2sHMFk46kaBqq8EY` |
| Recruitment database | Google Sheet, ID in Vercel variable `HIREOS_SPREADSHEET_ID` |
| Documents folder (Drive) | "HR Dashboard" folder, ID `1NroiWT_PDFuYDxMjcRflvVyV0Y1ILEoz` (`HR_DOCUMENTS_FOLDER_ID`) |
| Apps Script overview | `docs/APPS_SCRIPTS.md` and Drive: HR Dashboard / 05_Apps_Script |
| WhatsApp server (WAHA) | https://waha.hairscalptradingco.com , session `ahlaiteam` |
| Local folders (HR PC) | `Desktop\HR_Dashboard\Next UI` (code), `backups` (data and old script backups), `logo` |

## 3. How it fits together
```
HR staff -> Next.js app (Vercel) -> Google Sheet (via service account)
                 |-> WhatsApp via WAHA
                 |-> Apps Script "Uploader" -> Drive (signed PDFs, employee files)
Apps Script "Timer" -> calls /api/reminders/tick every 5 minutes
Vercel Cron (03:30 UTC = 09:00 IST) -> /api/reminders/run  (HR morning message)
```
- A Google service account cannot create Drive files, so the Uploader script (runs as the HR Drive owner) does it.
- Reminder rules (first Wednesday 10:00 IST meeting; messages 3/2/1 days before at 11:00 and on the day at 09:00)
  live in `src/lib/meeting-reminders.ts` and are tested.

## 4. Sheet tabs (main database)
Employees, HR_Meetings, HR_Documents, HR_Status, HR_Audit_Log, Departments, HR_Users (who gets the morning
WhatsApp), HR_Invites (joiner links), Reminder_Settings (MODE: PROD or test), Reminder_Mentions, Reminder_Queue,
Reminder_Log. Never leave blank rows inside a tab; the code appends below the last filled row.

## 5. Keys and settings (names only)
Set in Vercel > Project > Settings > Environment Variables. Local copy: `Next UI/.env.local` (never commit).
| Name | What it is | Where the value is kept |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account `ahl-sheets-bot@ahl-sheets-automation.iam.gserviceaccount.com` (needs Editor on both sheets) | Vercel; local file `service account.json` (git-ignored) |
| `HR_DATABASE_SPREADSHEET_ID`, `HIREOS_SPREADSHEET_ID`, `HR_DOCUMENTS_FOLDER_ID` | IDs, not secrets | Vercel / this page |
| `WAHA_BASE_URL`, `WAHA_SESSION`, `WAHA_API_KEY` | WhatsApp server | Vercel; the API key is held by the WAHA admin |
| `DRIVE_UPLOADER_URL`, `DRIVE_UPLOADER_SECRET` | Uploader Apps Script address and key | Vercel + the script's own properties |
| `CRON_SECRET` | Protects the reminder endpoints; Timer script sends the same value | Vercel + Timer script |
| `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ASSEMBLYAI_API_KEY`, `GROQ_API_KEY` | AI services for recruitment | Vercel; owner = whoever made the accounts (ask the Hireos developer) |
Rules: never put values in GitHub, chat or docs. Repo copies of the Timer/Uploader scripts contain `__SECRET__`;
**never `clasp push` them as they are**, it would overwrite the working key in Google.

## 6. Google accounts and scripts
- Apps Script, Drive and the Uploader run as `ai@americanhairline.com`.
- Active scripts: Timer, Uploader. Switched off (backup): old salon reminder script (kill switch
  `OLD_SYSTEM_DISABLED = true`; leaving it on would double-send). Legacy: old public employee form, HR Dashboard v1.
  Links are in `docs/APPS_SCRIPTS.md`.

## 7. Run it on your PC
1. Install Node 24. Get `.env.local` and `service account.json` from the HR admin.
2. In `Next UI`: `npm install`, then `npm run dev` -> http://localhost:3000
3. Checks before every push: `npx tsc --noEmit`, `npm test`, `npm run build`.

## 8. Deploy
- Push to `main` -> Vercel builds and deploys (about 1 minute). No manual step.
- New env var? Add it in Vercel, then redeploy (Deployments > ... > Redeploy).
- `vercel.json` holds the daily cron. Hobby plan allows once-a-day crons, which is why the 5-minute clock is an Apps Script.
- More detail: `docs/GITHUB_VERCEL_DEPLOYMENT_GUIDE.md`.

## 9. Code map (`Next UI/src`)
- `app/(app)/`: pages (dashboard, directory, add-employee, calendar, records, insights, recruitment).
- `app/api/`: server routes (employees, invites, join, reminders, meeting-reminders, recruitment, psychometric).
- `app/join/[token]`, `app/test/[id]`, `app/psychometric/[id]`: public pages for joiners and candidates.
- `lib/`: logic. `employee-id.ts` (IDs like `AHL-HK-0044`), `meeting-reminders*.ts`, `waha.ts`, `google-sheets.ts`,
  `google-drive.ts`, `onboarding-pdf.ts`, `hireos-*.ts`.
- `tests/`: `npm test`. `scripts/`: one-off migrations (read before running).
- Other docs: `docs/HR_NEXTJS_HANDOFF.md` (original spec), `docs/BACKEND_SETUP.md`.

## 10. Known open items
- Site is public, no login. Plan: Google sign-in with company accounts, HR emails in `HR_Users`.
- Recruitment API routes have no protection and call paid AI services. Add a guard before wider use.
- Test data to delete: invite "Zz Test Joiner", employee "Me" (AHL-HK-0044), test files in Drive.
- Data fixes: Amit Bhalchandra Gade has no company; department typo "Male Techanican".
- Merge Timer + Uploader into one script; Vercel Pro is needed for commercial use.

## 11. If something breaks
- No WhatsApp: check WAHA is online (session `ahlaiteam` WORKING), then `Reminder_Log` tab for the error.
- Reminder missing: `Reminder_Queue` status (Pending/Sending/Sent/Failed/Missed/Skipped); Timer script trigger exists?
- PDF not saved: Uploader URL/secret in Vercel; Drive folder shared with `ai@americanhairline.com`.
- Sheet error: service account must still be Editor on the sheet.
