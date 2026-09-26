# HR OS backend

The Next.js API reads and writes the isolated development spreadsheet:

- Database: `HR OS Database - Development`
- Spreadsheet ID: `14P-W64goP_ZXztpSXUYuHZZXAjY2sHMFk46kaBqq8EY`
- Tabs: `Employees`, `HR_Meetings`, `HR_Documents`, `HR_Status`, `HR_Audit_Log`, `Departments`, `App_Config`

Local development reads the gitignored `service account.json` file. In deployment, set these server-only variables:

```text
HR_DATABASE_SPREADSHEET_ID=14P-W64goP_ZXztpSXUYuHZZXAjY2sHMFk46kaBqq8EY
HR_DOCUMENTS_FOLDER_ID=1NroiWT_PDFuYDxMjcRflvVyV0Y1ILEoz
GOOGLE_SERVICE_ACCOUNT_JSON={complete service-account JSON on one line}
GOOGLE_DRIVE_ID={Shared Drive ID, when available}
```

Never use a `NEXT_PUBLIC_` prefix for credentials. The browser calls only `/api/*`; credentials remain server-side.

## Commands

```powershell
npm run build
npm run start
```

The database migration is idempotent:

```powershell
node .\scripts\setup-dev-database.mjs
```

Google Sheets CRUD is active. Drive upload code accepts PDF, DOC, DOCX, PNG, and JPG files up to 5 MB. The current storage folder is in My Drive; production uploads should use a real Shared Drive or owner OAuth because service accounts do not receive personal Drive storage quota.
