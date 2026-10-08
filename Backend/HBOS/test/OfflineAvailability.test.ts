/**
 * Focused tests for the canonical offline availability taxonomy. Proves the
 * six states are distinguished and that unknown connectivity is never promoted
 * to ONLINE (no false "remote succeeded while offline" claim).
 */
const {
  AVAILABILITY_STATES,
  AVAILABILITY_LABELS_FA,
  classifyAvailability,
  availabilityLabelFa,
} = require("../../../web/offline-sync.js");

describe("offline availability taxonomy", () => {
  test("distinguishes all six canonical states", () => {
    expect(classifyAvailability({ online: true })).toBe(AVAILABILITY_STATES.ONLINE);
    expect(classifyAvailability({ online: false })).toBe(AVAILABILITY_STATES.OFFLINE);
    expect(classifyAvailability({})).toBe(AVAILABILITY_STATES.LOCAL);
    expect(classifyAvailability({ online: true, syncing: true })).toBe(AVAILABILITY_STATES.SYNCING);
    expect(classifyAvailability({ online: true, remoteAvailable: false })).toBe(
      AVAILABILITY_STATES.PARTIALLY_AVAILABLE,
    );
    expect(classifyAvailability({ blockedByExternalDependency: true })).toBe(
      AVAILABILITY_STATES.BLOCKED_BY_EXTERNAL_DEPENDENCY,
    );
  });

  test("unknown connectivity is LOCAL, never ONLINE", () => {
    expect(classifyAvailability({})).not.toBe(AVAILABILITY_STATES.ONLINE);
    expect(classifyAvailability({ online: null })).toBe(AVAILABILITY_STATES.LOCAL);
  });

  test("offline local-only work is LOCAL rather than a hard OFFLINE claim", () => {
    expect(classifyAvailability({ online: false, localOnly: true })).toBe(AVAILABILITY_STATES.LOCAL);
  });

  test("syncing and external blockage take precedence over online", () => {
    expect(classifyAvailability({ online: true, syncing: true, remoteAvailable: false })).toBe(
      AVAILABILITY_STATES.SYNCING,
    );
    expect(classifyAvailability({ online: true, blockedByExternalDependency: true, syncing: true })).toBe(
      AVAILABILITY_STATES.BLOCKED_BY_EXTERNAL_DEPENDENCY,
    );
  });

  test("every state has a Persian label", () => {
    const states = Object.values(AVAILABILITY_STATES as Record<string, string>);
    for (const state of states) {
      const labels = AVAILABILITY_LABELS_FA as Record<string, string>;
      expect(typeof labels[state]).toBe("string");
      expect(labels[state].length).toBeGreaterThan(0);
    }
    expect(availabilityLabelFa(AVAILABILITY_STATES.OFFLINE)).toBe("آفلاین");
  });
});
