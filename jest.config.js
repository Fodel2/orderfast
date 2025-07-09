// jest.config.js
// Jest configuration for Next.js with TypeScript support via ts-jest.
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom',
  // Map legacy extend-expect import to the new package location
  moduleNameMapper: {
    '^@testing-library/jest-dom/extend-expect$': '@testing-library/jest-dom',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
