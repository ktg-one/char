#!/usr/bin/env bash
# Launch companion after quick health check. Run from WSL after copy to ~/projects/char
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example and fill in keys/paths:"
  echo "  cp .env.example .env"
  exit 1
fi

echo "Running tests..."
python -m pytest -q

echo "Starting companion on http://127.0.0.1:${PORT:-5000}"
echo "Optional: LocalSoundsAPI TTS at \${LOCAL_SOUNDS_URL:-http://127.0.0.1:5006}"
exec python app.py