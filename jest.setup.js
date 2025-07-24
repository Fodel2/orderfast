// jest.setup.js
// Global test setup for Jest. Adds custom jest-dom matchers.
require('@testing-library/jest-dom/extend-expect');

// Minimal IntersectionObserver mock for framer-motion
class MockIntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.IntersectionObserver = global.IntersectionObserver || MockIntersectionObserver;
