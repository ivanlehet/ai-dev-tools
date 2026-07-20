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

RECEIPT="$SCRIPT_DIR/.install-receipt"
if [ -f "$RECEIPT" ]; then TARGET="$(cat "$RECEIPT")"; fi
if [ ! -e "$TARGET" ]; then echo "uninstall: nothing installed at $TARGET"; exit 0; fi
case "$TARGET" in *"/$TOOL_NAME") : ;; *) echo "uninstall: refusing to remove non-owned path $TARGET" >&2; exit 1 ;; esac
if [ "$DRY_RUN" = "1" ]; then echo "[dry-run] would remove $TARGET"; exit 0; fi
rm -rf "$TARGET"
rm -f "$RECEIPT"
echo "uninstall: removed $TARGET"
