/**
 * Jest test setup for dashboard-ui
 * Configures DOM environment and global mocks
 */

// Mock localStorage
const localStorageMock = {
  _data: {},
  getItem(key) {
    return this._data[key] || null;
  },
  setItem(key, value) {
    this._data[key] = String(value);
  },
  removeItem(key) {
    delete this._data[key];
  },
  clear() {
    this._data = {};
  },
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: query.includes('dark') ? false : false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock MutationObserver
global.MutationObserver = class {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

// Mock ResizeObserver
global.ResizeObserver = class {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver
global.IntersectionObserver = class {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
);

// Mock WebSocket
global.WebSocket = class {
  constructor(url) {
    this.url = url;
    this.readyState = 1; // OPEN
  }
  send() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
};

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback) => setTimeout(callback, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// Reset mocks before each test
beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-loki-theme');
  document.documentElement.removeAttribute('data-loki-context');
  document.body.className = '';
  jest.clearAllMocks();
});

// Custom matcher for CSS variable presence
expect.extend({
  toHaveCSSVariable(element, variableName) {
    const style = getComputedStyle(element);
    const value = style.getPropertyValue(variableName);
    const pass = value && value.trim() !== '';
    return {
      pass,
      message: () =>
        pass
          ? `Expected element not to have CSS variable ${variableName}`
          : `Expected element to have CSS variable ${variableName}`,
    };
  },
});

// Suppress console warnings during tests
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = (...args) => {
    if (args[0]?.includes?.('Unknown theme')) return;
    originalWarn.apply(console, args);
  };
});

afterAll(() => {
  console.warn = originalWarn;
});
