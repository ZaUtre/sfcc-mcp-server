module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\.ts$': ['ts-jest', { 
      useESM: true,
      tsconfig: 'tsconfig.test.json'
    }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!node-fetch)/', // transform node-fetch
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts', // Main entry point excluded from coverage
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/build/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^(\.{1,2}/.*)\.js$': '$1',
  },
};