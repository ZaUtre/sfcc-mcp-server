// Jest setup file for global test configuration
// This file is loaded before any tests are run

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