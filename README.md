# Chapter One POS v4.0

A modern, professional desktop Point of Sale application built with Electron, React, and Node.js.

## Features

- 🖥️ Desktop application with Electron
- 💳 Complete POS system
- 📦 Product management with barcode scanning
- 🛒 Sales processing
- 📊 Purchase order management
- 👥 Customer & Supplier management
- 📈 Reports and analytics
- 🔐 Secure authentication
- 🎨 Modern, professional UI/UX

## Tech Stack

- **Frontend**: Electron + React + TypeScript + Vite
- **Backend**: Node.js v22.15.0 + Express + TypeScript
- **Database**: PostgreSQL
- **UI**: Tailwind CSS + Modern Components

## Prerequisites

- Node.js v22.15.0 or higher
- PostgreSQL 17.6 or higher
- npm or yarn

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. Run database migrations (if needed)

5. Start development:
   ```bash
   npm run dev
   ```

## Project Structure

```
Chapter_One_V4.0/
├── electron/          # Electron main process
├── frontend/          # React frontend
├── backend/           # Node.js API server
├── shared/            # Shared types/interfaces
└── database/         # DB connection & models
```

## Development

- `npm run dev` - Start all services in development mode
- `npm run build` - Build for production
- `npm run start` - Start production build

## License

MIT











