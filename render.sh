#!/usr/bin/env bash
# Forwarder to ./render
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/render" "$@"
