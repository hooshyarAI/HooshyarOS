#!/usr/bin/env bash
set -euo pipefail

ADB="${ADB:-adb}"
APK="android/app/build/outputs/apk/debug/app-debug.apk"
PACKAGE="ai.hooshyar.client"
ACTIVITY="${PACKAGE}/.MainActivity"

get_state() {
  "$ADB" get-state 2>/dev/null | tr -d '\r' || true
}

get_boot() {
  "$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true
}

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
test "$(get_boot)" = "1"

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

echo "=== Installing APK ==="
"$ADB" install -r "$APK"

echo "=== Launching application ==="
"$ADB" shell am force-stop "$PACKAGE"
"$ADB" shell am start -n "$ACTIVITY"
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

echo "=== Verifying MainActivity is foreground ==="
TOP="$("$ADB" shell dumpsys activity activities 2>/dev/null | tr -d '\r' || true)"
[[ "$TOP" == *"$ACTIVITY"* ]]

echo "=== ANDROID_PRODUCT_ACCEPTANCE=PASS ==="
