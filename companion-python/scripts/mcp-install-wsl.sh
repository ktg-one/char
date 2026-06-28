#!/usr/bin/env bash
# Wire char dev MCP stack after WSL copy. No secrets — reads repo-root .mcp.json.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STACK="$REPO_ROOT/.mcp.json"
BIN_DIR="${HOME}/.local/bin"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing: $1 — install before rerunning"
    exit 1
  }
}

echo "== char MCP install (WSL) =="
echo "repo: $REPO_ROOT"

need node
need npx
need uvx
need python3

if [[ ! -f "$STACK" ]]; then
  echo "missing stack manifest: $STACK"
  exit 1
fi

mkdir -p "$BIN_DIR"
export PATH="$BIN_DIR:$PATH"

if ! command -v codebase-memory-mcp >/dev/null 2>&1; then
  echo "Installing codebase-memory-mcp (static binary -> ~/.local/bin)..."
  curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash -s -- --skip-config
else
  echo "codebase-memory-mcp: $(command -v codebase-memory-mcp)"
fi

if ! command -v headroom >/dev/null 2>&1; then
  echo "Installing headroom (pip)..."
  python3 -m pip install --user headroom
fi

echo "Warming npx MCP packages (first spawn will be faster)..."
npx -y @agentmemory/mcp --help >/dev/null 2>&1 || true
npx -y @upstash/context7-mcp@latest --help >/dev/null 2>&1 || true
npx -y chrome-devtools-mcp@latest --help >/dev/null 2>&1 || true

echo "Warming uvx MCP packages..."
uvx mcp-server-fetch --help >/dev/null 2>&1 || true
uvx jcodemunch-mcp --help >/dev/null 2>&1 || true

# Claude Code: project .mcp.json is already at repo root (auto-discovered when cwd = repo).
ln -sf "$STACK" "$REPO_ROOT/.claude/mcp.json" 2>/dev/null || cp "$STACK" "$REPO_ROOT/.claude/mcp.json"

# Optional Hermes CLI spine (merge by hand if ~/.hermes/config.yaml already exists).
HERMES_EXAMPLE="$REPO_ROOT/companion-python/config/hermes.example.yaml"
if [[ -f "$HERMES_EXAMPLE" && ! -f "${HOME}/.hermes/config.yaml" ]]; then
  mkdir -p "${HOME}/.hermes"
  cp "$HERMES_EXAMPLE" "${HOME}/.hermes/config.yaml"
  echo "Hermes: wrote ~/.hermes/config.yaml from example"
fi

echo ""
echo "Stack manifest: $STACK"
echo "Servers: agentmemory, headroom, chrome-devtools, serena, context7, jcodemunch, fetch, codebase-memory"
echo ""
echo "Before coding sessions:"
echo "  1. agentmemory REST on :3111  (npx @agentmemory/agentmemory start  OR  existing daemon)"
echo "  2. Ollama on :11434           (companion LLM)"
echo "  3. companion on :5000         (cd companion-python && ./scripts/start.sh)"
echo "  4. LocalSoundsAPI on :5006    (optional TTS)"
echo ""
echo "Verify in Claude Code:  cd $REPO_ROOT && claude  then  /mcp"
echo "Index repo graph:       ask agent to 'index this project' (codebase-memory)"
echo ""
echo "Chrome on WSL: if devtools MCP cannot attach, run Chrome with --remote-debugging-port=9222"
echo "  and add args to chrome-devtools entry in .mcp.json if needed."