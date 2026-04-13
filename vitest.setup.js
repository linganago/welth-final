/**
 * Global test setup — runs before every test file.
 *
 * 1. Resets all vi.mock / vi.fn state between tests so tests are isolated.
 * 2. Provides a minimal process.env for modules that read env vars at
 *    import-time (e.g. lib/prisma.js reads DATABASE_URL).
 */

import { vi, afterEach } from "vitest";

// Restore all mocks after every test so state doesn't leak
afterEach(() => {
  vi.restoreAllMocks();
});

// Minimal env vars — real DB connection is NOT used in unit tests.
// Integration tests that need the DB must set TEST_DATABASE_URL themselves.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://test:test@localhost:5432/welth_test";
process.env.DIRECT_URL = process.env.TEST_DATABASE_URL ?? "postgresql://test:test@localhost:5432/welth_test";
process.env.GEMINI_API_KEY = "test-gemini-key";
process.env.ARCJET_KEY = "test-arcjet-key";
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_xxx";
process.env.CLERK_SECRET_KEY = "sk_test_xxx";
