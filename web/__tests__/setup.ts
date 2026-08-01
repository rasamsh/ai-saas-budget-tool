import '@testing-library/jest-dom'

// jsdom has no ResizeObserver; recharts' ResponsiveContainer needs one to mount.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = MockResizeObserver
