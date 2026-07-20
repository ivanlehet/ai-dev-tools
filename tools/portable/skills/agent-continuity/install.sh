#!/usr/bin/env bash
# Primary installer entrypoint for Agent Continuity.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
# shellcheck source=scripts/lib/platform.sh
source "${ROOT_DIR}/scripts/lib/platform.sh"

ac_detect_platform
case "${AC_PLATFORM}" in
  macos|linux|wsl|windows) ;;
  *) ac_die "Unsupported operating system or shell: ${AC_PLATFORM_LABEL}" ;;
esac

ac_require_command git
ac_find_node
ac_print_environment
ac_exec_node "${ROOT_DIR}/install.mjs" "$@"
