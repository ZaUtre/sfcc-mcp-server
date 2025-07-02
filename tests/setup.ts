import 'dotenv/config';

// Jest setup file for global test configuration
// This file is loaded before any tests are run

// Set up default test environment variables for SFCC configuration
// These are required by ConfigManager and will be overridden by individual tests if needed
process.env.SFCC_ADMIN_CLIENT_ID = process.env.SFCC_ADMIN_CLIENT_ID || 'test_client_id';
process.env.SFCC_ADMIN_CLIENT_SECRET = process.env.SFCC_ADMIN_CLIENT_SECRET || 'test_client_secret';
process.env.SFCC_API_BASE = process.env.SFCC_API_BASE || 'https://test.api.com';
process.env.OCAPI_VERSION = process.env.OCAPI_VERSION || 'v24_5';
process.env.REQUEST_ID = process.env.REQUEST_ID || 'test_request_id';

// Configure console methods to avoid noise in test output
global.console = {
  ...console,
  // Suppress console.log in tests
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('node-fetch', () => jest.fn());
