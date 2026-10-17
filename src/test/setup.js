import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Node 25+ ships a global `localStorage` accessor that returns undefined
// unless `--localstorage-file` is provided. Vitest's jsdom environment skips
// hoisting jsdom's real Storage onto the test global when that key already
// exists on globalThis (vitest-dev/vitest#8757), leaving `localStorage`
// undefined and failing every suite that touches it. Install a spec-shaped
// in-memory Storage so the tests run identically on every Node version.
if (typeof localStorage === "undefined" || localStorage === null) {
  const store = new Map();
  const storage = {
    get length() {
      return store.size;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
  };
  try {
    Object.defineProperty(globalThis, "localStorage", {
      value: storage,
      configurable: true,
    });
  } catch (e) {
    globalThis.localStorage = storage;
  }
}

afterEach(() => {
  cleanup();
});
