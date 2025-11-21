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

# Build arguments for directory paths (defaults: /pb_data and /pb_public)
ARG PB_DATA_DIR=/pb_data
ARG PB_PUBLIC_DIR=/pb_public

# Create the directories
RUN mkdir -p "${PB_DATA_DIR}" "${PB_PUBLIC_DIR}"

# Copy the executable from builder
COPY --from=backend-builder /app/lootsheet .

# Copy entrypoint script
COPY docker-entrypoint.sh /root/docker-entrypoint.sh
RUN chmod +x /root/docker-entrypoint.sh

# Expose PocketBase default port
EXPOSE 8090

# Set default environment variables (can be overridden at runtime)
ENV PB_DATA_DIR=${PB_DATA_DIR}
ENV PB_PUBLIC_DIR=${PB_PUBLIC_DIR}

# Use entrypoint script for flexible configuration
ENTRYPOINT ["/root/docker-entrypoint.sh"]

