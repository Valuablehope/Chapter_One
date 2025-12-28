# Troubleshooting Guide

## Database Connection Issues

### Error: "SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string"

This error occurs when the database password is not properly set in the `.env` file.

**Solution:**

1. Make sure you have a `.env` file in the root directory:
   ```bash
   cp env.example .env
   ```

2. Edit the `.env` file and set your database password:
   ```env
   DB_PASSWORD=your_actual_password_here
   ```
   
   **Important:** 
   - The password must be a string (even if it's empty, use quotes: `DB_PASSWORD=""`)
   - No spaces around the `=` sign
   - If your password contains special characters, you may need to quote it

3. Verify your database credentials:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=Chapter_One
   DB_USER=postgres
   DB_PASSWORD=your_password
   ```

4. Test the connection:
   ```bash
   psql -U postgres -d Chapter_One -h localhost
   ```

### Error: "Database connection warning"

If you see a database connection warning but the app continues:
- The app will work, but database features won't function
- Check your `.env` file configuration
- Ensure PostgreSQL is running
- Verify the database exists

## HEAD / 404 Requests

If you see many `HEAD / 404` requests in the logs:
- This is normal - it's `wait-on` checking if servers are ready
- The root endpoint now handles these requests
- These will stop once Electron launches

## Common Issues

### Port Already in Use

**Error:** `EADDRINUSE: address already in use`

**Solution:**
- Backend (3001): Change `API_PORT` in `.env`
- Frontend (5173): Change port in `frontend/vite.config.ts`

### Module Not Found

**Error:** `Cannot find module 'xxx'`

**Solution:**
```bash
# Install all dependencies
npm run install:all

# Or install in specific directory
cd backend && npm install
cd ../frontend && npm install
cd ../electron && npm install
```

### Electron Not Opening

**Solution:**
1. Check that both backend and frontend are running
2. Verify ports 3001 and 5173 are accessible
3. Check Electron console for errors
4. Try running Electron separately:
   ```bash
   cd electron
   npm run dev
   ```

## Environment Variables

Make sure your `.env` file contains:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=Chapter_One
DB_USER=postgres
DB_PASSWORD=your_password_here

# Backend
API_PORT=3001
NODE_ENV=development

# JWT
JWT_SECRET=your_very_secure_secret_key_here
JWT_EXPIRES_IN=24h

# Electron
ELECTRON_IS_DEV=true
```

## Testing Database Connection

Test your database connection manually:

```bash
# Using psql
psql -U postgres -d Chapter_One -h localhost

# Or test connection string
psql "postgresql://postgres:your_password@localhost:5432/Chapter_One"
```

## Getting Help

If issues persist:
1. Check all logs (backend, frontend, electron)
2. Verify `.env` file is in root directory
3. Ensure PostgreSQL is running
4. Check database exists: `psql -U postgres -l | grep Chapter_One`











