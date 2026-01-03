# Build Instructions for Windows

This guide explains how to build the Chapter One POS application for Windows distribution.

## Prerequisites

1. **Node.js v22.15.0** or later installed
2. **npm** (comes with Node.js)
3. All project dependencies installed

## Build Steps

### 1. Install Dependencies

First, ensure all dependencies are installed:

```bash
npm run install:all
```

### 2. Install electron-builder

The build script will automatically install electron-builder, but you can install it manually:

```bash
npm install --save-dev electron-builder
```

### 3. Build the Application

Run the Windows build command:

```bash
npm run build:win
```

This command will:
1. Build the frontend (React/Vite)
2. Build the backend (TypeScript)
3. Build the Electron main process
4. Install backend production dependencies (removes dev dependencies)
5. Package everything into a Windows installer using electron-builder

### 4. Find the Installer

After the build completes, you'll find the installer in:

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

## What Gets Bundled

The installer includes:
- ✅ Electron runtime
- ✅ Frontend build (`frontend/dist/`)
- ✅ Backend build (`backend/dist/`)
- ✅ Backend production dependencies (`backend/node_modules/`)
- ✅ `.env.example` file (for client configuration)

## Client Installation

After building, provide clients with:
1. The installer: `Chapter One POS Setup 4.0.0.exe`
2. The installation instructions: `INSTALLATION_INSTRUCTIONS.md`

## Troubleshooting

### Build Fails with "electron-builder not found"
```bash
npm install --save-dev electron-builder
```

### Build is too large
- The backend `node_modules` can be large
- Consider using `npm prune --production` in backend before building
- Check that dev dependencies are excluded

### Backend won't start in production
- Verify `.env` file exists in installation directory
- Check that `backend/node_modules` is included in build
- Verify `NODE_PATH` is set correctly (handled automatically)

### Icon not showing
- Ensure `frontend/public/icon.ico` exists
- Icon should be at least 256x256 pixels

## Next Steps

After building:
1. Test the installer on a clean Windows machine
2. Verify backend starts correctly
3. Test database connection with sample `.env`
4. Distribute installer and `INSTALLATION_INSTRUCTIONS.md` to clients


