# LootSheet

A loot splitting application for Tibia.

## Tech Stack

- **Frontend**: React with TanStack Router, Tailwind CSS, and PocketBase
- **Backend**: Go with PocketBase
- **Authentication**: Discord OAuth

## Quick Start

1. Build the frontend:
   ```bash
   cd apps/frontend
   npm install
   npm run build
   ```

2. Run the backend:
   ```bash
   cd apps/backend
   go build -o lootsheet
   ./lootsheet serve
   ```

## Development

For development, run the frontend separately:
```bash
cd apps/frontend
npm run dev
```

Then run the backend without the embedded frontend.