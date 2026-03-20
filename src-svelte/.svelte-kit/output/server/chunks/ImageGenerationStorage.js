const PAGE_SIZE = 20;
const DB_NAME = "chatbox-image-generation";
const STORE_NAME = "records";
class IndexedDBImageGenerationStorage {
  constructor() {
    this.db = null;
    this.initPromise = null;
  }
  initialize() {
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = this.openDatabase();
    return this.initPromise;
  }
  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      };
    });
  }
  getStore(mode) {
    if (!this.db) throw new Error("Database not initialized");
    const tx = this.db.transaction(STORE_NAME, mode);
    return tx.objectStore(STORE_NAME);
  }
  async create(record) {
    await this.initialize();
    return new Promise((resolve, reject) => {
      const store = this.getStore("readwrite");
      const request = store.add(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  async update(id, updates) {
    await this.initialize();
    const existing = await this.getById(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    return new Promise((resolve, reject) => {
      const store = this.getStore("readwrite");
      const request = store.put(updated);
      request.onsuccess = () => resolve(updated);
      request.onerror = () => reject(request.error);
    });
  }
  async getById(id) {
    await this.initialize();
    return new Promise((resolve, reject) => {
      const store = this.getStore("readonly");
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }
  async delete(id) {
    await this.initialize();
    return new Promise((resolve, reject) => {
      const store = this.getStore("readwrite");
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  async getPage(cursor = 0, limit = PAGE_SIZE) {
    await this.initialize();
    const total = await this.getTotal();
    return new Promise((resolve, reject) => {
      const store = this.getStore("readonly");
      const index = store.index("createdAt");
      const items = [];
      let skipped = 0;
      const request = index.openCursor(null, "prev");
      request.onsuccess = (event) => {
        const cursor_ = event.target.result;
        if (!cursor_) {
          const nextCursor = cursor + items.length < total ? cursor + items.length : null;
          resolve({ items, nextCursor, total });
          return;
        }
        if (skipped < cursor) {
          skipped++;
          cursor_.continue();
          return;
        }
        if (items.length < limit) {
          items.push(cursor_.value);
          cursor_.continue();
        } else {
          const nextCursor = cursor + items.length < total ? cursor + items.length : null;
          resolve({ items, nextCursor, total });
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
  async getTotal() {
    await this.initialize();
    return new Promise((resolve, reject) => {
      const store = this.getStore("readonly");
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
export {
  IndexedDBImageGenerationStorage as I
};
