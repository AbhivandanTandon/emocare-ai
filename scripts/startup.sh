#!/usr/bin/env bash
set -euo pipefail

echo "Startup: download models (if provided), run migrations, start app"

# Default disk paths (will be used if no S3 URLs provided)
: "${TEXT_MODEL_PATH:=models/text_model}"
: "${AUDIO_MODEL_PATH:=models/audio_model/wavlm_large_best.pt}"

# Download text model tarball and extract if TEXT_MODEL_S3_URL is set
if [ -n "${TEXT_MODEL_S3_URL:-}" ]; then
  echo "Downloading text model from $TEXT_MODEL_S3_URL"
  mkdir -p /tmp/models/text_model
  curl -L "$TEXT_MODEL_S3_URL" -o /tmp/models/text_model.tar.gz
  tar -xzf /tmp/models/text_model.tar.gz -C /tmp/models/text_model
  export TEXT_MODEL_PATH="/tmp/models/text_model"
fi

# Download audio model if AUDIO_MODEL_S3_URL is set
if [ -n "${AUDIO_MODEL_S3_URL:-}" ]; then
  echo "Downloading audio model from $AUDIO_MODEL_S3_URL"
  mkdir -p /tmp/models
  curl -L "$AUDIO_MODEL_S3_URL" -o /tmp/models/wavlm_large_best.pt
  export AUDIO_MODEL_PATH="/tmp/models/wavlm_large_best.pt"
fi

# Run alembic migrations if present
if [ -f backend/alembic.ini ] || [ -d backend/alembic ]; then
  echo "Running DB migrations (alembic)..."
  cd backend
  alembic upgrade head || echo "alembic upgrade failed (continuing)"
  cd -
fi

# Start the FastAPI app
cd backend
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
