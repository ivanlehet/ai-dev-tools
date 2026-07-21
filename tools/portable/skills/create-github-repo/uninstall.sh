#!/usr/bin/env bash
# Uninstall create-github-repo: removes only the directory this tool owns. Supports --dry-run.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/lib/detect-platform.sh" ]; then . "$SCRIPT_DIR/lib/detect-platform.sh"
elif [ -f "$SCRIPT_DIR/../../../../scripts/lib/detect-platform.sh" ]; then . "$SCRIPT_DIR/../../../../scripts/lib/detect-platform.sh"
else echo "detect-platform.sh not found" >&2; exit 1; fi

TOOL_NAME="create-github-repo"
TOOL_TYPE="skill"
parse_common_args "$@"
require_host "$AI_HOST" "claude cursor codex"
detect_platform
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

# Resolve an existing path (file or dir) to its physical absolute path (follows symlinks).
physical_path() {
  local p="$1"
  if [ -d "$p" ]; then (cd "$p" 2>/dev/null && pwd -P)
  else (cd "$(dirname "$p")" 2>/dev/null && printf '%s/%s\n' "$(pwd -P)" "$(basename "$p")"); fi
}

RECEIPT="$SCRIPT_DIR/.install-receipt"
if [ -f "$RECEIPT" ]; then TARGET="$(cat "$RECEIPT")"; fi
if [ ! -e "$TARGET" ]; then echo "uninstall: nothing installed at $TARGET"; exit 0; fi

# The receipt is attacker-controllable, so never trust it blindly before `rm -rf`.
# Resolve symlinks and require the target to be the tool's own directory under the expected
# host skill root (or to equal the freshly resolved target). Refuse anything else.
EXPECTED_ROOT="$(dirname "$EXPECTED_TARGET")"
if [ -d "$EXPECTED_ROOT" ]; then RESOLVED_ROOT="$(cd "$EXPECTED_ROOT" && pwd -P)"; else RESOLVED_ROOT="$EXPECTED_ROOT"; fi
RESOLVED_EXPECTED="$(physical_path "$EXPECTED_TARGET" 2>/dev/null || true)"; [ -n "$RESOLVED_EXPECTED" ] || RESOLVED_EXPECTED="$EXPECTED_TARGET"
RESOLVED_TARGET="$(physical_path "$TARGET" 2>/dev/null || true)"; [ -n "$RESOLVED_TARGET" ] || RESOLVED_TARGET="$TARGET"
receipt_ok=0
[ "$RESOLVED_TARGET" = "$RESOLVED_EXPECTED" ] && receipt_ok=1
case "$RESOLVED_TARGET" in
  */"$TOOL_NAME") case "$RESOLVED_TARGET" in "$RESOLVED_ROOT"/*) receipt_ok=1 ;; esac ;;
esac
if [ "$receipt_ok" != "1" ]; then
  echo "uninstall: refusing to remove path outside the expected $AI_HOST skill location: $TARGET (resolved: $RESOLVED_TARGET; expected under: $RESOLVED_ROOT)" >&2
  exit 1
fi
if [ "$DRY_RUN" = "1" ]; then echo "[dry-run] would remove $TARGET"; exit 0; fi
rm -rf "$TARGET"
rm -f "$RECEIPT"
echo "uninstall: removed $TARGET"
