#!/bin/bash
# Tìm iPhone đã pair (USB hoặc Wi‑Fi). In ra: UDID|tên|USB|Wi‑Fi
# Usage: eval "$(bash ios-resolve-device.sh [UDID_ưu_tiên])"
set -euo pipefail

PREFERRED="${1:-}"

if [ -n "$PREFERRED" ]; then
  printf '%s\n' "$PREFERRED| (chỉ định tay)|manual|"
  exit 0
fi

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

if ! xcrun devicectl list devices --json-output "$TMP" >/dev/null 2>&1; then
  exit 1
fi

python3 - "$TMP" <<'PY'
import json
import sys

path = sys.argv[1]
try:
    data = json.load(open(path))
except OSError:
    sys.exit(1)

devices = data.get("result", {}).get("devices", [])
rows = []
for d in devices:
    cp = d.get("connectionProperties") or {}
    if cp.get("pairingState") != "paired":
        continue
    if cp.get("tunnelState") != "connected":
        continue
    udid = (d.get("hardwareProperties") or {}).get("udid")
    if not udid:
        continue
    name = (d.get("deviceProperties") or {}).get("name") or udid
    transport = cp.get("transportType") or "unknown"
    # wired trước, localNetwork sau
    rank = 0 if transport == "wired" else 1
    rows.append((rank, name, udid, transport))

if not rows:
    sys.exit(1)

rows.sort(key=lambda r: (r[0], r[1]))
_, name, udid, transport = rows[0]
label = "USB" if transport == "wired" else ("Wi‑Fi" if transport == "localNetwork" else transport)
print(f"{udid}|{name}|{label}|{transport}")
PY
