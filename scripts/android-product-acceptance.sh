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

# Every ADB probe is bounded so a missing emulator/transport cannot
# bypass the finite boot-retry loop and hold the CI job indefinitely.
get_state() {
  timeout 2s "$ADB" get-state 2>/dev/null | tr -d '\r' || true
}

get_boot() {
  timeout 2s "$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true
}

echo "=== Starting Android product acceptance ==="
evidence begin >/dev/null

echo "=== Verifying APK artifact ==="
test -f "$APK"
record_step apk-present

echo "=== Waiting for ADB transport (bounded) ==="
if ! timeout 5s "$ADB" wait-for-device; then
  echo "ADB transport did not appear within 5 seconds; continuing with bounded state/boot probes."
fi

echo "=== Waiting for ADB device to become online and Android to boot ==="
for i in $(seq 1 90); do
  state="$(get_state)"
  boot=""
  if [[ "$state" == "device" ]]; then
    boot="$(get_boot)"
  fi
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
for i in $(seq 1 30); do
  if timeout 3s "$ADB" shell cmd package list packages >/dev/null 2>&1; then
    echo "Package Manager ready (attempt ${i})"
    break
  fi
  echo "Package Manager not ready (attempt ${i}/30)"
  sleep 2
done
timeout 3s "$ADB" shell cmd package list packages >/dev/null
record_step package-manager-ready

echo "=== Installing APK ==="
timeout 120s "$ADB" install -r "$APK"
record_step apk-installed

echo "=== Launching application ==="
timeout 20s "$ADB" shell am force-stop "$PACKAGE"
timeout 20s "$ADB" shell am start -n "$ACTIVITY"
record_step launcher-start
sleep 5

echo "=== Runtime diagnostics ==="
timeout 10s "$ADB" logcat -d AndroidRuntime:E '*:S' | tail -n 100 || true
timeout 5s "$ADB" shell pidof "$PACKAGE" || true
timeout 10s "$ADB" shell dumpsys activity top | grep -i -A 12 -B 12 "$PACKAGE" || true

echo "=== Verifying process liveness ==="
PID=""
for i in $(seq 1 20); do
  PID="$(timeout 5s "$ADB" shell pidof "$PACKAGE" 2>/dev/null | tr -d '\r' || true)"
  echo "pidof attempt ${i}/20: ${PID}"
  if [[ -n "$PID" ]]; then
    break
  fi
  sleep 2
done

test -n "$PID"
record_step process-alive

echo "=== Verifying MainActivity is foreground ==="
TOP="$(timeout 10s "$ADB" shell dumpsys activity activities 2>/dev/null | tr -d '\r' || true)"
[[ "$TOP" == *"$ACTIVITY"* ]]
record_step main-activity-visible

echo "=== Finalizing machine-verifiable acceptance evidence ==="
evidence complete >/dev/null

echo "=== ANDROID_PRODUCT_ACCEPTANCE=PASS ==="
