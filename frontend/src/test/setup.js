import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock deck.gl (WebGL-based, can't run in jsdom)
vi.mock('@deck.gl/core', () => ({
  CompositeLayer: class MockCompositeLayer {
    constructor(props) {
      this.props = props;
    }
    renderLayers() {
      return [];
    }
  },
  COORDINATE_SYSTEM: { IDENTITY: 0 },
}));

vi.mock('@deck.gl/layers', () => ({
  PathLayer: vi.fn(() => ({})),
  ScatterplotLayer: vi.fn(() => ({})),
  IconLayer: vi.fn(() => ({})),
  TextLayer: vi.fn(() => ({})),
}));

vi.mock('@luma.gl/constants', () => ({
  GL: {},
}));

// Mock Web Workers
class MockWorker {
  constructor() {
    this.onmessage = null;
    this.onerror = null;
  }
  postMessage(data) {
    // Simulate async response
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({ data: { type: 'mock-response' } });
      }
    }, 0);
  }
  terminate() {}
  addEventListener(type, handler) {
    if (type === 'message') this.onmessage = handler;
    if (type === 'error') this.onerror = handler;
  }
  removeEventListener() {}
}

vi.stubGlobal('Worker', MockWorker);

// Mock WebSocket / Socket.io
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
    connected: false,
  })),
}));

// Mock ResizeObserver (not available in jsdom)
vi.stubGlobal('ResizeObserver', class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
});

// Mock IntersectionObserver
vi.stubGlobal('IntersectionObserver', class IntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock canvas context for any canvas-related tests
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(() => ({ data: [] })),
  putImageData: vi.fn(),
  createImageData: vi.fn(() => []),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  transform: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
}));

// Mock URL.createObjectURL
URL.createObjectURL = vi.fn(() => 'mock-url');
URL.revokeObjectURL = vi.fn();

// Suppress console errors during tests (optional - remove if you want to see them)
// vi.spyOn(console, 'error').mockImplementation(() => {});


