#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

ADB="${ADB:-adb}"
APK="${APK:-android/app/build/outputs/apk/debug/app-debug.apk}"
PACKAGE="ai.hooshyar.client"
ACTIVITY="${PACKAGE}/.MainActivity"
NODE="${NODE:-node}"
EVIDENCE_SCRIPT="scripts/android-acceptance-evidence.cjs"

# Evidence is owned by this harness, not by the CI workflow that calls it.
# Every `record` below runs only after the corresponding real device check
# passed, and `complete` refuses unless all of them were recorded.
evidence() {
  "$NODE" "$EVIDENCE_SCRIPT" "$@"
}

record_step() {
  echo "=== Recording verification step: $1 ==="
  evidence record "$1"
}

# A failed run must never leave a stale PASS artifact behind.
on_error() {
  local status=$?
  evidence fail "ANDROID_ACCEPTANCE_FAILED:exit=${status}" >/dev/null 2>&1 || true
  exit "$status"
}
trap on_error ERR

get_state() {
  "$ADB" get-state 2>/dev/null | tr -d '\r' || true
}

get_boot() {
  "$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true
}

echo "=== Starting Android product acceptance ==="
evidence begin >/dev/null

echo "=== Verifying APK artifact ==="
test -f "$APK"
record_step apk-present

echo "=== Waiting for ADB transport ==="
"$ADB" wait-for-device

echo "=== Waiting for ADB device to become online and Android to boot ==="
for i in $(seq 1 180); do
  state="$(get_state)"
  boot="$(get_boot)"
  echo "attempt ${i}/180: state=${state:-unknown} boot=${boot:-unknown}"
  if [[ "$state" == "device" && "$boot" == "1" ]]; then
    break
  fi
  sleep 2
done

test "$(get_state)" = "device"
record_step device-online
test "$(get_boot)" = "1"
record_step android-booted

echo "=== Waiting for Package Manager ==="
for i in $(seq 1 60); do
  if "$ADB" shell cmd package list packages >/dev/null 2>&1; then
    echo "Package Manager ready (attempt ${i})"
    break
  fi
  echo "Package Manager not ready (attempt ${i}/60)"
  sleep 2
done
"$ADB" shell cmd package list packages >/dev/null
record_step package-manager-ready

echo "=== Installing APK ==="
"$ADB" install -r "$APK"
record_step apk-installed

echo "=== Launching application ==="
"$ADB" shell am force-stop "$PACKAGE"
"$ADB" shell am start -n "$ACTIVITY"
record_step launcher-start
sleep 5

echo "=== Runtime diagnostics ==="
"$ADB" logcat -d AndroidRuntime:E '*:S' | tail -n 100 || true
"$ADB" shell pidof "$PACKAGE" || true
"$ADB" shell dumpsys activity top | grep -i -A 12 -B 12 "$PACKAGE" || true

echo "=== Verifying process liveness ==="
PID=""
for i in $(seq 1 20); do
  PID="$("$ADB" shell pidof "$PACKAGE" 2>/dev/null | tr -d '\r' || true)"
  echo "pidof attempt ${i}/20: ${PID}"
  if [[ -n "$PID" ]]; then
    break
  fi
  sleep 2
done

test -n "$PID"
record_step process-alive

echo "=== Verifying MainActivity is foreground ==="
TOP="$("$ADB" shell dumpsys activity activities 2>/dev/null | tr -d '\r' || true)"
[[ "$TOP" == *"$ACTIVITY"* ]]
record_step main-activity-visible

echo "=== Finalizing machine-verifiable acceptance evidence ==="
evidence complete >/dev/null

echo "=== ANDROID_PRODUCT_ACCEPTANCE=PASS ==="
