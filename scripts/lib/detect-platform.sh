#!/usr/bin/env bash
# Shared platform + host detection for tool install / validate / uninstall scripts.
# Source this file:  . "$(dirname "$0")/../../../scripts/lib/detect-platform.sh"
#
# Two independent axes:
#   OS_PLATFORM : macos | linux | windows   (drives paths & shell behaviour)
#   AI_HOST     : claude | cursor | codex    (drives target location & manifest format)
#
# It never writes anything; it only sets variables and defines helper functions.

set -euo pipefail

# ---- OS detection -----------------------------------------------------------
detect_platform() {
  case "$(uname -s 2>/dev/null || echo unknown)" in
    Darwin*) OS_PLATFORM=macos ;;
    Linux*)  OS_PLATFORM=linux ;;
    MINGW* | MSYS* | CYGWIN* | Windows_NT) OS_PLATFORM=windows ;;
    *)
      echo "detect-platform: unsupported OS '$(uname -s 2>/dev/null)'." >&2
      return 1
      ;;
  esac

  # Home base (Git Bash on Windows maps $HOME; fall back to USERPROFILE).
  HOME_DIR="${HOME:-${USERPROFILE:-}}"
  if [ -z "$HOME_DIR" ]; then
    echo "detect-platform: cannot resolve home directory." >&2
    return 1
  fi

  # Per-host config roots (respect standard overrides where they exist).
  CLAUDE_HOME="${CLAUDE_CONFIG_DIR:-$HOME_DIR/.claude}"
  CODEX_HOME="${CODEX_HOME:-$HOME_DIR/.codex}"
  CURSOR_HOME="${CURSOR_CONFIG_DIR:-${CURSOR_HOME:-$HOME_DIR/.cursor}}"
  # Cursor project rules are workspace-relative; user rules/skills are in the app config.
  CURSOR_PROJECT_RULES_DIR=".cursor/rules"

  export OS_PLATFORM HOME_DIR CLAUDE_HOME CODEX_HOME CURSOR_HOME CURSOR_PROJECT_RULES_DIR
  return 0
}

# ---- Host validation --------------------------------------------------------
# Usage: require_host "$AI_HOST" "claude cursor codex"
require_host() {
  local host="${1:-}" allowed="${2:-claude cursor codex}"
  if [ -z "$host" ]; then
    echo "detect-platform: no --host given (expected one of: $allowed)." >&2
    return 2
  fi
  case " $allowed " in
    *" $host "*) return 0 ;;
    *)
      echo "detect-platform: host '$host' not supported by this tool (targets: $allowed)." >&2
      return 2
      ;;
  esac
}

# ---- Safe copy inside a scoped target --------------------------------------
# Copy (never symlink) SRC into DEST_DIR, creating DEST_DIR. Refuses to escape it.
safe_install_dir() {
  local src="$1" dest="$2"
  case "$dest" in
    *'..'*)
      echo "detect-platform: refusing target with '..': $dest" >&2
      return 1
      ;;
  esac
  mkdir -p "$dest"
  cp -R "$src"/. "$dest"/
}

# Parse a leading `--host <name>` (and optional `--dry-run`) from a script's args.
# Sets AI_HOST and DRY_RUN; leaves remaining args in REMAINING_ARGS[].
parse_common_args() {
  AI_HOST="${AI_HOST:-}"
  DRY_RUN="${DRY_RUN:-0}"
  REMAINING_ARGS=()
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --host) AI_HOST="${2:-}"; shift 2 ;;
      --host=*) AI_HOST="${1#*=}"; shift ;;
      --dry-run) DRY_RUN=1; shift ;;
      *) REMAINING_ARGS+=("$1"); shift ;;
    esac
  done
  export AI_HOST DRY_RUN
}
