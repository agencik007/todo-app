import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class IndexedDbService {
    private dbName = 'TodoAppDB';
    private storeName = 'avatars';
    private version = 1;
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

            request.onerror = (event) => {
                console.error('IndexedDB error:', event);
                reject('Error opening IndexedDB');
            };

            request.onsuccess = (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
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

            request.onsuccess = () => resolve();
            request.onerror = () => reject('Error saving avatar');
        });
    }

    async getAvatar(): Promise<Blob | null> {
        if (!this.db) await this.initDb();
        if (!this.db) return null;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get('currentUserAvatar');

            request.onsuccess = (event) => {
                const result = (event.target as IDBRequest).result;
                resolve(result || null);
            };
            request.onerror = () => reject('Error getting avatar');
        });
    }

    async deleteAvatar(): Promise<void> {
        if (!this.db) await this.initDb();
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete('currentUserAvatar');

            request.onsuccess = () => resolve();
            request.onerror = () => reject('Error deleting avatar');
        });
    }
}
