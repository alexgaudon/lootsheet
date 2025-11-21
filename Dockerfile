# Build stage for frontend
FROM oven/bun:1 AS frontend-builder
WORKDIR /app
COPY apps/frontend/package.json apps/frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY apps/frontend/ ./
RUN bun run build

# Build stage for backend
FROM golang:1.25.4-alpine AS backend-builder
WORKDIR /app

# Enable automatic toolchain downloads for Go 1.25.4
ENV GOTOOLCHAIN=auto

# Copy go mod files
COPY apps/backend/go.mod apps/backend/go.sum ./
RUN go mod download

# Copy backend source code
COPY apps/backend/ ./

# Copy frontend dist to pb_public for embedding
COPY --from=frontend-builder /app/dist ./pb_public

# Build the Go application with production tag
RUN CGO_ENABLED=0 GOOS=linux go build -tags production -a -installsuffix cgo -o lootsheet .

# Final stage - minimal Alpine image
FROM alpine:latest
RUN apk --no-cache add ca-certificates wget
WORKDIR /root/

# Copy the executable from builder
COPY --from=backend-builder /app/lootsheet .

# Expose PocketBase default port
EXPOSE 8090

# Run the executable
# Bind to 0.0.0.0 to accept connections from outside the container
CMD ["./lootsheet", "serve", "--http=0.0.0.0:8090"]

