# Installers Directory

Place your offline installers here. These will be bundled into the final Chapter One `.exe` installer.

For the Setup Wizard to be able to install PostgreSQL silently, you must download the PostgreSQL EnterpriseDB Windows Installer and place it in this folder.

**Required File:**
- `postgresql-installer.exe` (must be named exactly this)

You can download it from:
https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
(Download the Windows x86-64 interactive installer, e.g., version 15 or 16)

After downloading, rename it to `postgresql-installer.exe` and place it in this `installers` folder before running `npm run build:win`.
