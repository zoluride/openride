import type { AuthStorage } from '@openride/db';

interface BrowserStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getBrowserStorage(): BrowserStorage {
  return (globalThis as typeof globalThis & { localStorage: BrowserStorage }).localStorage;
}

export const secureStorage: AuthStorage = {
  async getItem(key) {
    return getBrowserStorage().getItem(key);
  },
  async setItem(key, value) {
    getBrowserStorage().setItem(key, value);
  },
  async removeItem(key) {
    getBrowserStorage().removeItem(key);
  },
};
