/**
 * Deterministic tests for the offline read path.
 *
 * Proves the locally cached snapshot preserves the last server-authoritative
 * result for read-while-offline, that the availability taxonomy never promotes
 * unknown connectivity to ONLINE, and that the shipped client wires the offline
 * read + re-entry-to-online path.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const O = require('./offline-sync.js');

const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const SNAPSHOT = {
  savedAt: '2026-09-27T00:00:00.000Z',
  source: { sourceName: 'صورت‌مالی.xlsx', sha256: 'a'.repeat(64) },
  statementInsight: { documentStatus: 'COMPLETED', periods: [{ label: '1402' }], metrics: { netProfit: 1000 } },
  trust: { state: 'CROSS_CHECKED', canonicalBinding: true, source: { sha256: 'a'.repeat(64) } },
  dualValidation: { summary: { agreements: 1, disagreements: 0, notTestable: 3, requiredReviews: [] }, outcomes: [] }
};

describe('offline end-to-end read (snapshot store)', () => {
  test('persists and reloads the last server-authoritative snapshot', async () => {
    const store = O.createSnapshotStore(O.memoryStorage());
    expect(await store.load()).toBeNull();
    expect(await store.save(SNAPSHOT)).toBe(true);
    const loaded = await store.load();
    expect(loaded.statementInsight.documentStatus).toBe('COMPLETED');
    expect(loaded.source.sourceName).toBe('صورت‌مالی.xlsx');
    expect(loaded.trust.state).toBe('CROSS_CHECKED');
    expect(loaded.dualValidation.summary.notTestable).toBe(3);
  });

  test('clears the snapshot and never throws without storage', async () => {
    const memory = O.memoryStorage();
    const store = O.createSnapshotStore(memory);
    await store.save(SNAPSHOT);
    expect(await store.clear()).toBe(true);
    expect(await store.load()).toBeNull();

    const detached = O.createSnapshotStore({ getItem: () => { throw new Error('blocked'); } });
    expect(await detached.load()).toBeNull();
    expect(await detached.save(SNAPSHOT)).toBe(false);
  });

  test('availability taxonomy never promotes unknown connectivity to ONLINE', () => {
    expect(O.classifyAvailability({ online: undefined })).toBe('LOCAL');
    expect(O.classifyAvailability({ online: false })).toBe('OFFLINE');
    expect(O.classifyAvailability({ online: false, localOnly: true })).toBe('LOCAL');
    expect(O.classifyAvailability({ online: true, remoteAvailable: false })).toBe('PARTIALLY_AVAILABLE');
    expect(O.classifyAvailability({ online: true })).toBe('ONLINE');
    expect(O.classifyAvailability({ online: true, syncing: true })).toBe('SYNCING');
    expect(O.classifyAvailability({ blockedByExternalDependency: true })).toBe('BLOCKED_BY_EXTERNAL_DEPENDENCY');
  });

  test('client wires the offline read and re-entry-to-online path', () => {
    const app = read('web/app.js');
    expect(app).toContain('createSnapshotStore');
    expect(app).toContain('renderOfflineSnapshot');
    expect(app).toContain("addEventListener('offline'");
    expect(app).toContain('flushOfflineQueue');
    // The offline read must reuse the existing summary renderer, not a parallel one.
    expect(app).toContain('renderStatementInsight(snapshot.statementInsight');
  });

  test('the shipped app script parses as valid JavaScript', () => {
    expect(() => new vm.Script(read('web/app.js'), { filename: 'web/app.js' })).not.toThrow();
  });
});
