#!/usr/bin/env bash
# Validate create-github-repo. Default: structural self-check. With --verify-install: confirm the install.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/lib/detect-platform.sh" ]; then . "$SCRIPT_DIR/lib/detect-platform.sh"
elif [ -f "$SCRIPT_DIR/../../../../scripts/lib/detect-platform.sh" ]; then . "$SCRIPT_DIR/../../../../scripts/lib/detect-platform.sh"
else echo "detect-platform.sh not found" >&2; exit 1; fi

TOOL_NAME="create-github-repo"
TOOL_TYPE="skill"
MODE="selfcheck"
case " $* " in *" --verify-install "*) MODE="verify-install" ;; esac
parse_common_args "$@"
detect_platform

if [ "$MODE" = "verify-install" ]; then
  require_host "$AI_HOST" "claude cursor codex"
  resolve_target() {
  case "$AI_HOST:$TOOL_TYPE" in
    claude:skill)  TARGET="$CLAUDE_HOME/skills/$TOOL_NAME" ;;
    codex:skill)   TARGET="$CODEX_HOME/skills/$TOOL_NAME" ;;
    cursor:skill)  TARGET="$CURSOR_HOME/skills/$TOOL_NAME" ;;
    claude:agent)  TARGET="$CLAUDE_HOME/agents/$TOOL_NAME" ;;
    claude:hook)   TARGET="$CLAUDE_HOME/hooks/$TOOL_NAME" ;;
    claude:plugin) TARGET="$CLAUDE_HOME/plugins/local/$TOOL_NAME" ;;
    cursor:rule)   TARGET="${DEST:-$PWD}/.cursor/rules/$TOOL_NAME" ;;
    codex:prompt)  TARGET="${DEST:-$PWD}/.agents/$TOOL_NAME" ;;
    cursor:prompt) TARGET="${DEST:-$PWD}/.agents/$TOOL_NAME" ;;
    claude:mcp|cursor:mcp|codex:mcp) TARGET="${DEST:-$PWD}/.mcp-servers/$TOOL_NAME" ;;
    *) echo "install: unsupported combination $AI_HOST:$TOOL_TYPE" >&2; return 1 ;;
  esac
}
  resolve_target
  EXPECTED_TARGET="$TARGET"
  physical_path() {
    local p="$1"
    if [ -d "$p" ]; then (cd "$p" 2>/dev/null && pwd -P)
    else (cd "$(dirname "$p")" 2>/dev/null && printf '%s/%s\n' "$(pwd -P)" "$(basename "$p")"); fi
  }
  RECEIPT="$SCRIPT_DIR/.install-receipt"
  if [ -f "$RECEIPT" ]; then TARGET="$(cat "$RECEIPT")"; fi
  [ -d "$TARGET" ] || { echo "verify-install: not installed at $TARGET" >&2; exit 1; }
  # The receipt is attacker-controllable; only trust an exact match to the expected install path.
  RESOLVED_EXPECTED="$(physical_path "$EXPECTED_TARGET" 2>/dev/null || true)"; [ -n "$RESOLVED_EXPECTED" ] || RESOLVED_EXPECTED="$EXPECTED_TARGET"
  RESOLVED_TARGET="$(physical_path "$TARGET" 2>/dev/null || true)"; [ -n "$RESOLVED_TARGET" ] || RESOLVED_TARGET="$TARGET"
  if [ "$RESOLVED_TARGET" != "$RESOLVED_EXPECTED" ]; then
    echo "verify-install: receipt is not the exact expected $AI_HOST install location: $TARGET (resolved: $RESOLVED_TARGET; expected: $RESOLVED_EXPECTED)" >&2
    exit 1
  fi
  echo "verify-install: create-github-repo present at $TARGET"
  exit 0
fi

# Structural self-check (no Nx needed): manifest present & parseable.
[ -f "$SCRIPT_DIR/manifest/tool.json" ] || { echo "validate: missing manifest/tool.json" >&2; exit 1; }
node -e "JSON.parse(require('fs').readFileSync('$SCRIPT_DIR/manifest/tool.json','utf8'))" || { echo "validate: invalid tool.json" >&2; exit 1; }
echo "validate: create-github-repo structural self-check OK (os: $OS_PLATFORM)"
