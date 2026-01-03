# Build Instructions for Windows

This guide explains how to build the Chapter One POS application for Windows distribution.

## Prerequisites

1. **Node.js v22.15.0** or later installed
2. **npm** (comes with Node.js)
3. All project dependencies installed
4. **PostgreSQL** (for testing, not required for build)

## Quick Build

For a clean production build, run:

```bash
npm run build:win
```

This will:
1. Clean all previous builds
2. Build frontend (React/Vite) with optimizations
3. Build backend (TypeScript)
4. Build Electron main process
5. Install backend production dependencies only
6. Prune unnecessary dependencies
7. Create Windows installer using electron-builder

## Step-by-Step Build Process

### 1. Clean Previous Builds (Optional)

```bash
npm run clean
```

### 2. Install All Dependencies (First Time Only)

```bash
npm run install:all
```

### 3. Build All Components

```bash
npm run build
```

This builds:
- Frontend: `frontend/dist/`
- Backend: `backend/dist/`
- Electron: `electron/dist/`

### 4. Prepare Backend for Production

```bash
npm run install:backend:prod
npm run prune:backend
```

### 5. Create Installer

```bash
npx electron-builder --win --publish never
```

Or use the combined command:

```bash
npm run build:win
```

## Build Output

After the build completes, you'll find:

```
dist-installer/
  └── Chapter One POS Setup 4.0.0.exe
```

## Build Configuration

The build is configured in `package.json` under the `"build"` section:

- **Output directory**: `dist-installer/`
- **Installer type**: NSIS (allows custom installation directory)
- **Architecture**: x64 (64-bit Windows)
- **Icon**: Uses `frontend/public/icon.ico`
- **Compression**: Maximum
- **Console logs**: Removed in production build

## What Gets Bundled

The installer includes:
- ✅ Electron runtime
- ✅ Frontend build (`frontend/dist/`) - optimized and minified
- ✅ Backend build (`backend/dist/`)
- ✅ Backend production dependencies only (`backend/node_modules/`)
- ✅ `.env.example` file (for client configuration)

**Excluded:**
- ❌ Source TypeScript files
- ❌ Development dependencies
- ❌ Test files
- ❌ Source maps (production only)
- ❌ Console.log statements (removed)

## Build Size Optimization

The build process:
- Removes all dev dependencies from backend
- Prunes unused packages
- Minifies frontend code
- Removes console.log statements
- Uses maximum compression

Expected installer size: ~150-250 MB (depending on dependencies)

## Client Installation

After building, provide clients with:
1. The installer: `Chapter One POS Setup 4.0.0.exe`
2. The installation instructions: `INSTALLATION_INSTRUCTIONS.md`

## Testing the Build

Before distributing:

1. **Test on clean machine:**
   - Install on a Windows PC without Node.js
   - Verify app launches
   - Check backend starts automatically
   - Test database connection

2. **Verify files:**
   - Check `.env.example` is in installation directory
   - Verify shortcuts are created
   - Test uninstaller

## Troubleshooting

### Build Fails with "electron-builder not found"
```bash
npm install --save-dev electron-builder
```

### Build is too large
- Check that `npm run prune:backend` ran successfully
- Verify dev dependencies are excluded
- Check for large files in `backend/node_modules`

### Backend won't start in production
- Verify `.env` file exists in installation directory
- Check that `backend/node_modules` is included in build
- Verify `NODE_PATH` is set correctly (handled automatically)
- Check Windows Event Viewer for errors

### Icon not showing
- Ensure `frontend/public/icon.ico` exists
- Icon should be at least 256x256 pixels
- Rebuild after adding/updating icon

### Frontend not loading
- Verify `frontend/dist/index.html` exists
- Check that Vite build completed successfully
- Ensure no build errors in console

## Next Steps

After building:
1. ✅ Test the installer on a clean Windows machine
2. ✅ Verify backend starts correctly
3. ✅ Test database connection with sample `.env`
4. ✅ Verify all features work in production mode
5. ✅ Distribute installer and `INSTALLATION_INSTRUCTIONS.md` to clients
