import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class IndexedDbService {
  private dbName = 'TodoAppDB';
  private storeName = 'avatars';
  // v2 added the `offline` store (data shown when the app starts offline).
  private offlineStoreName = 'offline';
  private version = 2;
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDb();
  }

  private initDb(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        resolve();
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = (event): void => {
        console.error('IndexedDB error:', event);
        reject('Error opening IndexedDB');
      };

      request.onsuccess = (event): void => {
        this.db = (event.target as IDBOpenDBRequest).result;
        // Let a newer version of the app (another tab) upgrade the database.
        this.db.onversionchange = (): void => {
          this.db?.close();
          this.db = null;
        };
        resolve();
      };

      // An older tab still holds the previous version open. Don't hang the
      // app on it: carry on without IndexedDB until that tab closes.
      request.onblocked = (): void => {
        console.warn('IndexedDB upgrade blocked by another tab');
        resolve();
      };

      request.onupgradeneeded = (event): void => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
        if (!db.objectStoreNames.contains(this.offlineStoreName)) {
          db.createObjectStore(this.offlineStoreName);
        }
      };
    });
  }

  async saveAvatar(blob: Blob): Promise<void> {
    if (!this.db) await this.initDb();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(blob, 'currentUserAvatar');

      request.onsuccess = (): void => resolve();
      request.onerror = (): void => reject('Error saving avatar');
    });
  }

  async getAvatar(): Promise<Blob | null> {
    if (!this.db) await this.initDb();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get('currentUserAvatar');

      request.onsuccess = (event): void => {
        const result = (event.target as IDBRequest).result;
        resolve(result || null);
      };
      request.onerror = (): void => reject('Error getting avatar');
    });
  }

  async deleteAvatar(): Promise<void> {
    if (!this.db) await this.initDb();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      store.delete('currentUserAvatar');
      const request = store.delete('currentUserAvatarUrl');

      request.onsuccess = (): void => resolve();
      request.onerror = (): void => reject('Error deleting avatar');
    });
  }

  async saveAvatarUrl(url: string): Promise<void> {
    if (!this.db) await this.initDb();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(url, 'currentUserAvatarUrl');

      request.onsuccess = (): void => resolve();
      request.onerror = (): void => reject('Error saving avatar URL');
    });
  }

  async getAvatarUrl(): Promise<string | null> {
    if (!this.db) await this.initDb();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get('currentUserAvatarUrl');

      request.onsuccess = (event): void => {
        const result = (event.target as IDBRequest).result;
        resolve(result || null);
      };
      request.onerror = (): void => reject('Error getting avatar URL');
    });
  }

  // ==================== Offline data ====================

  async getOffline<T>(key: string): Promise<T | null> {
    if (!this.db) await this.initDb();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [this.offlineStoreName],
        'readonly',
      );
      const request = transaction.objectStore(this.offlineStoreName).get(key);

      request.onsuccess = (): void => resolve((request.result as T) ?? null);
      request.onerror = (): void => reject('Error reading offline data');
    });
  }

  async putOffline<T>(key: string, value: T): Promise<void> {
    if (!this.db) await this.initDb();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [this.offlineStoreName],
        'readwrite',
      );
      transaction.objectStore(this.offlineStoreName).put(value, key);

      transaction.oncomplete = (): void => resolve();
      transaction.onerror = (): void => reject('Error saving offline data');
    });
  }

  async deleteOffline(key: string): Promise<void> {
    if (!this.db) await this.initDb();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [this.offlineStoreName],
        'readwrite',
      );
      transaction.objectStore(this.offlineStoreName).delete(key);

      transaction.oncomplete = (): void => resolve();
      transaction.onerror = (): void => reject('Error deleting offline data');
    });
  }
}
