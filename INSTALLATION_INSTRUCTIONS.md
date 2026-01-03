# Chapter One POS - Installation Instructions

## Prerequisites

1. **PostgreSQL** must be installed and running on the client's PC
2. Database **"Chapter_One"** must be created in PostgreSQL
3. Windows 10 or later (64-bit)

## Installation Steps

1. Run the installer: `Chapter One POS Setup 4.0.0.exe`
2. Follow the installation wizard
3. After installation, navigate to the installation directory (usually `C:\Program Files\Chapter One POS\`)

## Configuration

1. In the installation directory, you'll find a file named `.env.example`
2. Copy `.env.example` and rename it to `.env`
3. Open `.env` with a text editor (Notepad, Notepad++, etc.)
4. Edit the database credentials to match your PostgreSQL setup:

   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=Chapter_One
   DB_USER=postgres
   DB_PASSWORD=your_actual_password_here
   ```

   Or use a connection string:

   ```
   DATABASE_URL=postgres://postgres:your_password@localhost:5432/Chapter_One
   ```

5. Save the `.env` file
6. Launch "Chapter One POS" from the Start Menu or Desktop shortcut

## First Launch

- The application will automatically start the backend server
- If you see connection errors, verify:
  - PostgreSQL is running
  - Database credentials in `.env` are correct
  - Database "Chapter_One" exists

## Troubleshooting

### Backend Server Won't Start
- Check that `.env` file exists in the installation directory
- Verify PostgreSQL is running: Open Services and check "postgresql-x64-XX" service
- Check database credentials in `.env` file

### Database Connection Errors
- Verify PostgreSQL is running
- Check database name matches exactly: `Chapter_One`
- Verify username and password are correct
- Ensure database exists: `psql -U postgres -l` (in Command Prompt)

### Application Won't Launch
- Check Windows Event Viewer for errors
- Ensure you have administrator rights if needed
- Try running from the installation directory directly

## Support

For technical support, contact your system administrator or Chapter One support team.


