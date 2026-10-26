// Jest setup for src/content (mocks for native modules). Owned by the src/content agent.
//
// expo-sqlite/kv-store is replaced by an in-memory store with the same sync/async surface, so any
// test that imports the settings store or content service runs without native modules. Each test
// file gets a fresh, empty store; call `Storage.clearSync()` to wipe it inside a file.
jest.mock('expo-sqlite/kv-store', () => {
  class MockSQLiteStorage {
    private map = new Map<string, string>();
    constructor(readonly databaseName = 'mock') {}
    getItemSync(key: string): string | null {
      return this.map.get(key) ?? null;
    }
    setItemSync(key: string, value: string | ((prev: string | null) => string)): void {
      this.map.set(key, typeof value === 'function' ? value(this.getItemSync(key)) : value);
    }
    removeItemSync(key: string): boolean {
      return this.map.delete(key);
    }
    getAllKeysSync(): string[] {
      return [...this.map.keys()];
    }
    clearSync(): boolean {
      this.map.clear();
      return true;
    }
    getLengthSync(): number {
      return this.map.size;
    }
    getKeyByIndexSync(index: number): string | null {
      return [...this.map.keys()][index] ?? null;
    }
    closeSync(): void {}
    async getItemAsync(key: string) {
      return this.getItemSync(key);
    }
    async setItemAsync(key: string, value: string | ((prev: string | null) => string)) {
      this.setItemSync(key, value);
    }
    async removeItemAsync(key: string) {
      return this.removeItemSync(key);
    }
    async getAllKeysAsync() {
      return this.getAllKeysSync();
    }
    async clearAsync() {
      return this.clearSync();
    }
    async closeAsync() {}
    async getLengthAsync() {
      return this.getLengthSync();
    }
    getItem(key: string) {
      return this.getItemAsync(key);
    }
    async setItem(key: string, value: string) {
      this.setItemSync(key, value);
    }
    async removeItem(key: string) {
      this.removeItemSync(key);
    }
    getAllKeys() {
      return this.getAllKeysAsync();
    }
    async clear() {
      this.clearSync();
    }
    async close() {}
  }
  const Storage = new MockSQLiteStorage('ExpoSQLiteStorage');
  return {
    __esModule: true,
    SQLiteStorage: MockSQLiteStorage,
    AsyncStorage: Storage,
    Storage,
    default: Storage,
  };
});

export {};
