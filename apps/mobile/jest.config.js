const alias = {
  '^@/(.*)$': '<rootDir>/$1',
  '^@api-client$': '<rootDir>/../../packages/api-client/src/index.ts',
};

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      // Lógica pura (utilidades, formatters…): TypeScript sin React Native.
      displayName: 'logica',
      preset: 'ts-jest',
      testEnvironment: 'node',
      transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: './tsconfig.jest.json' }],
      },
      testMatch: ['**/__tests__/**/*.test.ts'],
      moduleNameMapper: alias,
    },
    {
      // Pantallas y componentes: se montan de verdad con @testing-library/react-native.
      displayName: 'componentes',
      preset: 'jest-expo',
      setupFiles: ['<rootDir>/jest.setup.componentes.js'],
      // api-client vive fuera de apps/mobile y no tiene node_modules propio: que resuelva desde aquí.
      modulePaths: ['<rootDir>/node_modules'],
      testMatch: ['**/__tests__/**/*.test.tsx'],
      moduleNameMapper: alias,
    },
  ],
};
