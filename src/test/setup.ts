/** @format */

// Test setup file for vitest
import { vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Global test setup
beforeEach(() => {
    vi.clearAllMocks();
});