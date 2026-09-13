# Kilo Code Operator

**Status:** Canonical implementation of the Governance-approved local execution operator.

## Purpose

`KiloCodeExecutionAdapter` exposes Kilo Code to the existing HooshyarOS autonomous construction toolset without making Kilo an architectural dependency.

The operator contract is:

`Construction Fabric → operator selection → Kilo Code (when available) → local execution → verification → evidence`

When Kilo is unavailable, the existing Python implementation worker remains the safe fallback.

## Execution contract

Kilo is invoked through the documented non-interactive CLI form:

`kilo run --auto "<stage prompt>"`

The adapter detects the executable locally and records the operator in autonomous generation evidence. It does not select capabilities, redefine architecture, own governance, or bypass verification.

## Selection policy

`HOOSHYAR_AGENT=auto` is the default behavior:

1. prefer Kilo when the local executable is available;
2. otherwise use the repository-native Python worker;
3. if Kilo is selected but fails before changing the repository, attempt the approved Python fallback;
4. if an operator leaves an unexpected repository change, fail closed and preserve the evidence for repair.

`HOOSHYAR_AGENT=kilo` still uses Python as the governed fallback when Kilo is unavailable. `HOOSHYAR_AGENT=python` explicitly selects Python. Unknown operator values are rejected.

## Independence invariant

The autonomous construction fabric must remain operable without Kilo. Kilo is an interchangeable execution/operator adapter, not an architectural owner or mandatory runtime dependency.
