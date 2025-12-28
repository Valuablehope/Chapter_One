# Setup Instructions

## Prerequisites

1. **Node.js v22.15.0** - Download from [nodejs.org](https://nodejs.org/)
2. **PostgreSQL 17.6+** - Download from [postgresql.org](https://www.postgresql.org/download/)
3. **npm** (comes with Node.js)

## Installation Steps

### 1. Install Dependencies

From the root directory, run:

```bash
npm install
```

This will install dependencies for:
- Root workspace
- Frontend (React + Vite)
- Backend (Express + Node.js)
- Electron

### 2. Database Setup

1. Make sure PostgreSQL is running
2. Create the database (or restore from backup):
   ```bash
   psql -U postgres -c "CREATE DATABASE \"Chapter_One\";"
   ```

3. If you have a backup SQL file, restore it:
   ```bash
   psql -U postgres -d Chapter_One -f "path/to/Chapter_One_backup.sql"
   ```

### 3. Environment Configuration

1. Copy the environment example file:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` file with your database credentials:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=Chapter_One
   DB_USER=postgres
   DB_PASSWORD=your_actual_password
   ```

### 4. Start Development

Run the development server:

```bash
npm run dev
```

This will:
- Start the backend API server on `http://localhost:3001`
- Start the frontend Vite dev server on `http://localhost:5173`
- Launch the Electron application

### 5. Verify Installation

1. Check backend health: Open `http://localhost:3001/health` in browser
2. Check API: Open `http://localhost:3001/api` in browser
3. Electron app should open automatically

## Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running: `pg_isready`
- Check database credentials in `.env`
- Ensure database exists: `psql -U postgres -l | grep Chapter_One`

### Port Already in Use

- Backend (3001): Change `API_PORT` in `.env`
- Frontend (5173): Change port in `frontend/vite.config.ts`

### Electron Not Opening

- Check console for errors
- Verify both backend and frontend are running
- Try running Electron separately: `npm run start` (after build)

## Project Structure

```
Chapter_One_V4.0/
├── electron/          # Electron main process
├── frontend/          # React frontend (Vite)
├── backend/           # Express API server
├── shared/            # Shared TypeScript types
└── package.json       # Root workspace config
```

## Next Steps

After successful setup, proceed with:
- Phase 2: Authentication & Security
- Phase 3: Database Models & API Foundation
- Phase 4: Products Management Screen
- And so on...











