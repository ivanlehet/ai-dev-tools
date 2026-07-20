#!/usr/bin/env bash
# Install create-github-repo for a selected host. Detects the OS, scopes writes, backs up, is reversible.
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
if [ "$DRY_RUN" = "1" ]; then echo "[dry-run] would install create-github-repo -> $TARGET"; exit 0; fi

if [ -e "$TARGET" ]; then
  BACKUP="$TARGET.bak.$$"
  echo "install: existing target found, backing up to $BACKUP"
  mv "$TARGET" "$BACKUP"
fi
safe_install_dir "$SCRIPT_DIR" "$TARGET"
# Remove repo-only / installer files from the installed copy.
rm -f "$TARGET/install.sh" "$TARGET/uninstall.sh" "$TARGET/validate.sh" "$TARGET/project.json" "$TARGET/package.json" 2>/dev/null || true
rm -rf "$TARGET/lib" "$TARGET/tests" "$TARGET/fixtures" 2>/dev/null || true
printf '%s\n' "$TARGET" > "$RECEIPT"
echo "install: create-github-repo installed to $TARGET (host: $AI_HOST, os: $OS_PLATFORM)"
case "$TOOL_TYPE" in
  plugin) echo "  next: claude plugin marketplace add . && claude plugin install create-github-repo@ai-dev-tools" ;;
  prompt) echo "  note: to activate, merge $TARGET/AGENTS.md into your project's AGENTS.md" ;;
  mcp)    echo "  note: register $TARGET/server.json with your host (e.g. codex mcp add / .mcp.json)" ;;
esac
