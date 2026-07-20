#!/usr/bin/env bash
# Scoped uninstaller entrypoint for Agent Continuity.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
# shellcheck source=scripts/lib/platform.sh
source "${ROOT_DIR}/scripts/lib/platform.sh"

ac_detect_platform
case "${AC_PLATFORM}" in
  macos|linux|wsl|windows) ;;
  *) ac_die "Unsupported operating system or shell: ${AC_PLATFORM_LABEL}" ;;
esac

ac_find_node
ac_print_environment

# Ignore a leading `--host <name>` (accepted for lifecycle-target parity); the uninstaller
# resolves scope from the recorded install manifest and its own --providers/--repo flags.
UNINSTALL_ARGS=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --host) shift 2 ;;
    --host=*) shift ;;
    *) UNINSTALL_ARGS+=("$1"); shift ;;
  esac
done

ac_exec_node "${ROOT_DIR}/uninstall.mjs" ${UNINSTALL_ARGS[@]+"${UNINSTALL_ARGS[@]}"}
