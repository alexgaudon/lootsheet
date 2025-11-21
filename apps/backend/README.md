# Backend

This is the PocketBase backend extended with Go that serves the embedded React frontend.

## Setup

1. Build the frontend first:
   ```bash
   cd ../frontend
   npm run build
   ```

2. Build and run the backend:
   ```bash
   go build -o lootsheet
   ./lootsheet serve
   ```

## Development

For development, you may want to serve the frontend separately (using `npm run dev` in the frontend directory) and only embed it in production builds.

## Embedding Frontend

The frontend is embedded at build time using Go's `embed` package. The `//go:embed` directive in `main.go` embeds the `../frontend/dist/*` directory into the binary.

