#!/bin/sh
set -e

# Default paths if not set via environment variables
PB_DATA_DIR="${PB_DATA_DIR:-/pb_data}"

# Create directories if they don't exist
mkdir -p "${PB_DATA_DIR}"

# Execute the lootsheet command with configured directories
exec ./lootsheet serve --http=0.0.0.0:8090 --dir="${PB_DATA_DIR}" 