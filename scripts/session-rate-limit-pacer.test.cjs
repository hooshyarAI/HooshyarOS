'use strict';

const {
  SESSION_RATE_LIMITED_POST_PATHS,
  isSessionRateLimitedPost
} = require('./session-rate-limit-pacer.cjs');

describe('session rate-limit pacer route contract', () => {
  test('paces the canonical asynchronous ingestion job creation POST', () => {
    expect(SESSION_RATE_LIMITED_POST_PATHS.has('/api/ingest/jobs')).toBe(true);
    expect(isSessionRateLimitedPost('/api/ingest/jobs', 'POST')).toBe(true);
  });

  test('does not pace read-only ingestion job polling', () => {
    expect(isSessionRateLimitedPost('/api/ingest/jobs/abc123', 'GET')).toBe(false);
  });

  test('keeps existing mutation routes method-aware', () => {
    expect(isSessionRateLimitedPost('/api/financial/analyze', 'POST')).toBe(true);
    expect(isSessionRateLimitedPost('/api/financial/analyze', 'GET')).toBe(false);
  });
});
