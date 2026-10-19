# AHL HR System FMS — Legacy Reference & Backup

> ⚠️ **NOTICE: THIS FOLDER IS FOR REFERENCE ONLY**  
> This directory is an **archival backup** of the legacy Google Apps Script FMS (Flow Management System).  
> **It is NOT deployed to production and does NOT affect the live Next.js application on Vercel.**

---

## 1. Purpose of this Folder
This code is stored in the repository strictly so teammates and developers can:
- **Reference existing business logic**: View how candidates, requisitions, problems, training, and leaves were structured.
- **Inspect stage flows & SLA rules**: Review the 6-stage candidate pipeline, stage checklists, and delay formulas.
- **Review historical schemas**: Check column headers and formulas from the legacy Google Sheet.

All active and ongoing feature implementations should be built natively inside the Next.js application under `src/`.

---

## 2. Source Information
- **Original Apps Script Project ID**: `1vEcnQOg5IqpZcnu4pZbsh0nJsVR1rKViF0EERcO3i_YHo9zLDVBB2sNG`
- **Original Google Sheet ID**: `1LVl3-5f8vLGt7YRTbmquUR09UFJgb9J0lTn7XSGc7OM`
- **Clasp Configuration**: `.clasp.json` (do not run `clasp push` from here).

---

## 3. Files in this Directory
- **`Code.js`**: Complete server-side Apps Script (2,742 lines) handling all sheet operations, stage transitions, and delay calculations.
- **`Index.html`**: Complete legacy client-side web app containing the UI modals, candidate tables, and forms.
- **`HR_SYSTEM_FMS_ANALYSIS.md`**: Complete architectural breakdown, stage SLAs, checklist items, and data dictionary.
- **`appsscript.json`**: Manifest configuration for Google Apps Script runtime.
