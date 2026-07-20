#!/usr/bin/env bash
# Primary validator entrypoint for Agent Continuity.
#   ./validate.sh [validate.mjs options]      structural self-check of the package
#   ./validate.sh --verify-install            confirm an installed runtime via `doctor`
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

# `--host` is accepted (lifecycle-target parity) but not needed; `--verify-install` switches mode.
MODE="selfcheck"
VALIDATE_ARGS=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --verify-install) MODE="verify-install"; shift ;;
    --host) shift 2 ;;
    --host=*) shift ;;
    *) VALIDATE_ARGS+=("$1"); shift ;;
  esac
done

if [ "${MODE}" = "verify-install" ]; then
  RUNTIME="${HOME_DIR}/.agent-continuity/bin/agent-continuity.mjs"
  [ -f "${RUNTIME}" ] || ac_die "verify-install: runtime not found at ${RUNTIME}. Run ./install.sh first."
  ac_info "verify-install: checking installed runtime with doctor"
  ac_exec_node "${RUNTIME}" doctor --cwd "${PWD}"
fi

for shell_file in \
  "${ROOT_DIR}/install.sh" \
  "${ROOT_DIR}/uninstall.sh" \
  "${ROOT_DIR}/validate.sh" \
  "${ROOT_DIR}/scripts/lib/platform.sh"
do
  bash -n "${shell_file}" || ac_die "Bash syntax validation failed: ${shell_file}"
done
ac_info "Shell syntax: passed"

if command -v shellcheck >/dev/null 2>&1; then
  shellcheck \
    "${ROOT_DIR}/install.sh" \
    "${ROOT_DIR}/uninstall.sh" \
    "${ROOT_DIR}/validate.sh" \
    "${ROOT_DIR}/scripts/lib/platform.sh"
  ac_info "ShellCheck: passed"
else
  ac_warn "ShellCheck is not installed; static shell linting was skipped."
fi

ac_exec_node "${ROOT_DIR}/validate.mjs" ${VALIDATE_ARGS[@]+"${VALIDATE_ARGS[@]}"}
