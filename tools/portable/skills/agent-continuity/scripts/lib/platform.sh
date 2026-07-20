#!/usr/bin/env bash
# Shared shell helpers for Agent Continuity.
# Bash 3.2+ compatible for macOS, Linux, WSL, Git Bash, MSYS2, and Cygwin.

ac_error() { printf 'ERROR: %s\n' "$*" >&2; }
ac_warn() { printf 'WARNING: %s\n' "$*" >&2; }
ac_info() { printf '%s\n' "$*"; }
ac_die() { ac_error "$*"; exit 1; }

ac_detect_platform() {
  local kernel release machine version_text
  kernel="$(uname -s 2>/dev/null || printf 'Unknown')"
  release="$(uname -r 2>/dev/null || printf 'Unknown')"
  machine="$(uname -m 2>/dev/null || printf 'Unknown')"

  AC_KERNEL="$kernel"
  AC_RELEASE="$release"
  AC_ARCH="$machine"
  AC_IS_WSL=0
  AC_IS_WINDOWS_SHELL=0

  case "$kernel" in
    Darwin*)
      AC_PLATFORM="macos"
      AC_PLATFORM_LABEL="macOS"
      ;;
    Linux*)
      version_text=""
      if [ -r /proc/version ]; then
        version_text="$(cat /proc/version 2>/dev/null || true)"
      fi
      if [ -n "${WSL_INTEROP:-}" ] || [ -n "${WSL_DISTRO_NAME:-}" ] || printf '%s %s' "$release" "$version_text" | grep -qi 'microsoft'; then
        AC_PLATFORM="wsl"
        AC_PLATFORM_LABEL="Windows Subsystem for Linux"
        AC_IS_WSL=1
      else
        AC_PLATFORM="linux"
        AC_PLATFORM_LABEL="Linux"
      fi
      ;;
    MINGW*|MSYS*|CYGWIN*)
      AC_PLATFORM="windows"
      AC_PLATFORM_LABEL="Windows (${kernel})"
      AC_IS_WINDOWS_SHELL=1
      ;;
    *)
      AC_PLATFORM="unsupported"
      AC_PLATFORM_LABEL="$kernel"
      ;;
  esac

  export AC_PLATFORM AC_PLATFORM_LABEL AC_KERNEL AC_RELEASE AC_ARCH AC_IS_WSL AC_IS_WINDOWS_SHELL
}

ac_node_is_supported_lts() {
  "$1" -e '
    const major = Number(process.versions.node.split(".")[0]);
    const isLts = Boolean(process.release && process.release.lts);
    process.exit(isLts && major >= 22 ? 0 : 1);
  ' >/dev/null 2>&1
}

ac_find_node() {
  AC_NODE=""

  if [ -n "${AGENT_CONTINUITY_NODE:-}" ]; then
    if [ ! -x "${AGENT_CONTINUITY_NODE}" ] && ! command -v "${AGENT_CONTINUITY_NODE}" >/dev/null 2>&1; then
      ac_die "AGENT_CONTINUITY_NODE does not identify an executable: ${AGENT_CONTINUITY_NODE}"
    fi
    AC_NODE="${AGENT_CONTINUITY_NODE}"
  elif command -v node >/dev/null 2>&1; then
    AC_NODE="$(command -v node)"
  else
    ac_die "Node.js was not found. Install a supported Node.js LTS release or set AGENT_CONTINUITY_NODE."
  fi

  if ! ac_node_is_supported_lts "${AC_NODE}"; then
    local version lts
    version="$(${AC_NODE} -p 'process.version' 2>/dev/null || printf 'unknown')"
    lts="$(${AC_NODE} -p 'process.release.lts || "non-LTS"' 2>/dev/null || printf 'unknown')"
    ac_die "Agent Continuity requires Node.js LTS 22 or newer. Detected ${version} (${lts}). Use the latest LTS release, currently Node.js 24, or set AGENT_CONTINUITY_NODE."
  fi

  AC_NODE_VERSION="$(${AC_NODE} -p 'process.version')"
  AC_NODE_LTS="$(${AC_NODE} -p 'process.release.lts')"
  export AC_NODE AC_NODE_VERSION AC_NODE_LTS
}

ac_exec_node() {
  [ -n "${AC_NODE:-}" ] || ac_die "Node.js has not been resolved. Call ac_find_node first."
  exec "${AC_NODE}" "$@"
}

ac_require_command() {
  command -v "$1" >/dev/null 2>&1 || ac_die "Required command not found on PATH: $1"
}

ac_print_environment() {
  ac_info "Detected environment:"
  ac_info "  platform: ${AC_PLATFORM_LABEL}"
  ac_info "  kernel:   ${AC_KERNEL} ${AC_RELEASE}"
  ac_info "  arch:     ${AC_ARCH}"
  ac_info "  shell:    ${BASH_VERSION:+bash ${BASH_VERSION}}"
  ac_info "  node:     ${AC_NODE} ${AC_NODE_VERSION} LTS ${AC_NODE_LTS}"
}
