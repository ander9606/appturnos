'use strict';

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.test.json',
      diagnostics: false,
    }],
  },
  moduleNameMapper: {
    // Resolve @api-client to this package's own source
    '^@api-client$': '<rootDir>/src/index.ts',
    // Resolve @/* mobile aliases to the mobile app directory
    '^@/(.*)$': '<rootDir>/../../apps/mobile/$1',
  },
  // Allow ts-jest to transform files outside the rootDir (cross-package tests)
  transformIgnorePatterns: ['/node_modules/'],
  clearMocks: true,
};
