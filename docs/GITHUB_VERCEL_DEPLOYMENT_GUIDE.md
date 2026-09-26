# GitHub & Vercel Deployment Guide

Complete step-by-step instructions for publishing the **AHL HR Command Center** to GitHub and deploying to Vercel with Google Sheets & Drive backend connectivity.

---

## Quick Architecture Overview

* **Frontend**: Next.js 14 / 16 (App Router, Tailwind CSS, Lucide icons, Chart.js, Full PWA)
* **Backend**: Server-side Next.js API Routes (`/api/dashboard`, `/api/employees`, `/api/meetings`, etc.)
* **Database**: Google Sheets (`HR OS Database - Development`)
* **File Storage**: Google Drive (`HR_Documents` folder)
* **Auth**: Google Service Account (server-side only via environment variables)

> [!IMPORTANT]
> Never commit `service account.json` or `.env.local` to GitHub. The `.gitignore` file is already configured to protect them.

---

## Part 1: Initialize Git and Push to GitHub

### Step 1: Open PowerShell in the `Next UI` directory
```powershell
cd "C:\Users\admin\Desktop\HR_Dashboard\Next UI"
```

### Step 2: Initialize Git Repository
```powershell
git init -b main
```

### Step 3: Verify `.gitignore`
Make sure sensitive credentials are not tracked by checking git status:
```powershell
git status
```
*(Verify that `service account.json` and `.env.local` do NOT appear in the untracked files list).*

### Step 4: Stage and Commit the Codebase
```powershell
git add .
git commit -m "feat: complete AHL HR Command Center with PWA and HR Calendar"
```

### Step 5: Create a New Repository on GitHub
1. Go to [GitHub.com](https://github.com) and log in.
2. Click the **`+`** icon in the top right corner → **New repository**.
3. Name your repository (e.g., `ahl-hr-command-center`).
4. Keep it **Private** (recommended for internal enterprise HR software).
5. **Do not** check "Add a README file", ".gitignore", or "license" (we already have them).
6. Click **Create repository**.

### Step 6: Link and Push to GitHub
Copy the commands shown on GitHub (replace `<YOUR-USERNAME>` and `<YOUR-REPO>` with your actual repository URL):
```powershell
git remote add origin https://github.com/<YOUR-USERNAME>/ahl-hr-command-center.git
git push -u origin main
```

---

## Part 2: Prepare Your Service Account for Vercel

On Vercel, files like `service account.json` cannot be read from the disk. Instead, the backend reads the credentials from an environment variable: `GOOGLE_SERVICE_ACCOUNT_JSON`.

To format `service account.json` into a single-line string for Vercel, run this command in PowerShell:

```powershell
Get-Content -Raw "service account.json" | ConvertFrom-Json | ConvertTo-Json -Compress | Set-Clipboard
```
*(This command compresses your `service account.json` onto one line and copies it directly to your clipboard!)*

---

## Part 3: Deploy to Vercel

### Step 1: Import Project in Vercel
1. Go to [Vercel.com](https://vercel.com) and sign in (using GitHub).
2. Click **Add New…** → **Project**.
3. Locate your newly pushed repository `ahl-hr-command-center` and click **Import**.

### Step 2: Configure Project Settings
* **Project Name**: `ahl-hr-command-center` (or your choice)
* **Framework Preset**: `Next.js` (automatically detected)
* **Root Directory**: `./` (default)
* **Build Command**: `next build` (default)
* **Output Directory**: `.next` (default)

### Step 3: Configure Environment Variables
Expand the **Environment Variables** section and add the following 3 variables:

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `HR_DATABASE_SPREADSHEET_ID` | `14P-W64goP_ZXztpSXUYuHZZXAjY2sHMFk46kaBqq8EY` | Google Sheets development database ID |
| `HR_DOCUMENTS_FOLDER_ID` | `1NroiWT_PDFuYDxMjcRflvVyV0Y1ILEoz` | Google Drive folder for document uploads |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | *(Paste from clipboard)* | The one-line compressed service account JSON |

*(Optional: If you use a Google Shared Drive in production, set `GOOGLE_DRIVE_ID` as well; otherwise, leave it unset).*

### Step 4: Click Deploy
Click the **Deploy** button. Vercel will build the Next.js app, compile all server routes, and generate your live production URL (e.g., `https://ahl-hr-command-center.vercel.app`).

---

## Part 4: Post-Deployment Verification Checklist

Once the deployment completes, verify the following live:

1. **Dashboard Overview**: Visit your live URL and verify the 6 KPI cards, 88 employees count, and latest sync status.
2. **HR Calendar**: Navigate to **HR Calendar** to verify month grid and live reviews/meetings.
3. **API Health**: Navigate to `https://<YOUR-VERCEL-DOMAIN>/api/health` and verify:
   ```json
   {
     "status": "healthy",
     "services": {
       "backend": "connected",
       "pwa": "enabled"
     }
   }
   ```
4. **PWA Installation**: Open the site on Chrome (Android/Desktop) or Safari (iOS "Add to Home Screen") and verify PWA installation.
5. **Security Check**: Open browser dev tools and confirm that `GOOGLE_SERVICE_ACCOUNT_JSON` is never sent to the client.

---

## Future Updates (CI/CD)
Whenever you make updates to the code, simply push to GitHub:
```powershell
git add .
git commit -m "update: improvements"
git push
```
Vercel will automatically build and deploy the changes within seconds!
